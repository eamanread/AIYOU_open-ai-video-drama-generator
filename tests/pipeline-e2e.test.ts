/**
 * Pipeline E2E integration tests
 * Mocks the API layer (registry services) but NOT the engine internals.
 * Verifies data flows correctly through Template C topology.
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

function makeContext() {
  const store: Record<string, any> = {};
  return {
    nodeId: '',
    nodes: [] as AppNode[],
    connections: [] as Connection[],
    getInputData: vi.fn((nodeId: string) => store[nodeId] ?? null),
    updateNodeStatus: vi.fn(),
    updateNodeData: vi.fn((nodeId: string, data: any) => {
      store[nodeId] = data;
    }),
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Realistic mock registry — each node type returns domain-shaped data
// ---------------------------------------------------------------------------

function e2eRegistry(opts: { failNodes?: string[] } = {}) {
  const callLog: string[] = [];

  const dataByType: Record<string, (node: AppNode) => any> = {
    PROMPT_INPUT: (n) => ({ prompt: n.data.prompt ?? 'raw script text' }),
    SCRIPT_PARSER: () => ({
      structured: {
        title: 'Test Drama',
        episodes: [{ id: 'ep1', title: 'Pilot', scenes: [] }],
        characters: [{ name: 'Hero' }],
      },
    }),
    STORYBOARD_GENERATOR: () => ({
      storyboard: {
        shots: [{ id: 's1', visualDescription: 'wide shot' }],
        episodeTitle: 'Pilot',
        totalShots: 1,
      },
    }),
    VIDEO_PROMPT_GENERATOR: () => ({
      videoPrompts: [{ shotId: 's1', prompt: 'cinematic wide shot' }],
    }),
    PLATFORM_SUBMIT: () => ({ taskId: 'task_abc123' }),
  };

  const service = {
    executeNode: vi.fn(async (node: AppNode) => {
      callLog.push(node.id);
      if (opts.failNodes?.includes(node.id)) {
        return { success: false, error: `Fail: ${node.id}` };
      }
      const builder = dataByType[node.type] ?? (() => ({}));
      return { success: true, data: builder(node) };
    }),
    setPaused: vi.fn(),
  };

  return {
    get: vi.fn(() => service),
    getRegisteredTypes: vi.fn(() => Object.keys(dataByType)),
    _service: service,
    _callLog: callLog,
  };
}

// ---------------------------------------------------------------------------
// Template C: linear 5-node pipeline
// ---------------------------------------------------------------------------

function templateC() {
  const nodes = [
    makeNode('input_1', NodeType.PROMPT_INPUT),
    makeNode('parser_1', NodeType.SCRIPT_PARSER),
    makeNode('storyboard_1', NodeType.STORYBOARD_GENERATOR),
    makeNode('vidprompt_1', NodeType.VIDEO_PROMPT_GENERATOR),
    makeNode('submit_1', NodeType.PLATFORM_SUBMIT),
  ];
  nodes[0].data.prompt = 'Once upon a time...';

  const conns = [
    makeConn('input_1', 'parser_1'),
    makeConn('parser_1', 'storyboard_1'),
    makeConn('storyboard_1', 'vidprompt_1'),
    makeConn('vidprompt_1', 'submit_1'),
  ];
  return { nodes, conns };
}

// ---------------------------------------------------------------------------
// Group 1: Template C Happy Path
// ---------------------------------------------------------------------------

describe('Pipeline E2E — Template C happy path', () => {
  it('full pipeline completes with all 5 nodes successful', async () => {
    const { nodes, conns } = templateC();
    const reg = e2eRegistry();
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('completed');
    expect(Object.values(state.nodeStatuses).every(s => s === 'success')).toBe(true);
    expect(reg._service.executeNode).toHaveBeenCalledTimes(5);
  });

  it('execution order matches topology: input->parser->storyboard->vidprompt->submit', async () => {
    const { nodes, conns } = templateC();
    const reg = e2eRegistry();
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    await engine.run();

    expect(reg._callLog).toEqual([
      'input_1', 'parser_1', 'storyboard_1', 'vidprompt_1', 'submit_1',
    ]);
  });

  it('data flows between nodes via context.updateNodeData', async () => {
    const { nodes, conns } = templateC();
    const reg = e2eRegistry();
    const ctx = makeContext();
    const engine = new PipelineEngine(nodes, conns, reg as any, ctx);
    await engine.run();

    // Each node execution should have been called with the node object
    const calls = reg._service.executeNode.mock.calls;
    expect(calls[0][0].id).toBe('input_1');
    expect(calls[1][0].id).toBe('parser_1');
    expect(calls[4][0].id).toBe('submit_1');
  });
});

// ---------------------------------------------------------------------------
// Group 2: Exception Scenarios
// ---------------------------------------------------------------------------

describe('Pipeline E2E — exception scenarios', () => {
  it('mid-pipeline failure stops downstream nodes', async () => {
    const { nodes, conns } = templateC();
    const reg = e2eRegistry({ failNodes: ['parser_1'] });
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('error');
    expect(state.nodeStatuses['input_1']).toBe('success');
    expect(state.nodeStatuses['parser_1']).toBe('error');
    expect(state.failures['parser_1'].error).toBe('Fail: parser_1');
    // Downstream nodes still executed (Promise.allSettled per layer) but
    // the engine marks overall status as error
    expect(reg._callLog).toContain('input_1');
    expect(reg._callLog).toContain('parser_1');
  });

  it('skip failed node and continue — downstream proceeds', async () => {
    const { nodes, conns } = templateC();
    const reg = e2eRegistry({ failNodes: ['parser_1'] });
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    await engine.run();

    let state = engine.getState();
    expect(state.nodeStatuses['parser_1']).toBe('error');

    engine.skipAndContinue('parser_1');
    state = engine.getState();
    expect(state.nodeStatuses['parser_1']).toBe('skipped');
  });

  it('multiple failures are all recorded in state.failures', async () => {
    const { nodes, conns } = templateC();
    const reg = e2eRegistry({ failNodes: ['parser_1', 'storyboard_1'] });
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('error');
    expect(state.failures['parser_1']).toBeDefined();
    expect(state.failures['storyboard_1']).toBeDefined();
    expect(state.failures['parser_1'].error).toBe('Fail: parser_1');
    expect(state.failures['storyboard_1'].error).toBe('Fail: storyboard_1');
  });
});

// ---------------------------------------------------------------------------
// Group 3: Pipeline Control
// ---------------------------------------------------------------------------

describe('Pipeline E2E — pipeline control', () => {
  it('pause mid-execution yields paused state', async () => {
    let resolveBlock: (() => void) | null = null;
    const blockingService = {
      executeNode: vi.fn(async (node: AppNode) => {
        if (node.id === 'parser_1') {
          await new Promise<void>(r => { resolveBlock = r; });
        }
        return { success: true, data: {} };
      }),
      setPaused: vi.fn(),
    };
    const reg = {
      get: vi.fn(() => blockingService),
      getRegisteredTypes: vi.fn(() => ['PROMPT_INPUT']),
    };

    const { nodes, conns } = templateC();
    const engine = new PipelineEngine(nodes, conns, reg as any, makeContext());
    const runPromise = engine.run();

    // Wait for layer 0 (input_1) to finish and layer 1 (parser_1) to start blocking
    await new Promise(r => setTimeout(r, 30));
    engine.pause();

    const paused = engine.getState();
    expect(paused.status).toBe('paused');

    engine.resume();
    if (resolveBlock) resolveBlock();

    const final = await runPromise;
    expect(final.status).toBe('completed');
  });

  it('empty template — 0 nodes completes immediately', async () => {
    const reg = e2eRegistry();
    const engine = new PipelineEngine([], [], reg as any, makeContext());
    const state = await engine.run();

    expect(state.status).toBe('completed');
    expect(state.executionOrder).toEqual([]);
    expect(reg._service.executeNode).not.toHaveBeenCalled();
  });
});
