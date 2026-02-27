/**
 * 场景资产节点服务
 * 从 structured-script 提取场景列表，结合画风配置生成场景参考图
 */

import { AppNode, NodeType, PortSchema, SceneAssetData, StyleConfig } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
  NodeStatus,
} from './baseNode.service';
import { generateImageFromText } from '../geminiService';

interface ScriptScene {
  location: string;
  timeOfDay: string;
  description: string;
}

interface StructuredScriptInput {
  title: string;
  visualStyle: 'REAL' | 'ANIME' | '3D';
  episodes: { scenes: ScriptScene[] }[];
}

export class SceneAssetService extends BaseNodeService {
  readonly nodeType = NodeType.SCENE_ASSET;

  readonly inputSchema: PortSchema[] = [
    { key: 'script', type: 'structured-script', label: '结构化剧本', required: true },
    { key: 'style', type: 'style-config', label: '画风配置', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'scenes', type: 'scene-assets', label: '场景资产', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. 获取 structured-script
    const raw = this.getSingleInput(node, context) as any;
    const script = (raw?.structured || raw) as StructuredScriptInput | null;
    if (!script?.episodes?.length) {
      return this.createErrorResult('未获取到有效的结构化剧本数据');
    }

    // 2. 按 location 去重提取场景
    const uniqueScenes = this.extractUniqueScenes(script);
    if (uniqueScenes.length === 0) {
      return this.createErrorResult('剧本中未找到任何场景');
    }

    // 3. 获取 style-config（可选）
    const inputs = this.getInputData(node, context);
    const style = inputs.find((d): d is StyleConfig => d?.visualStyle !== undefined) ?? null;

    // 4. 为每个场景构建资产数据
    const sceneAssets: SceneAssetData[] = uniqueScenes.map((s, i) => {
      const prompt = this.buildScenePrompt(s, style, script.visualStyle);
      return {
        id: `scene_${String(i + 1).padStart(3, '0')}`,
        name: s.location,
        location: s.location,
        promptZh: prompt.zh,
        promptEn: prompt.en,
        status: 'PENDING' as const,
      };
    });

    // 5. 生成参考图（TODO: 接入图片生成 API）
    for (const asset of sceneAssets) {
      asset.referenceGrid = await this.generateReferenceGrid(asset);
    }

    // 6. 返回结果
    this.updateNodeData(node.id, { sceneAssets }, context);
    return this.createSuccessResult({ sceneAssets }, { scenes: { scenes: sceneAssets } });
  }

  /** 从所有集的场景中按 location 去重 */
  private extractUniqueScenes(script: StructuredScriptInput): ScriptScene[] {
    const seen = new Set<string>();
    const result: ScriptScene[] = [];
    for (const ep of script.episodes) {
      for (const scene of ep.scenes ?? []) {
        const key = scene.location?.trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          result.push(scene);
        }
      }
    }
    return result;
  }

  /** 构建场景生图 prompt（中/英） */
  private buildScenePrompt(
    scene: ScriptScene,
    style: StyleConfig | null,
    visualStyle: string,
  ): { zh: string; en: string } {
    const base = `${scene.location}，${scene.timeOfDay}，${scene.description}`;
    const styleSuffix = style?.stylePrompt ? `，${style.stylePrompt}` : '';
    const zh = `2x3六格环境参考图，${visualStyle}风格，${base}${styleSuffix}`;
    // TODO: 接入翻译服务生成英文 prompt
    const en = `2x3 six-panel environment reference, ${visualStyle} style, ${scene.location}`;
    return { zh, en };
  }

  private async generateReferenceGrid(asset: SceneAssetData): Promise<string | undefined> {
    try {
      const images = await generateImageFromText(
        asset.promptEn || asset.promptZh,
        'imagen-3.0-generate-002',
        [],
        { aspectRatio: '1:1' },
      );
      return images?.[0];
    } catch {
      return undefined;
    }
  }
}
