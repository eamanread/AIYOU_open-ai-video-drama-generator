/**
 * 预设工作流模板 — 开箱即用的 3 套固化流程
 */
import { NodeType, Connection, FixedWorkflow, FixedNodeSnapshot } from '../types';

// ── helper ──────────────────────────────────────────────────
function makeNode(
  id: string, nodeType: NodeType, x: number, y: number,
  runtimeInputs: string[] = [], config: Record<string, any> = {},
): FixedNodeSnapshot {
  return { nodeId: id, nodeType, configSnapshot: config, runtimeInputs };
}

function conn(from: string, to: string): Connection {
  return { from, to };
}

// ── Template A: 一键全自动 ─────────────────────────────────
const nodesA: FixedNodeSnapshot[] = [
  makeNode('input_1',      NodeType.PROMPT_INPUT,          0,   0, ['prompt']),
  makeNode('parser_1',     NodeType.SCRIPT_PARSER,       200,   0),
  makeNode('style_1',      NodeType.STYLE_PRESET,        400,   0),
  makeNode('char_1',       NodeType.CHARACTER_NODE,      600, -100),
  makeNode('scene_1',      NodeType.SCENE_ASSET,         600,   0),
  makeNode('prop_1',       NodeType.PROP_ASSET,          600, 100),
  makeNode('storyboard_1', NodeType.STORYBOARD_GENERATOR,800,   0),
  makeNode('vidprompt_1',  NodeType.VIDEO_PROMPT_GENERATOR,1000, 0),
  makeNode('submit_1',     NodeType.PLATFORM_SUBMIT,     1200,  0),
];

const connectionsA: Connection[] = [
  conn('input_1',  'parser_1'),
  conn('parser_1', 'style_1'),
  conn('style_1',  'char_1'),
  conn('style_1',  'scene_1'),
  conn('style_1',  'prop_1'),
  conn('char_1',   'storyboard_1'),
  conn('scene_1',  'storyboard_1'),
  conn('prop_1',   'storyboard_1'),
  conn('storyboard_1', 'vidprompt_1'),
  conn('vidprompt_1',  'submit_1'),
];

const templateA: FixedWorkflow = {
  id: 'template_a',
  name: '一键全自动',
  sourceWorkflowId: '',
  nodes: nodesA,
  connections: connectionsA,
  executionMode: 'one_click',
  waitPoints: ['style_1'],
  createdAt: 0,
};

// ── Template B: 创作全流程 ─────────────────────────────────
const nodesB: FixedNodeSnapshot[] = [
  makeNode('analyzer_1', NodeType.DRAMA_ANALYZER,        0,   0, ['dramaName']),
  makeNode('refined_1',  NodeType.DRAMA_REFINED,       200,   0),
  makeNode('planner_1',  NodeType.SCRIPT_PLANNER,      400,   0),
  makeNode('episode_1',  NodeType.SCRIPT_EPISODE,      600,   0),
  makeNode('parser_1',   NodeType.SCRIPT_PARSER,       800,   0),
  makeNode('style_1',    NodeType.STYLE_PRESET,       1000,   0),
  makeNode('char_1',     NodeType.CHARACTER_NODE,     1200, -100),
  makeNode('scene_1',    NodeType.SCENE_ASSET,        1200,   0),
  makeNode('prop_1',     NodeType.PROP_ASSET,         1200, 100),
  makeNode('storyboard_1', NodeType.STORYBOARD_GENERATOR, 1400, 0),
  makeNode('vidprompt_1',  NodeType.VIDEO_PROMPT_GENERATOR, 1600, 0),
  makeNode('submit_1',     NodeType.PLATFORM_SUBMIT,   1800,  0),
];

const allNodeIdsB = nodesB.map(n => n.nodeId);

const connectionsB: Connection[] = [
  conn('analyzer_1', 'refined_1'),
  conn('refined_1',  'planner_1'),
  conn('planner_1',  'episode_1'),
  conn('episode_1',  'parser_1'),
  conn('parser_1',   'style_1'),
  conn('style_1',    'char_1'),
  conn('style_1',    'scene_1'),
  conn('style_1',    'prop_1'),
  conn('char_1',     'storyboard_1'),
  conn('scene_1',    'storyboard_1'),
  conn('prop_1',     'storyboard_1'),
  conn('storyboard_1', 'vidprompt_1'),
  conn('vidprompt_1',  'submit_1'),
];

const templateB: FixedWorkflow = {
  id: 'template_b',
  name: '创作全流程',
  sourceWorkflowId: '',
  nodes: nodesB,
  connections: connectionsB,
  executionMode: 'step_by_step',
  waitPoints: allNodeIdsB,
  createdAt: 0,
};

// ── Template C: 分镜快出 ──────────────────────────────────
const nodesC: FixedNodeSnapshot[] = [
  makeNode('input_1',      NodeType.PROMPT_INPUT,           0, 0, ['prompt']),
  makeNode('parser_1',     NodeType.SCRIPT_PARSER,        200, 0),
  makeNode('storyboard_1', NodeType.STORYBOARD_GENERATOR, 400, 0),
  makeNode('vidprompt_1',  NodeType.VIDEO_PROMPT_GENERATOR,600, 0),
  makeNode('submit_1',     NodeType.PLATFORM_SUBMIT,      800, 0),
];

const connectionsC: Connection[] = [
  conn('input_1',  'parser_1'),
  conn('parser_1', 'storyboard_1'),
  conn('storyboard_1', 'vidprompt_1'),
  conn('vidprompt_1',  'submit_1'),
];

const templateC: FixedWorkflow = {
  id: 'template_c',
  name: '分镜快出',
  sourceWorkflowId: '',
  nodes: nodesC,
  connections: connectionsC,
  executionMode: 'one_click',
  waitPoints: [],
  createdAt: 0,
};

// ── Template D: 角色资产专精 ─────────────────────────────
const nodesD: FixedNodeSnapshot[] = [
  makeNode('input_1',  NodeType.PROMPT_INPUT,      0,   0, ['prompt']),
  makeNode('parser_1', NodeType.SCRIPT_PARSER,    200,   0),
  makeNode('style_1',  NodeType.STYLE_PRESET,     400,   0),
  makeNode('char_1',   NodeType.CHARACTER_NODE,   600, -100),
  makeNode('scene_1',  NodeType.SCENE_ASSET,      600,   0),
  makeNode('prop_1',   NodeType.PROP_ASSET,       600, 100),
  makeNode('storyboard_1', NodeType.STORYBOARD_GENERATOR, 800, 0),
];

const connectionsD: Connection[] = [
  conn('input_1',  'parser_1'),
  conn('parser_1', 'style_1'),
  conn('style_1',  'char_1'),
  conn('style_1',  'scene_1'),
  conn('style_1',  'prop_1'),
  conn('char_1',   'storyboard_1'),
  conn('scene_1',  'storyboard_1'),
  conn('prop_1',   'storyboard_1'),
];

const templateD: FixedWorkflow = {
  id: 'template_d',
  name: '角色资产专精',
  sourceWorkflowId: '',
  nodes: nodesD,
  connections: connectionsD,
  executionMode: 'step_by_step',
  waitPoints: ['style_1', 'char_1', 'scene_1', 'prop_1'],
  createdAt: 0,
};

// ── Template E: 剧本打磨 ────────────────────────────────
const nodesE: FixedNodeSnapshot[] = [
  makeNode('analyzer_1', NodeType.DRAMA_ANALYZER,   0, 0, ['dramaName']),
  makeNode('refined_1',  NodeType.DRAMA_REFINED,  200, 0),
  makeNode('planner_1',  NodeType.SCRIPT_PLANNER, 400, 0),
  makeNode('episode_1',  NodeType.SCRIPT_EPISODE, 600, 0),
];

const connectionsE: Connection[] = [
  conn('analyzer_1', 'refined_1'),
  conn('refined_1',  'planner_1'),
  conn('planner_1',  'episode_1'),
];

const templateE: FixedWorkflow = {
  id: 'template_e',
  name: '剧本打磨',
  sourceWorkflowId: '',
  nodes: nodesE,
  connections: connectionsE,
  executionMode: 'step_by_step',
  waitPoints: ['planner_1', 'episode_1'],
  createdAt: 0,
};

// ── Exports ───────────────────────────────────────────────
export const WORKFLOW_TEMPLATES: FixedWorkflow[] = [
  templateA, templateB, templateC, templateD, templateE,
];

export function getTemplateById(id: string): FixedWorkflow | undefined {
  return WORKFLOW_TEMPLATES.find(t => t.id === id);
}

// ── Import / Export & User Templates ─────────────────────

/** 导出模板为 JSON 字符串 */
export function exportTemplate(template: FixedWorkflow): string {
  return JSON.stringify(template, null, 2);
}

/** 从 JSON 字符串导入模板 */
export function importTemplate(json: string): FixedWorkflow | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.id || !parsed.name || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.connections)) {
      return null;
    }
    return { ...parsed, id: `imported_${Date.now()}`, createdAt: Date.now() };
  } catch {
    return null;
  }
}

/** 用户自建模板存储（内存，TODO: 持久化到 IndexedDB） */
const userTemplates: FixedWorkflow[] = [];

export function addUserTemplate(template: FixedWorkflow): void {
  userTemplates.push(template);
}

export function getUserTemplates(): FixedWorkflow[] {
  return [...userTemplates];
}

export function getAllTemplates(): FixedWorkflow[] {
  return [...WORKFLOW_TEMPLATES, ...userTemplates];
}

export function removeUserTemplate(id: string): boolean {
  const idx = userTemplates.findIndex(t => t.id === id);
  if (idx >= 0) { userTemplates.splice(idx, 1); return true; }
  return false;
}
