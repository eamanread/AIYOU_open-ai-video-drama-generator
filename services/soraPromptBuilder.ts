/**
 * Sora 2 提示词构建服务
 * 参考 OpenAI 官方 Sora 2 Prompting Guide 最佳实践
 */

import { SplitStoryboardShot } from '../types';
import { getUserDefaultModel } from './modelConfig';
import { logAPICall } from './apiLogger';
import { getClient } from './geminiService';

/**
 * 构建专业的 Sora 2 视频提示词
 * 使用结构化方法，包含：风格、场景、摄影、动作、对话、音效
 */
export async function buildProfessionalSoraPrompt(shots: SplitStoryboardShot[]): Promise<string> {
  if (shots.length === 0) {
    throw new Error('至少需要一个分镜');
  }

  // 添加1秒空镜头到分镜信息开头
  const blackScreenInfo = `
空镜头 (1秒)
- 景别: 全黑
- 拍摄角度: 无
- 运镜方式: 固定
- 场景: 纯黑画面
- 视觉描述: 完全黑色的空镜头，无任何内容，纯黑画面
- 对话: 无
- 视觉特效: 无
- 音效: 无声`;

  // 构建完整的分镜信息（从镜头1开始，但实际输出时会变成Shot 2）
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

  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0) + 1; // 包含1秒空镜头

  const userPrompt = `你是一位专业的 Sora 2 提示词生成器。你的任务是将分镜信息转换为 Sora 2 Story Mode 格式。

分镜信息：
${blackScreenInfo}
${shotsInfo}

总时长：约 ${totalDuration.toFixed(1)} 秒（包含1秒空镜头）

输出要求：
1. 只输出 Sora 2 Story Mode 格式
2. 必须以 Shot 1（空镜头）开始
3. 不要添加任何前缀、后缀、说明、建议或解释
4. 不要使用 "---" 分隔线
5. 不要添加"导演建议"、"色彩控制"等额外内容
6. 直接开始输出 Shot 1

输出格式：
Shot 1:
duration: 1.0s
Scene: 完全黑色的空镜头，纯黑画面，无任何视觉内容，无声音

Shot 2:
duration: X.Xs
Scene: [第一个实际镜头的场景描述]

Shot 3:
duration: X.Xs
Scene: [第二个实际镜头的场景描述]`;

  const systemPrompt = `你是一个 Sora 2 提示词格式化工具。只负责将分镜信息转换为指定格式，不添加任何额外内容。`;

  try {
    return await logAPICall(
      'buildProfessionalSoraPrompt',
      async () => {
        const ai = getClient();
        const modelName = getUserDefaultModel('text');

        // 使用正确的 Gemini API 调用方式
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              { text: systemPrompt + '\n\n' + userPrompt }
            ]
          }
        });

        let text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return buildBasicSoraPrompt(shots);

        // 清理多余内容
        text = cleanSoraPrompt(text);
        return text;
      },
      {
        shotCount: shots.length,
        totalDuration: shots.reduce((sum, s) => sum + s.duration, 0),
        model: getUserDefaultModel('text'),
        promptPreview: userPrompt.substring(0, 200) + '...'
      },
      { nodeId: 'sora-generator', nodeType: 'SORA_VIDEO_GENERATOR' }
    );
  } catch (error: any) {
    console.error('[Sora Prompt Builder] AI enhancement failed, using basic prompt:', error);
    // 回退到基础提示词
    return buildBasicSoraPrompt(shots);
  }
}

/**
 * 清理 AI 生成的提示词，去除多余内容
 */
function cleanSoraPrompt(text: string): string {
  let cleaned = text.trim();

  // 移除常见的前缀
  const prefixesToRemove = [
    '好的，',
    '好的。',
    '以下是',
    '这是',
    '根据要求',
    '为你生成',
    '优化后的',
    '这是优化后的',
    '以下是优化后的',
    '你好',
    '你好，我是',
    '作为导演',
    '作为专业的',
    'Sure,',
    'Here is',
    'Certainly,',
    'I will',
    'Let me'
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
      // 如果没找到 Shot 1，尝试查找其他 Shot
      const firstShotMatch = cleaned.match(/Shot \d+:/);
      if (firstShotMatch) {
        cleaned = cleaned.substring(firstShotMatch.index).trim();
      }
    }
  }

  // 移除 markdown 代码块标记
  cleaned = cleaned.replace(/```[\w]*\n?/g, '').trim();

  // 移除 "---" 或更多的分隔线及其后的额外内容
  // 找到第一个 "---" 并移除它之后的所有内容
  const separatorIndex = cleaned.indexOf('\n---');
  if (separatorIndex !== -1) {
    cleaned = cleaned.substring(0, separatorIndex).trim();
  }

  // 移除 "### " 开头的章节（导演建议等）
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    // 跳过以 ### 开头的行（这通常是额外的建议章节）
    if (trimmed.startsWith('###')) return false;
    // 跳过只包含 "---" 的行
    if (trimmed === '---' || trimmed.match(/^--+$/)) return false;
    return true;
  });

  cleaned = filteredLines.join('\n').trim();

  // 移除末尾可能的分隔线和额外内容
  const lastShotIndex = cleaned.lastIndexOf('\nShot ');
  if (lastShotIndex !== -1) {
    // 保留到最后一个 Shot
    const afterLastShot = cleaned.substring(lastShotIndex + 1);
    // 检查是否有非 Shot 的内容
    if (afterLastShot.includes('\n#') || afterLastShot.includes('\n---')) {
      // 找到最后一个 Shot 的结束位置
      const nextNewline = afterLastShot.indexOf('\n', afterLastShot.indexOf('Scene:') + 6);
      if (nextNewline !== -1) {
        cleaned = cleaned.substring(0, lastShotIndex + nextNewline + 1).trim();
      }
    }
  }

  return cleaned;
}

/**
 * 构建基础 Sora 提示词（回退方案）
 */
function buildBasicSoraPrompt(shots: SplitStoryboardShot[]): string {
  // 在开头添加1秒空镜头
  const blackScreenShot = `Shot 1:
duration: 1.0s
Scene: 完全黑色的空镜头，纯黑画面，无任何视觉内容，完全静音`;

  // 原有分镜从 Shot 2 开始
  const actualShots = shots.map((shot, index) => {
    const duration = shot.duration || 5;
    const scene = shot.visualDescription || '';

    return `Shot ${index + 2}:
duration: ${duration.toFixed(1)}s
Scene: ${scene}`;
  }).join('\n\n');

  return blackScreenShot + '\n\n' + actualShots;
}

/**
 * 构建单个镜头的详细提示词（用于编辑界面预览）
 */
export function buildSingleShotPrompt(shot: SplitStoryboardShot): string {
  const parts: string[] = [];

  // 1. 场景描述
  if (shot.visualDescription) {
    parts.push(`Scene: ${shot.visualDescription}`);
  }

  // 2. 摄影信息
  const cinematography: string[] = [];
  if (shot.shotSize) cinematography.push(`shot size: ${shot.shotSize}`);
  if (shot.cameraAngle) cinematography.push(`angle: ${shot.cameraAngle}`);
  if (shot.cameraMovement) cinematography.push(`movement: ${shot.cameraMovement}`);

  if (cinematography.length > 0) {
    parts.push(`Cinematography:\nCamera: ${cinematography.join(', ')}`);
  }

  // 3. 动作
  if (shot.visualDescription) {
    parts.push(`Actions:\n- ${shot.visualDescription}`);
  }

  // 4. 对话
  if (shot.dialogue && shot.dialogue !== '无') {
    parts.push(`Dialogue:\n${shot.dialogue}`);
  }

  // 5. 音效
  if (shot.audioEffects && shot.audioEffects !== '无') {
    parts.push(`Background Sound:\n${shot.audioEffects}`);
  }

  return parts.join('\n\n');
}
