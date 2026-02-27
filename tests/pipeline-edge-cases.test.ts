/**
 * PipelineEngine edge-case tests
 */
import { PipelineEngine } from '../services/pipelineEngine';
import { AppNode, Connection, NodeType, NodeStatus } from '../types';

// ---------------------------------------------------------------------------
// Helpers
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

describe('PipelineEngine edge cases', () => {

  // 1. Empty pipeline
  it('should complete immediately with 0 nodes and 0 connections', async () => {
    const engine = new PipelineEngine([], [], mockRegistry() as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('completed');
    expect(state.executionOrder).toEqual([]);
    expect(Object.keys(state.nodeStatuses)).toHaveLength(0);
  });

  // 2. Single node
  it('should execute a single node and complete', async () => {
    const nodes = [makeNode('A')];
    const reg = mockRegistry();
    const engine = new PipelineEngine(nodes, [], reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('completed');
    expect(state.executionOrder).toEqual(['A']);
    expect(state.nodeStatuses['A']).toBe('success');
    expect(reg._mockService.executeNode).toHaveBeenCalledTimes(1);
  });

  // 3. Disconnected graph — all nodes in same layer, execute in parallel
  it('should execute disconnected nodes in parallel (same layer)', async () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const reg = mockRegistry();
    const engine = new PipelineEngine(nodes, [], reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('completed');
    expect(state.executionOrder).toHaveLength(3);
    expect(state.nodeStatuses['A']).toBe('success');
    expect(state.nodeStatuses['B']).toBe('success');
    expect(state.nodeStatuses['C']).toBe('success');
    // All 3 called — since no connections, they land in one layer
    expect(reg._mockService.executeNode).toHaveBeenCalledTimes(3);
  });

  // 4. Linear chain A→B→C — 3 layers, sequential execution
  it('should execute a linear chain in order across 3 layers', async () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const conns = [makeConn('A', 'B'), makeConn('B', 'C')];
    const reg = mockRegistry();
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('completed');
    expect(state.executionOrder).toEqual(['A', 'B', 'C']);
    expect(state.nodeStatuses['A']).toBe('success');
    expect(state.nodeStatuses['B']).toBe('success');
    expect(state.nodeStatuses['C']).toBe('success');

    // Verify call order: A first, then B, then C
    const calls = reg._mockService.executeNode.mock.calls;
    expect(calls[0][0].id).toBe('A');
    expect(calls[1][0].id).toBe('B');
    expect(calls[2][0].id).toBe('C');
  });

  // 5. Diamond DAG — A→B, A→C, B→D, C→D — B and C in same layer
  it('should place B and C in the same layer for a diamond DAG', async () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const conns = [
      makeConn('A', 'B'),
      makeConn('A', 'C'),
      makeConn('B', 'D'),
      makeConn('C', 'D'),
    ];
    const reg = mockRegistry();
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('completed');
    // A is layer 0, B and C are layer 1, D is layer 2
    // executionOrder should be A first, then B & C (order among them may vary), then D
    expect(state.executionOrder[0]).toBe('A');
    expect(state.executionOrder.slice(1, 3).sort()).toEqual(['B', 'C']);
    expect(state.executionOrder[3]).toBe('D');
    expect(reg._mockService.executeNode).toHaveBeenCalledTimes(4);
  });

  // 6. Unregistered node type — registry returns null → node gets error status
  it('should mark node as error when node type is not registered', async () => {
    const nodes = [makeNode('A', NodeType.SCRIPT_PARSER)];
    const reg = mockRegistry({ unregisteredTypes: ['SCRIPT_PARSER'] });
    const engine = new PipelineEngine(nodes, [], reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('error');
    expect(state.nodeStatuses['A']).toBe('error');
    expect(state.failures['A']).toBeDefined();
    expect(state.failures['A'].error).toContain('未注册的节点类型');
  });

  // 7. Connection referencing missing node — should be ignored gracefully
  it('should ignore connections that reference non-existent nodes', async () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const conns = [
      makeConn('A', 'B'),
      makeConn('A', 'GHOST'),   // 'to' does not exist
      makeConn('PHANTOM', 'B'), // 'from' does not exist
    ];
    const reg = mockRegistry();
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('completed');
    expect(state.nodeStatuses['A']).toBe('success');
    expect(state.nodeStatuses['B']).toBe('success');
    // Only real nodes executed
    expect(reg._mockService.executeNode).toHaveBeenCalledTimes(2);
  });

  // 8. Node execution failure — mock service returns failure
  it('should mark node and pipeline as error when execution fails', async () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const conns = [makeConn('A', 'B')];
    const reg = mockRegistry({ failNodes: ['B'] });
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('error');
    expect(state.nodeStatuses['A']).toBe('success');
    expect(state.nodeStatuses['B']).toBe('error');
    expect(state.failures['B']).toBeDefined();
    expect(state.failures['B'].error).toBe('Mock failure: B');
  });

  // 9. Skip failed node — after failure, skipAndContinue marks node as 'skipped'
  it('should mark a failed node as skipped after skipAndContinue', async () => {
    const nodes = [makeNode('A')];
    const reg = mockRegistry({ failNodes: ['A'] });
    const engine = new PipelineEngine(nodes, [], reg as any, makeContext());
    await engine.run();

    // Verify node is in error state first
    let state = engine.getState();
    expect(state.nodeStatuses['A']).toBe('error');
    expect(state.status).toBe('error');

    // Skip the failed node
    engine.skipAndContinue('A');
    state = engine.getState();
    expect(state.nodeStatuses['A']).toBe('skipped');
  });

  // 10. Pause and resume — pause mid-execution, verify paused state, resume to completion
  it('should pause mid-execution and resume to completion', async () => {
    // Use a slow node so we can pause while it's running
    let resolveExec: (() => void) | null = null;
    const slowService = {
      executeNode: vi.fn(async () => {
        // First call resolves immediately, second call waits
        if (slowService.executeNode.mock.calls.length <= 1) {
          return { success: true, data: {} };
        }
        await new Promise<void>(r => { resolveExec = r; });
        return { success: true, data: {} };
      }),
      setPaused: vi.fn(),
    };

    const slowRegistry = {
      get: vi.fn(() => slowService),
      getRegisteredTypes: vi.fn(() => ['PROMPT_INPUT']),
    };

    const nodes = [makeNode('A'), makeNode('B')];
    const conns = [makeConn('A', 'B')];
    const engine = new PipelineEngine(
      nodes, conns, slowRegistry as any, makeContext(),
    );

    // Start pipeline without awaiting — it will block on node B
    const runPromise = engine.run();

    // Give layer 0 (node A) time to finish, then pause before B completes
    await new Promise(r => setTimeout(r, 20));
    engine.pause();

    const pausedState = engine.getState();
    expect(pausedState.status).toBe('paused');

    // Resume
    engine.resume();

    // Unblock the slow node
    if (resolveExec) resolveExec();

    const finalState = await runPromise;
    expect(finalState.status).toBe('completed');
    expect(finalState.nodeStatuses['A']).toBe('success');
    expect(finalState.nodeStatuses['B']).toBe('success');
  });
});
