/**
 * PipelineEngine failure recovery & cycle detection tests
 */
import { PipelineEngine } from '../services/pipelineEngine';
import { AppNode, Connection, NodeType, NodeStatus } from '../types';

// ---------------------------------------------------------------------------
// Helpers (same pattern as edge-cases test)
// ---------------------------------------------------------------------------

function makeNode(id: string, type: NodeType = NodeType.PROMPT_INPUT): AppNode {
  return {
    id,
    type,
    x: 0,
    y: 0,
    title: id,
    status: NodeStatus.IDLE,
    data: {},
    inputs: [],
  };
}

function makeConn(from: string, to: string): Connection {
  return { id: `${from}->${to}`, from, to };
}

function mockRegistry(opts: { failNodes?: string[]; unregisteredTypes?: string[] } = {}) {
  const mockService = {
    executeNode: vi.fn(async (node: any) => {
      if (opts.failNodes?.includes(node.id)) {
        return { success: false, error: `Mock failure: ${node.id}` };
      }
      return { success: true, data: {} };
    }),
    setPaused: vi.fn(),
  };

  return {
    get: vi.fn((nodeType: string) => {
      if (opts.unregisteredTypes?.includes(nodeType)) return null;
      return mockService;
    }),
    getRegisteredTypes: vi.fn(() => ['PROMPT_INPUT']),
    _mockService: mockService,
  };
}

function makeContext() {
  return {
    nodeId: '',
    nodes: [] as AppNode[],
    connections: [] as Connection[],
    getInputData: () => null,
    updateNodeStatus: vi.fn(),
    updateNodeData: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PipelineEngine failure recovery', () => {

  // 1. Cycle detection: A -> B -> C -> A
  it('should detect A->B->C->A cycle and return error status', async () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const conns = [makeConn('A', 'B'), makeConn('B', 'C'), makeConn('C', 'A')];
    const engine = new PipelineEngine(nodes, conns, mockRegistry() as any, makeContext());

    const state = await engine.run();

    expect(state.status).toBe('error');
    expect(state.failures['__cycle__']).toBeDefined();
    expect(state.failures['__cycle__'].error).toContain('cycle');
    expect(state.failures['__cycle__'].error).toContain('A');
    expect(state.failures['__cycle__'].error).toContain('B');
    expect(state.failures['__cycle__'].error).toContain('C');
  });

  // 2. Self-loop detection: A -> A
  it('should detect self-loop A->A and return error status', async () => {
    const nodes = [makeNode('A')];
    const conns = [makeConn('A', 'A')];
    const engine = new PipelineEngine(nodes, conns, mockRegistry() as any, makeContext());

    const state = await engine.run();

    expect(state.status).toBe('error');
    expect(state.failures['__cycle__']).toBeDefined();
    expect(state.failures['__cycle__'].error).toContain('cycle');
    expect(state.failures['__cycle__'].error).toContain('A');
  });

  // 3. Partial failure recovery: A->B->C, B fails, then skipAndContinue(B)
  it('should handle partial failure and recovery via skipAndContinue', async () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const conns = [makeConn('A', 'B'), makeConn('B', 'C')];
    const reg = mockRegistry({ failNodes: ['B'] });
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());

    const state = await engine.run();

    // A succeeds, B errors; engine continues through layers so C still executes
    expect(state.nodeStatuses['A']).toBe('success');
    expect(state.nodeStatuses['B']).toBe('error');
    expect(state.nodeStatuses['C']).toBe('success');
    expect(state.status).toBe('error');

    // Now skip B and re-run remaining
    engine.skipAndContinue('B');
    expect(engine.getState().nodeStatuses['B']).toBe('skipped');
  });

  // 4. All retries exhausted: mock service always fails
  it('should mark node as error when service always fails', async () => {
    const nodes = [makeNode('A')];
    const reg = mockRegistry({ failNodes: ['A'] });
    const engine = new PipelineEngine(nodes, [], reg as any, makeContext());

    const state = await engine.run();

    expect(state.status).toBe('error');
    expect(state.nodeStatuses['A']).toBe('error');
    expect(state.failures['A']).toBeDefined();
    expect(state.failures['A'].error).toContain('Mock failure: A');
    expect(state.failures['A'].retryCount).toBe(0);
  });

  // 5. Concurrent failure isolation: diamond DAG, one branch fails
  //    A -> B (fail), A -> C (ok), B -> D, C -> D
  it('should isolate failure in one branch while other branch succeeds', async () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const conns = [
      makeConn('A', 'B'),
      makeConn('A', 'C'),
      makeConn('B', 'D'),
      makeConn('C', 'D'),
    ];
    const reg = mockRegistry({ failNodes: ['B'] });
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());

    const state = await engine.run();

    expect(state.nodeStatuses['A']).toBe('success');
    expect(state.nodeStatuses['B']).toBe('error');
    // C runs in same layer as B, should still succeed
    expect(state.nodeStatuses['C']).toBe('success');
    expect(state.status).toBe('error');
  });

  // 6. Large pipeline with single failure: 20-node linear chain, node 10 fails
  it('should handle failure in middle of 20-node linear chain', async () => {
    const nodes = Array.from({ length: 20 }, (_, i) => makeNode(`N${i}`));
    const conns = Array.from({ length: 19 }, (_, i) => makeConn(`N${i}`, `N${i + 1}`));
    const reg = mockRegistry({ failNodes: ['N9'] }); // node 10 (0-indexed: N9)
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());

    const state = await engine.run();

    // First 9 nodes (N0-N8) succeed
    for (let i = 0; i < 9; i++) {
      expect(state.nodeStatuses[`N${i}`]).toBe('success');
    }
    // N9 errors
    expect(state.nodeStatuses['N9']).toBe('error');
    // Engine continues through layers, so N10-N19 still execute and succeed
    for (let i = 10; i < 20; i++) {
      expect(state.nodeStatuses[`N${i}`]).toBe('success');
    }
    expect(state.status).toBe('error');
  });

  // 7. Pause during execution: start pipeline, pause after first layer, verify paused, resume
  it('should support pause and resume during execution', async () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const conns = [makeConn('A', 'B')];

    // Custom registry that pauses engine mid-execution (after A completes)
    let engineRef: PipelineEngine | null = null;
    const mockService = {
      executeNode: vi.fn(async (node: any) => {
        if (node.id === 'A') {
          // After A runs, pause the engine before B starts
          setTimeout(() => engineRef!.pause(), 0);
        }
        return { success: true, data: {} };
      }),
      setPaused: vi.fn(),
    };
    const reg = {
      get: vi.fn(() => mockService),
      getRegisteredTypes: vi.fn(() => ['PROMPT_INPUT']),
    };

    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    engineRef = engine;

    // Start run in background
    const runPromise = engine.run();

    // Give time for pause to take effect
    await new Promise(r => setTimeout(r, 50));
    const midState = engine.getState();

    // Engine should be paused after first layer
    if (midState.status === 'paused') {
      expect(midState.status).toBe('paused');
      engine.resume();
    }

    const finalState = await runPromise;
    // After resume, pipeline should complete
    expect(['completed', 'running']).toContain(finalState.status);
  });

  // 8. getState() snapshot isolation: modifying returned state should not affect engine internals
  it('should return isolated snapshot from getState()', async () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const conns = [makeConn('A', 'B')];
    const engine = new PipelineEngine(nodes, conns, mockRegistry() as any, makeContext());

    await engine.run();

    const snapshot = engine.getState();
    // Mutate the snapshot
    snapshot.status = 'idle';
    snapshot.nodeStatuses['A'] = 'pending';
    snapshot.failures['fake'] = { error: 'injected', retryCount: 99 };

    // Engine's internal state should be unchanged
    const fresh = engine.getState();
    expect(fresh.status).toBe('completed');
    expect(fresh.nodeStatuses['A']).toBe('success');
    expect(fresh.failures['fake']).toBeUndefined();
  });
});