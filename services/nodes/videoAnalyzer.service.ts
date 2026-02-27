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
   * 视频分析占位方法，待接入实际 API
   */
  private async analyzeVideo(videoUrl: string): Promise<string> {
    // TODO: integrate actual video analysis API
    console.log(`[VideoAnalyzer] 待分析视频: ${videoUrl.slice(0, 80)}`);
    return 'Mock 视频分析结果';
  }
}
