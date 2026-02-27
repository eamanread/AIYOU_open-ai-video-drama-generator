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
import { generateDetailedStoryboard } from '../geminiService';

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
    // 1. 从上游获取剧本内容（兼容 text 与 structured-script）
    const allInputs = this.getInputData(node, context);
    const content = this.resolveScriptContent(this.getSingleInput(node, context), allInputs);
    if (!content || content.trim().length < 20) {
      return this.createErrorResult('剧本内容不足（至少 20 字），请检查上游节点输出');
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

  private async generateStoryboard(
    title: string,
    content: string,
    duration: number,
    visualStyle: string,
  ): Promise<any[]> {
    const shots = await generateDetailedStoryboard(
      title,
      content,
      duration,
      visualStyle,
    );
    if (!shots?.length) {
      throw new Error('未生成任何分镜，请检查剧本内容');
    }
    return shots;
  }

  private resolveScriptContent(primaryInput: any, allInputs: any[]): string {
    if (typeof primaryInput === 'string') return primaryInput;
    if (primaryInput?.prompt && typeof primaryInput.prompt === 'string') return primaryInput.prompt;
    if (primaryInput?.episodes && Array.isArray(primaryInput.episodes)) {
      return this.structuredToText(primaryInput);
    }
    if (primaryInput?.structured) {
      return this.structuredToText(primaryInput.structured);
    }

    const structured = allInputs.find((d: any) => d?.structured)?.structured
      || allInputs.find((d: any) => d?.episodes && Array.isArray(d.episodes));
    if (structured) {
      return this.structuredToText(structured);
    }

    const textLike = allInputs.find((d: any) => typeof d === 'string' && d.trim().length > 0);
    return textLike || '';
  }

  private structuredToText(structured: any): string {
    const title = structured?.title || '未命名';
    const episodeTexts = (structured?.episodes || []).map((ep: any, idx: number) => {
      const scenes = (ep?.scenes || []).map((s: any) => {
        const dialogue = s.dialogue ? `对白: ${s.dialogue}` : '';
        return `${s.location || '未知场景'} ${s.timeOfDay || ''} ${s.description || ''} ${dialogue}`.trim();
      }).join('\n');
      return `第${idx + 1}集\n${scenes}`;
    }).join('\n\n');
    return `# ${title}\n${episodeTexts}`.trim();
  }
}
