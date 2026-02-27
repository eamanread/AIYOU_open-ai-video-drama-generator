/**
 * STORYBOARD_GENERATOR 节点服务
 * 接收剧本内容，生成分镜数据（EpisodeStoryboard）
 * 从上游获取剧本文本，结合时长与画风配置输出 shots 列表
 */

import { AppNode, NodeType, PortSchema } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';

export class StoryboardGeneratorService extends BaseNodeService {
  readonly nodeType = NodeType.STORYBOARD_GENERATOR;

  readonly inputSchema: PortSchema[] = [
    { key: 'script', type: 'text', label: '剧本内容', required: true },
    { key: 'style', type: 'style-config', label: '画风配置', required: false },
    { key: 'characters', type: 'char-assets', label: '角色资产', required: false },
    { key: 'scenes', type: 'scene-assets', label: '场景资产', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'storyboard', type: 'storyboard-shots', label: '分镜数据', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. 从上游获取剧本内容
    const content: string | undefined = this.getSingleInput(node, context);
    if (!content || content.trim().length < 50) {
      return this.createErrorResult('剧本内容不足（至少 50 字），请检查上游节点输出');
    }

    // 2. 提取集标题（首行）
    const firstLine = content.trim().split('\n')[0];
    const episodeTitle = firstLine.replace(/^#+\s*/, '').trim() || '未命名分集';

    // 3. 读取节点配置，兜底默认值
    const duration: number = node.data?.duration ?? 60;
    const visualStyle: string = node.data?.visualStyle ?? 'ANIME';

    try {
      // 4. 生成分镜
      const shots = await this.generateStoryboard(episodeTitle, content, duration, visualStyle);

      // 5. 组装输出
      const storyboard = {
        episodeTitle,
        totalDuration: duration,
        totalShots: shots.length,
        shots,
        visualStyle,
      };

      return this.createSuccessResult(storyboard, { storyboard });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分镜生成失败';
      return this.createErrorResult(msg);
    }
  }

  /**
   * 分镜生成（占位）
   * TODO: import { generateDetailedStoryboard } from '../geminiService';
   *       替换为实际 LLM 调用，传入 callback / model / context
   */
  private async generateStoryboard(
    title: string,
    content: string,
    duration: number,
    visualStyle: string,
  ): Promise<any[]> {
    console.log(`[StoryboardGenerator] mock, title=${title}, duration=${duration}s, style=${visualStyle}`);
    return [
      { id: 'shot_1', shotNumber: 1, duration: 4, shotSize: '中景', description: 'Mock镜头' },
    ];
  }
}
