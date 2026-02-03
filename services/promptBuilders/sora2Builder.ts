/**
 * Sora 2 专用提示词构建器
 * 生成 Sora 2 Story Mode 格式，支持黑色空镜作为开头
 */

import { SplitStoryboardShot } from '../../types';
import { PromptBuilder, PromptBuilderOptions } from './types';
import { getUserDefaultModel } from '../modelConfig';
import { logAPICall } from '../apiLogger';
import { llmProviderManager } from '../llmProviders';

/**
 * Sora2 提示词构建器
 */
export class Sora2PromptBuilder implements PromptBuilder {
  readonly name = 'sora2';
  readonly supportedModels = ['sora' as const];

  /**
   * 构建 Sora 2 提示词
   */
  async build(
    shots: SplitStoryboardShot[],
    options?: PromptBuilderOptions
  ): Promise<string> {
    const {
      includeBlackScreen = true,
      blackScreenDuration = 0.5
    } = options || {};

    if (shots.length === 0) {
      throw new Error('至少需要一个分镜');
    }

    // 构建完整的分镜信息
    const shotsInfo = shots.map((shot, index) => {
      return `
镜头 ${shot.shotNumber} (${shot.duration}秒)
- 景别: ${shot.shotSize}
- 拍摄角度: ${shot.cameraAngle}
- 运镜方式: ${shot.cameraMovement}
- 场景: ${shot.scene || '未指定'}
- 视觉描述: ${shot.visualDescription}
- 对话: ${shot.dialogue || '无'}
- 视觉特效: ${shot.visualEffects || '无'}
- 音效: ${shot.audioEffects || '无'}`;
    }).join('\n');

    const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);

    // 构建 AI 提示词
    const userPrompt = `你是一位专业的 Sora 2 提示词生成器。你的任务是将分镜信息转换为 Sora 2 Story Mode 格式。

分镜信息：
${shotsInfo}

总时长：约 ${totalDuration.toFixed(1)} 秒

输出要求：
1. 只输出 Sora 2 Story Mode 格式
2. ${includeBlackScreen ? `必须以 ${blackScreenDuration}s 的黑色空镜开始（Shot 1）` : '必须以 Shot 1 开始（第一个实际分镜）'}
3. 不要添加任何前缀、后缀、说明、建议或解释
4. 不要使用 "---" 分隔线
5. 不要添加"导演建议"、"色彩控制"等额外内容
6. ${includeBlackScreen ? 'Shot 1 是黑色空镜，Shot 2 是第一个实际分镜' : '直接开始输出 Shot 1'}

输出格式：
${includeBlackScreen ? `Shot 1:
duration: ${blackScreenDuration.toFixed(1)}s
Scene: A completely black empty shot, pure black screen, no visual content

Shot 2:` : `Shot 1:`}
duration: X.Xs
Scene: [${includeBlackScreen ? '第一个' : ''}镜头的场景描述]

${includeBlackScreen ? 'Shot 3:' : 'Shot 2:'}
duration: X.Xs
Scene: [第二个镜头的场景描述]`;

    const systemPrompt = `你是一个 Sora 2 提示词格式化工具。只负责将分镜信息转换为指定格式，不添加任何额外内容。`;

    try {
      return await logAPICall(
        'Sora2PromptBuilder.build',
        async () => {
          const modelName = getUserDefaultModel('text');

          // 使用 llmProviderManager 统一调用，支持 Gemini 和云雾 API
          const text = await llmProviderManager.generateContent(
            systemPrompt + '\n\n' + userPrompt,
            modelName,
            {
              systemInstruction: systemPrompt
            }
          );

          if (!text) return this.buildBasicPrompt(shots, includeBlackScreen, blackScreenDuration);

          // 清理多余内容
          const cleanedText = this.cleanSoraPrompt(text);

          // 检查是否需要添加黑色空镜
          if (includeBlackScreen && !this.hasBlackScreen(cleanedText)) {
            return this.prependBlackScreen(cleanedText, blackScreenDuration);
          }

          return cleanedText;
        },
        {
          model: getUserDefaultModel('text'),
          prompt: userPrompt.substring(0, 200),
          options: {
            shotCount: shots.length,
            totalDuration: shots.reduce((sum, s) => sum + s.duration, 0),
            includeBlackScreen,
            blackScreenDuration
          }
        },
        { nodeId: 'sora2-builder', nodeType: 'SORA2_PROMPT_BUILDER', platform: llmProviderManager.getCurrentProvider().getName() }
      );
    } catch (error: any) {
      console.error('[Sora2PromptBuilder] AI enhancement failed, using basic prompt:', error);
      return this.buildBasicPrompt(shots, includeBlackScreen, blackScreenDuration);
    }
  }

  /**
   * 清理 AI 生成的提示词，去除多余内容
   */
  private cleanSoraPrompt(text: string): string {
    let cleaned = text.trim();

    // 移除常见的前缀
    const prefixesToRemove = [
      '好的，', '好的。', '以下是', '这是', '根据要求', '为你生成',
      '优化后的', '这是优化后的', '以下是优化后的', '你好', '你好，我是',
      '作为导演', '作为专业的', 'Sure,', 'Here is', 'Certainly,', 'I will', 'Let me'
    ];

    for (const prefix of prefixesToRemove) {
      if (cleaned.startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }

    // 确保以 "Shot 1:" 开头
    if (!cleaned.startsWith('Shot 1:')) {
      const shot1Index = cleaned.indexOf('Shot 1:');
      if (shot1Index !== -1) {
        cleaned = cleaned.substring(shot1Index).trim();
      } else {
        const firstShotMatch = cleaned.match(/Shot \d+:/);
        if (firstShotMatch) {
          cleaned = cleaned.substring(firstShotMatch.index).trim();
        }
      }
    }

    // 移除 markdown 代码块标记
    cleaned = cleaned.replace(/```[\w]*\n?/g, '').trim();

    // 移除分隔线和额外内容
    const separatorIndex = cleaned.indexOf('\n---');
    if (separatorIndex !== -1) {
      cleaned = cleaned.substring(0, separatorIndex).trim();
    }

    const lines = cleaned.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###')) return false;
      if (trimmed === '---' || trimmed.match(/^--+$/)) return false;
      return true;
    });

    cleaned = filteredLines.join('\n').trim();

    return cleaned;
  }

  /**
   * 检查提示词是否包含黑色空镜
   */
  private hasBlackScreen(prompt: string): boolean {
    return prompt.toLowerCase().includes('black screen') ||
           prompt.toLowerCase().includes('black empty shot');
  }

  /**
   * 在提示词前面添加黑色空镜
   */
  private prependBlackScreen(prompt: string, duration: number): string {
    const blackScreenShot = `Shot 1:
duration: ${duration.toFixed(1)}s
Scene: A completely black empty shot, pure black screen, no visual content

`;
    return blackScreenShot + prompt;
  }

  /**
   * 构建基础提示词（回退方案）
   * 保留完整的分镜信息（景别、角度、运镜、场景、特效、对话、音效）
   */
  private buildBasicPrompt(
    shots: SplitStoryboardShot[],
    includeBlackScreen: boolean,
    blackScreenDuration: number
  ): string {
    let result = '';

    // 添加黑色空镜
    if (includeBlackScreen) {
      result += `Shot 1:
duration: ${blackScreenDuration.toFixed(1)}s
Scene: A completely black empty shot, pure black screen, no visual content

`;
    }

    // 添加实际分镜（完整信息）
    const startIndex = includeBlackScreen ? 2 : 1;
    const actualShots = shots.map((shot, index) => {
      const duration = shot.duration || 5;
      const shotNumber = startIndex + index;

      // 构建完整的 Scene 描述，保留所有分镜信息
      const sceneParts: string[] = [];

      if (shot.shotSize) sceneParts.push(shot.shotSize);  // 景别
      if (shot.cameraAngle) sceneParts.push(shot.cameraAngle);  // 拍摄角度
      if (shot.cameraMovement) sceneParts.push(shot.cameraMovement);  // 运镜方式
      if (shot.visualDescription) sceneParts.push(shot.visualDescription);  // 视觉描述
      if (shot.visualEffects && shot.visualEffects !== '无') {
        sceneParts.push(`[${shot.visualEffects}]`);  // 视觉特效
      }
      if (shot.dialogue && shot.dialogue !== '无') {
        sceneParts.push(`"${shot.dialogue}"`);  // 对话
      }
      if (shot.audioEffects && shot.audioEffects !== '无') {
        sceneParts.push(`[${shot.audioEffects}]`);  // 音效
      }

      const scene = sceneParts.join('. ') || shot.visualDescription || '';

      return `Shot ${shotNumber}:
duration: ${duration.toFixed(1)}s
Scene: ${scene}`;
    }).join('\n\n');

    return result + actualShots;
  }
}
