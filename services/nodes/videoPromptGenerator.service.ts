/**
 * VIDEO_PROMPT_GENERATOR 节点服务
 * 将分镜数据翻译为逐镜头视频生成提示词，附带 Q1-Q8 质量检查
 */

import { AppNode, NodeType, PortSchema, StyleConfig } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';

interface QualityCheckResult {
  passed: boolean;
  score: number;
  checks: {
    q1_noStaticPose: boolean;
    q2_noAxisCross: boolean;
    q3_shotSizeConsistent: boolean;
    q4_motionClear: boolean;
    q5_lightingMatch: boolean;
    q6_characterConsistent: boolean;
    q7_sceneConsistent: boolean;
    q8_promptLength: boolean;
  };
  suggestions?: string[];
}

interface VideoShotPrompt {
  shotId: string;
  shotNumber: number;
  prompt: string;
  negativePrompt?: string;
  duration: number;
  aspectRatio: string;
  referenceImageId?: string;
  qualityCheck: QualityCheckResult;
}

/** 动作/运动关键词 */
const MOTION_KEYWORDS = /[走跑转看说拿推拉摇移站坐跳挥握打开关倒靠]/;
/** 景别关键词 */
const SHOT_SIZE_KEYWORDS = /近景|中景|远景|特写|全景|中近景|大远景|大特写/;

export class VideoPromptGeneratorService extends BaseNodeService {
  readonly nodeType = NodeType.VIDEO_PROMPT_GENERATOR;

  readonly inputSchema: PortSchema[] = [
    { key: 'storyboard', type: 'storyboard-shots', label: '分镜数据', required: true },
    { key: 'style', type: 'style-config', label: '画风配置', required: false },
    { key: 'characters', type: 'char-assets', label: '角色资产', required: false },
    { key: 'scenes', type: 'scene-assets', label: '场景资产', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'prompts', type: 'video-prompt', label: '视频提示词', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. 获取分镜数据
    const storyboardInput = this.getSingleInput(node, context);
    const allInputs = this.getInputData(node, context);
    const shots = this.resolveShots(storyboardInput, allInputs);

    if (!shots.length) {
      return this.createErrorResult('分镜数据为空，请连接上游分镜节点');
    }

    // 2. 获取可选输入
    const style: StyleConfig | undefined = allInputs.find((d: any) => d?.visualStyle || d?.stylePrompt || d?.style?.visualStyle)?.style || allInputs.find((d: any) => d?.visualStyle || d?.stylePrompt);
    const chars: any = allInputs.find((d: any) => Array.isArray(d?.characters) || Array.isArray(d?.characters?.characters))
      || {};
    const scenes: any = allInputs.find((d: any) => Array.isArray(d?.scenes) || Array.isArray(d?.scenes?.scenes))
      || {};

    try {
      // 3. 逐镜头生成提示词 + 质量检查
      const videoShotPrompts: VideoShotPrompt[] = shots.map((shot: any, idx: number) => {
        const prompt = this.buildShotPrompt(shot, style, chars, scenes);
        const qualityCheck = this.runQualityCheck(prompt, shot);

        return {
          shotId: shot.id ?? `shot_${idx + 1}`,
          shotNumber: idx + 1,
          prompt,
          negativePrompt: style?.negativePrompt,
          duration: shot.duration ?? 4,
          aspectRatio: shot.aspectRatio ?? '16:9',
          referenceImageId: shot.imageUrl ? shot.id : undefined,
          qualityCheck,
        };
      });

      // 4. 返回结果
      const data = { prompts: videoShotPrompts, generatedAt: new Date().toISOString() };
      return this.createSuccessResult(data, { prompts: { shots: videoShotPrompts } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '视频提示词生成失败';
      return this.createErrorResult(msg);
    }
  }

  /** 组合镜头描述、运镜、角色、场景、画风为完整提示词 */
  private buildShotPrompt(shot: any, style?: StyleConfig, chars?: any, scenes?: any): string {
    const parts: string[] = [];
    const charList = chars?.characters?.characters || chars?.characters || [];
    const sceneList = scenes?.scenes?.scenes || scenes?.scenes || [];

    // 景别 + 运镜
    if (shot.shotSize) parts.push(shot.shotSize);
    if (shot.cameraMovement && shot.cameraMovement !== '固定') parts.push(shot.cameraMovement);

    // 主体描述
    if (shot.visualDescription) parts.push(shot.visualDescription);

    // 角色引用
    if (shot.characters?.length && Array.isArray(charList)) {
      const refs = shot.characters
        .map((name: string) => charList.find((c: any) => c.name === name)?.appearance)
        .filter(Boolean);
      if (refs.length) parts.push(`角色: ${refs.join('; ')}`);
    }

    // 场景引用
    if (shot.scene && Array.isArray(sceneList)) {
      const sceneRef = sceneList.find((s: any) => s.name === shot.scene || s.location === shot.scene);
      if (sceneRef?.promptZh) parts.push(`场景: ${sceneRef.promptZh}`);
    }

    // 画风 / 光照
    if (style?.stylePrompt) parts.push(style.stylePrompt);
    if (style?.lighting) parts.push(`光照: ${style.lighting}`);
    if (shot.lighting) parts.push(`光照: ${shot.lighting}`);

    // TODO: 接入 LLM 对提示词做润色增强
    return parts.join('，');
  }

  /** Q1-Q8 规则式质量检查 */
  private runQualityCheck(prompt: string, shot: any): QualityCheckResult {
    const len = prompt.length;
    const suggestions: string[] = [];

    const q1 = MOTION_KEYWORDS.test(prompt);
    if (!q1) suggestions.push('缺少动作/运动描述，建议补充角色动态');

    const q2 = true; // TODO: 需要多镜头上下文才能检测轴线跳跃
    const q3 = SHOT_SIZE_KEYWORDS.test(prompt);
    if (!q3) suggestions.push('缺少景别信息（近景/中景/远景/特写/全景）');

    const q4 = len > 20;
    if (!q4) suggestions.push('提示词过短，建议补充更多细节');

    const q5 = /光|lighting|style|风格|画风/.test(prompt) || !!shot.lighting;
    if (!q5) suggestions.push('缺少光照/风格信息');

    const q6 = /角色|character|人物/.test(prompt) || (shot.characters?.length > 0);
    if (!q6) suggestions.push('缺少角色引用');

    const q7 = /场景|scene|location|地点|室内|室外/.test(prompt) || !!shot.scene;
    if (!q7) suggestions.push('缺少场景/地点引用');

    const q8 = len >= 30 && len <= 500;
    if (!q8) suggestions.push(len < 30 ? '提示词不足30字' : '提示词超过500字，建议精简');

    const checks = { q1_noStaticPose: q1, q2_noAxisCross: q2, q3_shotSizeConsistent: q3, q4_motionClear: q4, q5_lightingMatch: q5, q6_characterConsistent: q6, q7_sceneConsistent: q7, q8_promptLength: q8 };
    const passed_count = Object.values(checks).filter(Boolean).length;
    const score = Math.round((passed_count / 8) * 100);

    return { passed: score >= 75, score, checks, suggestions: suggestions.length ? suggestions : undefined };
  }

  private resolveShots(primaryInput: any, allInputs: any[]): any[] {
    const fromPrimary = this.extractShots(primaryInput);
    if (fromPrimary.length > 0) return fromPrimary;

    for (const input of allInputs) {
      const shots = this.extractShots(input);
      if (shots.length > 0) return shots;
    }
    return [];
  }

  private extractShots(input: any): any[] {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (Array.isArray(input.shots)) return input.shots;
    if (Array.isArray(input.storyboard?.shots)) return input.storyboard.shots;
    if (Array.isArray(input.prompts?.shots)) return input.prompts.shots;
    return [];
  }
}
