import { AppNode, Connection, FixedWorkflow, FixedNodeSnapshot, NodeStatus } from '../types';

const EXCLUDE_KEYS = [
  'image', 'images', 'video', 'videoUrl', 'audio',
  'generatedEpisodes', 'scriptOutline', 'episodeStoryboard', 'refinedContent',
];

function extractConfigSnapshot(node: AppNode): Record<string, any> {
  const config: Record<string, any> = {};
  for (const [key, value] of Object.entries(node.data)) {
    if (!EXCLUDE_KEYS.includes(key) && value !== undefined && value !== null) {
      config[key] = value;
    }
  }
  return config;
}

function detectRuntimeInputs(node: AppNode): string[] {
  const runtime: string[] = [];
  if (node.type === 'PROMPT_INPUT') runtime.push('prompt');
  if (node.type === 'DRAMA_ANALYZER') runtime.push('dramaName');
  if (node.type === 'STYLE_PRESET' && !node.data.stylePrompt && !node.data.stylePresetType) {
    runtime.push('stylePrompt');
  }
  return runtime;
}

export function solidifyWorkflow(
  name: string,
  nodes: AppNode[],
  connections: Connection[],
  executionMode: 'one_click' | 'step_by_step',
  waitPoints: string[],
  sourceWorkflowId?: string,
): FixedWorkflow {
  const id = `fixed_${Date.now()}`;

  const fixedNodes: FixedNodeSnapshot[] = nodes.map((node) => ({
    nodeId: node.id,
    nodeType: node.type,
    configSnapshot: extractConfigSnapshot(node),
    runtimeInputs: detectRuntimeInputs(node),
  }));

  return {
    id,
    name,
    sourceWorkflowId: sourceWorkflowId ?? '',
    nodes: fixedNodes,
    connections: [...connections],
    executionMode,
    waitPoints,
    createdAt: Date.now(),
  };
}

export function instantiateWorkflow(
  template: FixedWorkflow,
  runtimeValues: Record<string, Record<string, any>>,
): { nodes: AppNode[]; connections: Connection[] } {
  const COLS = 3;
  const X_GAP = 320;
  const Y_GAP = 280;
  const X_START = 80;
  const Y_START = 80;

  const nodes: AppNode[] = template.nodes.map((snap, i) => ({
    id: snap.nodeId,
    type: snap.nodeType,
    x: X_START + (i % COLS) * X_GAP,
    y: Y_START + Math.floor(i / COLS) * Y_GAP,
    title: snap.nodeType as string,
    status: NodeStatus.IDLE,
    data: { ...snap.configSnapshot, ...(runtimeValues[snap.nodeId] ?? {}) },
    inputs: [],
  }));

  // Rebuild inputs arrays from connections
  const inputsMap = new Map<string, string[]>();
  for (const conn of template.connections) {
    const list = inputsMap.get(conn.to) ?? [];
    list.push(conn.from);
    inputsMap.set(conn.to, list);
  }
  for (const node of nodes) {
    node.inputs = inputsMap.get(node.id) ?? [];
  }

  return { nodes, connections: [...template.connections] };
}
