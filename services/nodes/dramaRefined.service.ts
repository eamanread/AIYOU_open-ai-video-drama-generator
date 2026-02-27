/**
 * DRAMA_REFINED 节点服务
 * 承接 DRAMA_ANALYZER 的精炼/提取内容，作为数据中转供下游节点（如 SCRIPT_PLANNER）消费
 */

import { AppNode, NodeType, PortSchema } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';

export class DramaRefinedService extends BaseNodeService {
  readonly nodeType = NodeType.DRAMA_REFINED;

  readonly inputSchema: PortSchema[] = [
    { key: 'analysis', type: 'text', label: '分析数据', required: true },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'refined', type: 'text', label: '精炼内容', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. 优先读取节点自身数据（由 DRAMA_ANALYZER UI 动作预填充）
    let refinedContent = (node.data as any).refinedContent;

    // 2. 若节点自身无数据，尝试从上游获取
    if (!refinedContent) {
      refinedContent = this.getSingleInput(node, context);
    }

    if (!refinedContent) {
      return this.createErrorResult('未获取到精炼内容，请先运行剧本分析节点');
    }

    const formattedText = this.formatRefinedContent(refinedContent);

    this.updateNodeData(node.id, { refinedContent }, context);
    return this.createSuccessResult({ refinedContent }, { refined: formattedText });
  }

  private formatRefinedContent(content: any): string {
    if (typeof content === 'string') return content;
    if (!content) return '';

    const parts: string[] = [];
    if (content.characterTags?.length) parts.push(`角色标签: ${content.characterTags.join(', ')}`);
    if (content.worldview) parts.push(`世界观: ${content.worldview}`);
    if (content.protagonistArc) parts.push(`主角弧光: ${content.protagonistArc}`);
    if (content.theme) parts.push(`主题: ${content.theme}`);
    if (content.plotSummary) parts.push(`剧情概要: ${content.plotSummary}`);
    if (content.emotionalTone) parts.push(`情感基调: ${content.emotionalTone}`);
    if (content.keyConflicts) parts.push(`核心冲突: ${content.keyConflicts}`);

    return parts.join('\n\n');
  }
}
