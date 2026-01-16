/**
 * 角色生成提示词管理服务
 * 支持中英文切换和同步编辑
 */

export interface PromptPair {
  zh: string;
  en: string;
}

export interface CharacterPrompts {
  expressionPrompt: PromptPair;
  threeViewPrompt: PromptPair;
}

// 默认提示词模板
const DEFAULT_EXPRESSION_PROMPT: PromptPair = {
  zh: `3D动漫风格，风格化渲染，3D动漫美学。

构图：特写肖像，仅头部和肩部，专注于面部表情。

角色面部表情参考表，3×3网格布局，展示9种不同的面部表情（喜悦、愤怒、悲伤、惊讶、恐惧、厌恶、中性、思考、疲惫）。

角色面部描述：{APPEARANCE}

关键约束：
- 仅特写肖像镜头（头部和肩部）
- 无全身、无下半身、无腿部
- 专注于面部特征、表情和头部
- 纯色平背景 - 仅纯色背景（白色、浅灰色或黑色），无图案、无渐变、无环境元素
- 所有9个表情中保持一致的角色设计
- 3×3网格构图`,

  en: `3D animated character, stylized 3D render, toon shading, artistic rendering, 3D anime aesthetics.

PORTRAIT COMPOSITION: Extreme close-up, head and shoulders only, facial expressions focus.

Character facial expressions reference sheet, 3x3 grid layout showing 9 different facial expressions (joy, anger, sorrow, surprise, fear, disgust, neutral, thinking, tired).

Character Face Description: {APPEARANCE}

CRITICAL CONSTRAINTS:
- Close-up portrait shots ONLY (head and shoulders)
- NO full body, NO lower body, NO legs
- Focus on facial features, expressions, and head
- SOLID FLAT BACKGROUND - Plain solid color background ONLY (white, light gray, or black). NO patterns, NO gradients, NO environmental elements
- Consistent character design across all 9 expressions
- 3x3 grid composition`
};

const DEFAULT_THREE_VIEW_PROMPT: PromptPair = {
  zh: `3D动漫风格，风格化渲染，3D动漫美学。

角色三视图生成任务：生成角色三视图参考表（正视图、侧视图、后视图）。

角色描述：{APPEARANCE}
属性：{STATS}

构图：
- 创建垂直布局，包含3个视图：正视图、侧视图（侧面）、后视图
- 全身站立姿势，中性表情
- 纯色平背景 - 仅纯色背景（白色、浅灰色或黑色），无图案、无渐变、无环境元素
- 每个视图应清晰显示指定角度的角色

关键要求：
1. 一致的角色设计 - 三个视图必须显示相同的角色，面部特征、发型、身体比例和服装保持一致
2. 无文本、无标签 - 纯图像，无"正视图"或"侧视图"文字标签
3. 正确的解剖结构 - 确保每个视角的正确身体比例和自然姿势
4. 中性表情 - 在所有视图中使用平静、中性的面部表情
5. 清晰对齐 - 正视图、侧视图和后视图应垂直对齐且比例一致

参考图片：使用表情图作为面部和服装细节的视觉参考。`,

  en: `3D animated character, stylized 3D render, toon shading, artistic rendering, 3D anime aesthetics.

CHARACTER THREE-VIEW GENERATION TASK:
Generate a character three-view reference sheet (front, side, back views).

Character Description: {APPEARANCE}
Attributes: {STATS}

COMPOSITION:
- Create a vertical layout with 3 views: Front View, Side View (profile), Back View
- Full body standing pose, neutral expression
- SOLID FLAT BACKGROUND - Plain solid color background ONLY (white, light gray, or black). NO patterns, NO gradients, NO environmental elements
- Each view should clearly show the character from the specified angle

CRITICAL REQUIREMENTS:
1. CONSISTENT CHARACTER DESIGN - All three views must show the SAME character with consistent facial features, hair style, body proportions, and clothing
2. NO TEXT, NO LABELS - Pure image only, no "Front View" or "Side View" text labels
3. PROPER ANATOMY - Ensure correct body proportions and natural stance for each view angle
4. NEUTRAL EXPRESSION - Use a calm, neutral face expression across all views
5. CLEAR ALIGNMENT - Front, side, and back views should be vertically aligned and proportionally consistent

REFERENCE IMAGE: Use the expression sheet as visual reference for face and clothing details.`
};

class PromptManager {
  /**
   * 生成九宫格表情提示词
   */
  buildExpressionPrompt(
    stylePrompt: string,
    profile: any,
    customPrompt?: PromptPair
  ): { zh: string; en: string } {
    const basePrompt = customPrompt || DEFAULT_EXPRESSION_PROMPT;
    const appearance = profile?.appearance || profile?.basicStats || 'Detailed character appearance';
    const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui, full body, standing, legs, feet, full-length portrait, wide shot, environmental background, patterned background, gradient background, photorealistic, realistic skin texture, subsurface scattering, skin details, photo, photography, hyperrealistic";

    return {
      zh: `${stylePrompt}\n\n${basePrompt.zh.replace('{APPEARANCE}', appearance)}\n\n负面提示词：${negativePrompt}`,
      en: `${stylePrompt}\n\n${basePrompt.en.replace('{APPEARANCE}', appearance)}\n\nNegative Prompt: ${negativePrompt}`
    };
  }

  /**
   * 生成三视图提示词
   */
  buildThreeViewPrompt(
    stylePrompt: string,
    profile: any,
    customPrompt?: PromptPair
  ): { zh: string; en: string } {
    const basePrompt = customPrompt || DEFAULT_THREE_VIEW_PROMPT;
    const appearance = profile?.appearance || profile?.basicStats || 'Detailed character appearance';
    const stats = profile?.basicStats || profile?.profession || 'Character attributes';
    const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui, username, website, chinese characters, english text, patterned background, gradient background, scenery, environmental background, shadows on background, photorealistic, realistic skin texture, subsurface scattering";

    return {
      zh: `${stylePrompt}\n\n${basePrompt.zh.replace('{APPEARANCE}', appearance).replace('{STATS}', stats)}\n\n负面提示词：${negativePrompt}`,
      en: `${stylePrompt}\n\n${basePrompt.en.replace('{APPEARANCE}', appearance).replace('{STATS}', stats)}\n\nNegative Prompt: ${negativePrompt}`
    };
  }

  /**
   * 同步中英文提示词（当一边编辑时，保持另一边结构一致）
   */
  syncPrompt(
    sourceLang: 'zh' | 'en',
    sourceText: string,
    targetText: string
  ): string {
    // 简单实现：检测新增或删除的行数，在目标文本中做相应调整
    const sourceLines = sourceText.split('\n');
    const targetLines = targetText.split('\n');
    const sourceLineCount = sourceLines.length;
    const targetLineCount = targetLines.length;

    // 如果行数相同，不做调整
    if (sourceLineCount === targetLineCount) {
      return targetText;
    }

    // 如果源文本行数多于目标文本，在目标文本末尾添加空行
    if (sourceLineCount > targetLineCount) {
      const diff = sourceLineCount - targetLineCount;
      return targetText + '\n'.repeat(diff);
    }

    // 如果源文本行数少于目标文本，从目标文本末尾删除行
    if (sourceLineCount < targetLineCount) {
      const diff = targetLineCount - sourceLineCount;
      return targetLines.slice(0, targetLineCount - diff).join('\n');
    }

    return targetText;
  }

  /**
   * 获取默认提示词
   */
  getDefaultPrompts(): CharacterPrompts {
    return {
      expressionPrompt: { ...DEFAULT_EXPRESSION_PROMPT },
      threeViewPrompt: { ...DEFAULT_THREE_VIEW_PROMPT }
    };
  }
}

export const promptManager = new PromptManager();
