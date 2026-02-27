/**
 * VIDEO_ANALYZER 节点服务
 * 分析视频内容，输出文本分析结果供下游节点消费
 */

import { AppNode, NodeType, PortSchema } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';
import { llmProviderManager } from '../llmProviders';

export class VideoAnalyzerService extends BaseNodeService {
  readonly nodeType = NodeType.VIDEO_ANALYZER;

  readonly inputSchema: PortSchema[] = [
    { key: 'video', type: 'video-url', label: '视频', required: true },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'analysis', type: 'text', label: '分析结果', required: true },
  ];

  async execute(
    node: AppNode,
    context: NodeExecutionContext,
  ): Promise<NodeExecutionResult> {
    // 1. 获取视频 URL：优先取节点自身配置，其次取上游输入
    const videoUrl: string | undefined =
      node.data.videoUrl || this.getSingleInput(node, context);

    if (!videoUrl) {
      return this.createErrorResult('缺少视频 URL，请连接上游节点或手动填写');
    }

    // 2. 调用分析（占位）
    try {
      const analysis = await this.analyzeVideo(videoUrl);

      // 3. 回写节点数据
      this.updateNodeData(node.id, { analysis }, context);

      // 4. 返回成功
      return this.createSuccessResult({ analysis }, { analysis });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '视频分析失败';
      return this.createErrorResult(msg);
    }
  }

  /**
   * 调用 LLM 多模态 API 分析视频
   */
  private async analyzeVideo(videoUrl: string): Promise<string> {
    const prompt = [
      '请分析这段视频，从以下维度输出结构化结果：',
      '1. 场景描述：画面中的主要元素和环境',
      '2. 情绪基调：整体氛围和情感倾向',
      '3. 节奏评估：剪辑节奏是快/中/慢',
      '4. 镜头语言：使用了哪些镜头技法（推拉摇移跟等）',
      '5. 改进建议：可优化的方向',
    ].join('\n');

    const result = await llmProviderManager.generateContent(prompt, {
      mediaUrl: videoUrl,
      mediaType: 'video/mp4',
    });

    return result || '视频分析未返回结果';
  }
}
