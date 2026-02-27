/**
 * DRAMA_ANALYZER 节点服务
 * 读取剧目信息，按用户勾选的分析维度提取精炼标签
 * 子节点（DRAMA_REFINED）创建仍由 UI 层负责
 */

import { AppNode, NodeType, PortSchema } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';
import { analyzeDrama } from '../geminiService';

const ANALYSIS_FIELDS: Record<string, string> = {
  dramaIntroduction: '剧集介绍',
  worldview: '世界观分析',
  logicalConsistency: '逻辑自洽性',
  extensibility: '延展性分析',
  characterTags: '角色标签',
  protagonistArc: '主角弧光',
  audienceResonance: '受众共鸣点',
  artStyle: '画风分析',
};

const ALL_FIELD_KEYS = Object.keys(ANALYSIS_FIELDS);

export class DramaAnalyzerService extends BaseNodeService {
  readonly nodeType = NodeType.DRAMA_ANALYZER;

  readonly inputSchema: PortSchema[] = [
    { key: 'text', type: 'text', label: '剧目信息', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'analysis', type: 'text', label: '分析结果', required: true },
  ];

  async execute(
    node: AppNode,
    context: NodeExecutionContext,
  ): Promise<NodeExecutionResult> {
    // 1. 读取勾选的分析维度，缺省全选
    const selectedFields: string[] =
      node.data.selectedFields?.length ? node.data.selectedFields : ALL_FIELD_KEYS;

    // 2. 至少勾选一项
    if (selectedFields.length === 0) {
      return this.createErrorResult('请先勾选需要提取的分析项');
    }

    // 3. 获取剧目名称
    const upstream = this.getSingleInput(node, context);
    const dramaName: string = upstream ?? node.data.prompt ?? '';
    if (!dramaName.trim()) {
      return this.createErrorResult('请输入剧目名称');
    }

    // 4. 调用分析提取
    try {
      const results = await this.extractAnalysis(dramaName, selectedFields);

      // 4. 格式化为可读文本
      const formattedText = selectedFields
        .map((f) => `【${ANALYSIS_FIELDS[f] || f}】\n${results[f] ?? '—'}`)
        .join('\n\n');

      const refinedContent = Object.fromEntries(
        selectedFields.map((f) => [f, results[f] ?? '']),
      );

      return this.createSuccessResult(
        { refinedContent, selectedFields },
        { analysis: formattedText },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '剧目分析失败';
      return this.createErrorResult(msg);
    }
  }

  private async extractAnalysis(
    dramaName: string,
    fields: string[],
  ): Promise<Record<string, string>> {
    const analysis = await analyzeDrama(dramaName);
    // Extract selected fields from the analysis result
    const results: Record<string, string> = {};
    for (const field of fields) {
      const value = (analysis as any)[field];
      results[field] = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    }
    return results;
  }
}
