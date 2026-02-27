/**
 * 连线端口兼容性检查
 * 校验两个节点的输出端口和输入端口是否类型匹配
 */

import { Connection, AppNode } from '../types';
import { PortSchema } from '../types';
import { NodeServiceRegistry } from './nodes/index';

/** 万能兼容类型，可连接任何接受文本的端口 */
const UNIVERSAL_TYPE = 'text';

/**
 * 检查两个端口类型是否兼容
 */
export function isPortCompatible(
  outputType: string,
  inputType: string
): boolean {
  if (outputType === inputType) return true;
  if (outputType === UNIVERSAL_TYPE) return true;
  if (inputType === UNIVERSAL_TYPE) return true;
  return false;
}

/**
 * 校验一条新连线是否合法
 * 返回 { valid, reason }
 */
export function validateConnection(
  conn: Connection,
  nodes: AppNode[],
  existingConnections: Connection[]
): { valid: boolean; reason?: string } {
  // 1. 不能自连
  if (conn.from === conn.to) {
    return { valid: false, reason: '不能连接到自身' };
  }

  // 2. 节点必须存在
  const fromNode = nodes.find(n => n.id === conn.from);
  const toNode = nodes.find(n => n.id === conn.to);
  if (!fromNode || !toNode) {
    return { valid: false, reason: '节点不存在' };
  }

  // 3. 不能重复连线（同 from+to+端口）
  const duplicate = existingConnections.some(
    c => c.from === conn.from && c.to === conn.to
      && (c.fromPort ?? 'default') === (conn.fromPort ?? 'default')
      && (c.toPort ?? 'default') === (conn.toPort ?? 'default')
  );
  if (duplicate) {
    return { valid: false, reason: '连线已存在' };
  }

  // 4. 端口类型兼容性检查
  const fromService = NodeServiceRegistry.get(fromNode.type);
  const toService = NodeServiceRegistry.get(toNode.type);

  if (fromService && toService) {
    const fromPortKey = conn.fromPort ?? 'default';
    const toPortKey = conn.toPort ?? 'default';

    const outPort = fromService.outputSchema.find(p => p.key === fromPortKey);
    const inPort = toService.inputSchema.find(p => p.key === toPortKey);

    if (outPort && inPort && !isPortCompatible(outPort.type, inPort.type)) {
      return { valid: false, reason: `类型不兼容: ${outPort.type} → ${inPort.type}` };
    }
  }

  return { valid: true };
}
