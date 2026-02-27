/**
 * SCRIPT_PLANNER 节点服务
 * 接收创作提示 + 可选的 DRAMA_REFINED 精炼信息，调用 LLM 生成剧本大纲
 */

import { AppNode, NodeType, PortSchema } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';
import { generateScriptPlanner } from '../geminiService';

export class ScriptPlannerService extends BaseNodeService {
  readonly nodeType = NodeType.SCRIPT_PLANNER;

  readonly inputSchema: PortSchema[] = [
    { key: 'prompt', type: 'text', label: '创作提示', required: false },
    { key: 'refined', type: 'text', label: '精炼参考', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'outline', type: 'text', label: '剧本大纲', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. prompt: 优先上游输入，其次 node.data.prompt
    const upstream = this.getSingleInput(node, context);
    const prompt: string = upstream ?? node.data.prompt ?? '';

    // 2. 可选: 从上游 DRAMA_REFINED 节点获取精炼信息
    const refinedNode = context.nodes.find(
      (n) => n.type === NodeType.DRAMA_REFINED &&
        context.connections.some((c) => c.from === n.id && c.to === node.id),
    );
    const refinedInfo = refinedNode
      ? context.getInputData(refinedNode.id)
      : undefined;

    // 3. 读取节点配置
    const config = {
      scriptTheme: node.data.scriptTheme,
      scriptGenre: node.data.scriptGenre,
      scriptSetting: node.data.scriptSetting,
      scriptEpisodes: node.data.scriptEpisodes,
      scriptDuration: node.data.scriptDuration,
      scriptVisualStyle: node.data.scriptVisualStyle,
    };

    try {
      const outline = await this.callLLM(prompt, config, refinedInfo);

      // 4. 回写节点数据
      this.updateNodeData(node.id, { scriptOutline: outline }, context);

      // 5. 返回成功
      return this.createSuccessResult({ scriptOutline: outline }, { outline });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '剧本大纲生成失败';
      return this.createErrorResult(msg);
    }
  }

  private async callLLM(prompt: string, config: any, refinedInfo: any): Promise<string> {
    const apiConfig = {
      theme: config.scriptTheme,
      genre: config.scriptGenre,
      setting: config.scriptSetting,
      episodes: config.scriptEpisodes,
      duration: config.scriptDuration,
      visualStyle: config.scriptVisualStyle,
    };
    const outline = await generateScriptPlanner(prompt, apiConfig, refinedInfo);
    if (!outline?.trim()) {
      throw new Error('大纲生成为空，请检查 API 配置');
    }
    return outline;
  }
}
