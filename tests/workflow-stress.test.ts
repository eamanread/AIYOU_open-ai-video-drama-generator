/**
 * Workflow System Stress Tests
 * - Template system validation
 * - Solidify/Instantiate round-trip
 * - 10-scene long drama pipeline stress
 */

import { NodeType, NodeStatus, AppNode, Connection, FixedWorkflow } from '../types';
import {
  WORKFLOW_TEMPLATES,
  getTemplateById,
  exportTemplate,
  importTemplate,
  addUserTemplate,
  getUserTemplates,
  getAllTemplates,
  removeUserTemplate,
} from '../services/workflowTemplates';
import {
  solidifyWorkflow,
  instantiateWorkflow,
} from '../services/workflowSolidifier';
import { PipelineEngine } from '../services/pipelineEngine';

// ── Helpers ────────────────────────────────────────────────

/** Node types for a single scene pipeline */
const SCENE_NODE_TYPES: NodeType[] = [
  NodeType.SCRIPT_PARSER,
  NodeType.STYLE_PRESET,
  NodeType.CHARACTER_NODE,
  NodeType.SCENE_ASSET,
  NodeType.PROP_ASSET,
  NodeType.STORYBOARD_GENERATOR,
  NodeType.VIDEO_PROMPT_GENERATOR,
  NodeType.PLATFORM_SUBMIT,
];

function makeAppNode(id: string, type: NodeType, data: Record<string, any> = {}): AppNode {
  return {
    id,
    type,
    x: 0,
    y: 0,
    title: id,
    status: NodeStatus.IDLE,
    data,
    inputs: [],
  };
}

/**
 * Build nodes + internal connections for a single scene.
 * Layout: SCRIPT_PARSER → STYLE_PRESET → (CHARACTER + SCENE_ASSET + PROP_ASSET) → STORYBOARD → VIDEO_PROMPT → PLATFORM_SUBMIT
 */
function buildSceneNodes(sceneIndex: number): { nodes: AppNode[]; connections: Connection[] } {
  const prefix = `s${sceneIndex}`;
  const nodes: AppNode[] = [
    makeAppNode(`${prefix}_parser`,     NodeType.SCRIPT_PARSER),
    makeAppNode(`${prefix}_style`,      NodeType.STYLE_PRESET),
    makeAppNode(`${prefix}_char`,       NodeType.CHARACTER_NODE),
    makeAppNode(`${prefix}_scene`,      NodeType.SCENE_ASSET),
    makeAppNode(`${prefix}_prop`,       NodeType.PROP_ASSET),
    makeAppNode(`${prefix}_storyboard`, NodeType.STORYBOARD_GENERATOR),
    makeAppNode(`${prefix}_vidprompt`,  NodeType.VIDEO_PROMPT_GENERATOR),
    makeAppNode(`${prefix}_submit`,     NodeType.PLATFORM_SUBMIT),
  ];

  const connections: Connection[] = [
    { from: `${prefix}_parser`,     to: `${prefix}_style` },
    { from: `${prefix}_style`,      to: `${prefix}_char` },
    { from: `${prefix}_style`,      to: `${prefix}_scene` },
    { from: `${prefix}_style`,      to: `${prefix}_prop` },
    { from: `${prefix}_char`,       to: `${prefix}_storyboard` },
    { from: `${prefix}_scene`,      to: `${prefix}_storyboard` },
    { from: `${prefix}_prop`,       to: `${prefix}_storyboard` },
    { from: `${prefix}_storyboard`, to: `${prefix}_vidprompt` },
    { from: `${prefix}_vidprompt`,  to: `${prefix}_submit` },
  ];

  return { nodes, connections };
}

/**
 * Chain multiple scenes into one big pipeline.
 * Each scene's PLATFORM_SUBMIT connects to the next scene's SCRIPT_PARSER.
 */
function buildLongDramaPipeline(sceneCount: number): { nodes: AppNode[]; connections: Connection[] } {
  const allNodes: AppNode[] = [];
  const allConnections: Connection[] = [];

  for (let i = 0; i < sceneCount; i++) {
    const { nodes, connections } = buildSceneNodes(i);
    allNodes.push(...nodes);
    allConnections.push(...connections);

    // Chain: previous scene's submit → current scene's parser
    if (i > 0) {
      allConnections.push({
        from: `s${i - 1}_submit`,
        to: `s${i}_parser`,
      });
    }
  }

  return { nodes: allNodes, connections: allConnections };
}

/**
 * Mock registry that resolves every node type with success.
 * Matches the interface PipelineEngine expects from NodeServiceRegistry.
 */
function mockRegistry(): any {
  const mockService = {
    executeNode: vi.fn().mockResolvedValue({ success: true }),
    setPaused: vi.fn(),
  };

  return {
    get: vi.fn().mockReturnValue(mockService),
    getRegisteredTypes: vi.fn().mockReturnValue(Object.values(NodeType)),
  };
}

function mockContext(nodes: AppNode[], connections: Connection[]) {
  return {
    nodeId: '',
    nodes,
    connections,
    getInputData: vi.fn(),
    updateNodeStatus: vi.fn(),
    updateNodeData: vi.fn(),
  };
}

// ── Group 1: Template System Stress ────────────────────────

describe('Template System Stress', () => {
  it('1. all 5 built-in templates are valid', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(5);

    for (const tpl of WORKFLOW_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBeTruthy();
      expect(Array.isArray(tpl.nodes)).toBe(true);
      expect(tpl.nodes.length).toBeGreaterThan(0);
      expect(Array.isArray(tpl.connections)).toBe(true);
      expect(['one_click', 'step_by_step']).toContain(tpl.executionMode);
    }
  });

  it('2. template connections reference valid node IDs', () => {
    for (const tpl of WORKFLOW_TEMPLATES) {
      const nodeIds = new Set(tpl.nodes.map(n => n.nodeId));
      for (const conn of tpl.connections) {
        expect(nodeIds.has(conn.from)).toBe(true);
        expect(nodeIds.has(conn.to)).toBe(true);
      }
    }
  });

  it('3. export/import round-trip preserves structure', () => {
    const original = WORKFLOW_TEMPLATES[0];
    const json = exportTemplate(original);
    const imported = importTemplate(json);

    expect(imported).not.toBeNull();
    expect(imported!.name).toBe(original.name);
    expect(imported!.nodes).toEqual(original.nodes);
    expect(imported!.connections).toEqual(original.connections);
    expect(imported!.executionMode).toBe(original.executionMode);
    // id and createdAt are regenerated
    expect(imported!.id).not.toBe(original.id);
    expect(imported!.id).toMatch(/^imported_/);
  });

  it('4. import invalid JSON returns null', () => {
    expect(importTemplate('not valid json {')).toBeNull();
    expect(importTemplate('')).toBeNull();
    expect(importTemplate('undefined')).toBeNull();
  });

  it('5. import missing fields returns null', () => {
    expect(importTemplate(JSON.stringify({ id: 'x' }))).toBeNull();
    expect(importTemplate(JSON.stringify({ id: 'x', name: 'y' }))).toBeNull();
    expect(importTemplate(JSON.stringify({ id: 'x', name: 'y', nodes: [] }))).toBeNull();
    // nodes + connections present but no id → null
    expect(importTemplate(JSON.stringify({ name: 'y', nodes: [], connections: [] }))).toBeNull();
  });

  it('6. user template CRUD — add 3, verify count, remove 1, verify count', () => {
    const baseCount = getAllTemplates().length;

    const tpl1: FixedWorkflow = {
      id: 'user_1', name: 'U1', sourceWorkflowId: '', nodes: [], connections: [],
      executionMode: 'one_click', waitPoints: [], createdAt: Date.now(),
    };
    const tpl2: FixedWorkflow = { ...tpl1, id: 'user_2', name: 'U2' };
    const tpl3: FixedWorkflow = { ...tpl1, id: 'user_3', name: 'U3' };

    addUserTemplate(tpl1);
    addUserTemplate(tpl2);
    addUserTemplate(tpl3);

    expect(getAllTemplates().length).toBe(baseCount + 3);
    expect(getUserTemplates().length).toBe(3);

    const removed = removeUserTemplate('user_2');
    expect(removed).toBe(true);
    expect(getAllTemplates().length).toBe(baseCount + 2);
    expect(getUserTemplates().length).toBe(2);

    // cleanup
    removeUserTemplate('user_1');
    removeUserTemplate('user_3');
  });
});

// ── Group 2: Solidify / Instantiate Round-trip ─────────────

describe('Solidify / Instantiate Round-trip', () => {
  it('7. solidify a 10-node workflow produces valid FixedWorkflow', () => {
    const { nodes, connections } = buildSceneNodes(0);
    // Add 2 extra nodes to reach 10
    nodes.push(makeAppNode('extra_analyzer', NodeType.DRAMA_ANALYZER, { dramaName: 'test' }));
    nodes.push(makeAppNode('extra_refined', NodeType.DRAMA_REFINED));
    connections.push({ from: 'extra_analyzer', to: 'extra_refined' });

    const fixed = solidifyWorkflow('test-10', nodes, connections, 'one_click', ['s0_style']);

    expect(fixed.id).toMatch(/^fixed_/);
    expect(fixed.name).toBe('test-10');
    expect(fixed.nodes).toHaveLength(10);
    expect(fixed.connections).toHaveLength(connections.length);
    expect(fixed.executionMode).toBe('one_click');
    expect(fixed.waitPoints).toEqual(['s0_style']);
    expect(fixed.createdAt).toBeGreaterThan(0);

    // Every fixed node has required fields
    for (const n of fixed.nodes) {
      expect(n.nodeId).toBeTruthy();
      expect(n.nodeType).toBeTruthy();
      expect(n.configSnapshot).toBeDefined();
      expect(Array.isArray(n.runtimeInputs)).toBe(true);
    }
  });

  it('8. instantiate back produces AppNode[] with correct data and rebuilt inputs', () => {
    const { nodes, connections } = buildSceneNodes(0);
    const fixed = solidifyWorkflow('round-trip', nodes, connections, 'one_click', []);
    const result = instantiateWorkflow(fixed, {});

    expect(result.nodes).toHaveLength(nodes.length);
    expect(result.connections).toHaveLength(connections.length);

    for (const appNode of result.nodes) {
      expect(appNode.id).toBeTruthy();
      expect(appNode.type).toBeTruthy();
      expect(appNode.status).toBe(NodeStatus.IDLE);
      expect(appNode.data).toBeDefined();
    }

    // Verify inputs rebuilt from connections
    const storyboard = result.nodes.find(n => n.id === 's0_storyboard')!;
    expect(storyboard.inputs).toHaveLength(3); // char, scene, prop
    expect(storyboard.inputs).toContain('s0_char');
    expect(storyboard.inputs).toContain('s0_scene');
    expect(storyboard.inputs).toContain('s0_prop');

    // First node (parser) has no inputs
    const parser = result.nodes.find(n => n.id === 's0_parser')!;
    expect(parser.inputs).toHaveLength(0);
  });

  it('9. runtime values injection merges into node.data', () => {
    const { nodes, connections } = buildSceneNodes(0);
    const fixed = solidifyWorkflow('inject-test', nodes, connections, 'one_click', []);

    const runtimeValues = {
      s0_parser: { prompt: 'custom script text' },
      s0_style: { stylePrompt: 'cyberpunk neon' },
    };

    const result = instantiateWorkflow(fixed, runtimeValues);
    const parser = result.nodes.find(n => n.id === 's0_parser')!;
    const style = result.nodes.find(n => n.id === 's0_style')!;

    expect(parser.data.prompt).toBe('custom script text');
    expect(style.data.stylePrompt).toBe('cyberpunk neon');
  });

  it('10. large blob exclusion strips excluded keys from configSnapshot', () => {
    const blobNode = makeAppNode('blob_node', NodeType.STORYBOARD_GENERATOR, {
      image: 'base64_very_long_string_simulating_blob_data',
      images: ['img1', 'img2'],
      video: 'video_blob',
      videoUrl: 'http://example.com/video.mp4',
      audio: 'audio_blob',
      generatedEpisodes: [{ title: 'ep1', content: 'c', characters: 'ch' }],
      scriptOutline: 'outline text',
      episodeStoryboard: { shots: [] },
      refinedContent: 'refined text',
      // These should survive
      storyboardCount: 10,
      storyboardDuration: 5,
    });

    const fixed = solidifyWorkflow('blob-test', [blobNode], [], 'one_click', []);
    const snap = fixed.nodes[0];

    // Excluded keys must not appear
    expect(snap.configSnapshot.image).toBeUndefined();
    expect(snap.configSnapshot.images).toBeUndefined();
    expect(snap.configSnapshot.video).toBeUndefined();
    expect(snap.configSnapshot.videoUrl).toBeUndefined();
    expect(snap.configSnapshot.audio).toBeUndefined();
    expect(snap.configSnapshot.generatedEpisodes).toBeUndefined();
    expect(snap.configSnapshot.scriptOutline).toBeUndefined();
    expect(snap.configSnapshot.episodeStoryboard).toBeUndefined();
    expect(snap.configSnapshot.refinedContent).toBeUndefined();

    // Non-excluded keys survive
    expect(snap.configSnapshot.storyboardCount).toBe(10);
    expect(snap.configSnapshot.storyboardDuration).toBe(5);
  });
});

// ── Group 3: 10-Scene Long Drama Stress Test ───────────────

describe('10-Scene Long Drama Stress Test', () => {
  const SCENE_COUNT = 10;
  const NODES_PER_SCENE = 8;
  const CONNS_PER_SCENE = 9;
  // Cross-scene connections: sceneCount - 1
  const EXPECTED_NODES = SCENE_COUNT * NODES_PER_SCENE;               // 80
  const EXPECTED_CONNS = SCENE_COUNT * CONNS_PER_SCENE + (SCENE_COUNT - 1); // 99

  let pipeline: { nodes: AppNode[]; connections: Connection[] };

  beforeAll(() => {
    pipeline = buildLongDramaPipeline(SCENE_COUNT);
  });

  it('11. build 10-scene pipeline has correct node and connection counts', () => {
    expect(pipeline.nodes).toHaveLength(EXPECTED_NODES);
    expect(pipeline.connections).toHaveLength(EXPECTED_CONNS);

    // Verify each scene has the right node types
    for (let i = 0; i < SCENE_COUNT; i++) {
      const prefix = `s${i}`;
      const sceneNodes = pipeline.nodes.filter(n => n.id.startsWith(prefix));
      expect(sceneNodes).toHaveLength(NODES_PER_SCENE);
    }

    // Verify cross-scene chaining
    for (let i = 1; i < SCENE_COUNT; i++) {
      const chainConn = pipeline.connections.find(
        c => c.from === `s${i - 1}_submit` && c.to === `s${i}_parser`,
      );
      expect(chainConn).toBeDefined();
    }
  });

  it('12. solidify the 10-scene workflow preserves node and connection counts', () => {
    const fixed = solidifyWorkflow(
      '10-scene-drama',
      pipeline.nodes,
      pipeline.connections,
      'one_click',
      [],
    );

    expect(fixed.nodes).toHaveLength(EXPECTED_NODES);
    expect(fixed.connections).toHaveLength(EXPECTED_CONNS);
    expect(fixed.name).toBe('10-scene-drama');
    expect(fixed.executionMode).toBe('one_click');

    // Spot-check: first and last node types
    expect(fixed.nodes[0].nodeType).toBe(NodeType.SCRIPT_PARSER);
    expect(fixed.nodes[fixed.nodes.length - 1].nodeType).toBe(NodeType.PLATFORM_SUBMIT);
  });

  it('13. instantiate the 10-scene workflow creates all nodes with correct types', () => {
    const fixed = solidifyWorkflow(
      '10-scene-inst',
      pipeline.nodes,
      pipeline.connections,
      'one_click',
      [],
    );

    const result = instantiateWorkflow(fixed, {});

    expect(result.nodes).toHaveLength(EXPECTED_NODES);
    expect(result.connections).toHaveLength(EXPECTED_CONNS);

    // Every node has a valid NodeType
    const validTypes = new Set(Object.values(NodeType));
    for (const node of result.nodes) {
      expect(validTypes.has(node.type)).toBe(true);
      expect(node.status).toBe(NodeStatus.IDLE);
    }

    // Verify type distribution: 10 of each scene-level type
    for (const nt of SCENE_NODE_TYPES) {
      const count = result.nodes.filter(n => n.type === nt).length;
      expect(count).toBe(SCENE_COUNT);
    }
  });

  it('14. PipelineEngine with mock registry runs all nodes to success', async () => {
    const registry = mockRegistry();
    const ctx = mockContext(pipeline.nodes, pipeline.connections);

    const engine = new PipelineEngine(
      pipeline.nodes,
      pipeline.connections,
      registry,
      ctx,
    );

    const state = await engine.run();

    expect(state.status).toBe('completed');

    // Every node should reach 'success'
    const statuses = Object.values(state.nodeStatuses);
    expect(statuses).toHaveLength(EXPECTED_NODES);
    for (const s of statuses) {
      expect(s).toBe('success');
    }

    // Registry.get was called for every node
    expect(registry.get).toHaveBeenCalledTimes(EXPECTED_NODES);
  });

  it('15. execution completes under 1 second with mocked services', async () => {
    const registry = mockRegistry();
    const ctx = mockContext(pipeline.nodes, pipeline.connections);

    const engine = new PipelineEngine(
      pipeline.nodes,
      pipeline.connections,
      registry,
      ctx,
    );

    const start = performance.now();
    const state = await engine.run();
    const elapsed = performance.now() - start;

    expect(state.status).toBe('completed');
    expect(elapsed).toBeLessThan(1000);
  });
});