/**
 * portLayout.ts — Technical Spike: Multi-port rendering for canvas nodes.
 * Replaces single center-point connections with named, typed ports.
 */

// --- Constants ---
const PORT_SPACING = 28;
const HEADER_HEIGHT = 48;
const DEFAULT_NODE_WIDTH = 420;

// --- Types ---

interface PortSchema {
  key: string;
  type: string;
  label: string;
  required: boolean;
}

export interface PortPosition {
  x: number;
  y: number;
  side: 'left' | 'right';
  portKey: string;
}

interface PortPositionMap {
  inputs: PortPosition[];
  outputs: PortPosition[];
}

interface ConnectionEndpoints {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface NodeRect {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface Connection {
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
}

// --- Port Position Calculation ---

/** Calculate pixel positions for all input/output ports on a node. */
export function calculatePortPositions(
  node: NodeRect,
  inputSchema: PortSchema[],
  outputSchema: PortSchema[]
): PortPositionMap {
  const w = node.width || DEFAULT_NODE_WIDTH;

  const toPositions = (schemas: PortSchema[], side: 'left' | 'right'): PortPosition[] =>
    schemas.map((s, i) => ({
      x: side === 'left' ? node.x - 3 : node.x + w + 3,
      y: node.y + HEADER_HEIGHT + i * PORT_SPACING,
      side,
      portKey: s.key,
    }));

  return {
    inputs: toPositions(inputSchema, 'left'),
    outputs: toPositions(outputSchema, 'right'),
  };
}

// --- Connection Endpoints ---

/** Resolve pixel start/end for a connection. Falls back to center-point if no port specified. */
export function getConnectionEndpoints(
  conn: Connection,
  fromNode: NodeRect,
  toNode: NodeRect,
  fromOutputSchema: PortSchema[],
  toInputSchema: PortSchema[]
): ConnectionEndpoints {
  const fromW = fromNode.width || DEFAULT_NODE_WIDTH;
  const fromH = fromNode.height || 200;
  const toH = toNode.height || 200;

  const fromPorts = calculatePortPositions(fromNode, [], fromOutputSchema);
  const toPorts = calculatePortPositions(toNode, toInputSchema, []);

  const start = (conn.fromPort && fromPorts.outputs.find(p => p.portKey === conn.fromPort))
    || { x: fromNode.x + fromW + 3, y: fromNode.y + fromH / 2 };

  const end = (conn.toPort && toPorts.inputs.find(p => p.portKey === conn.toPort))
    || { x: toNode.x - 3, y: toNode.y + toH / 2 };

  return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } };
}

// --- Port Styling ---

const PORT_COLORS: Record<string, string> = {
  'structured-script': '#22d3ee',
  'style-config':      '#a855f7',
  'char-assets':       '#f59e0b',
  'scene-assets':      '#10b981',
  'storyboard-shots':  '#3b82f6',
  'video-prompt':      '#ef4444',
};

/** Return a CSS color string for a given port data type. */
export function getPortColor(portType: string): string {
  return PORT_COLORS[portType] || '#6b7280';
}

// --- Port Compatibility ---

/** Extra compatibility beyond exact-match (exact match is always allowed). */
const COMPAT_MAP: Record<string, string[]> = {
  'storyboard-shots': ['structured-script'],
  'video-prompt':     ['storyboard-shots'],
};

/** Check whether an output port type can connect to an input port type. */
export function isPortCompatible(outputType: string, inputType: string): boolean {
  if (outputType === inputType) return true;
  return COMPAT_MAP[inputType]?.includes(outputType) ?? false;
}
