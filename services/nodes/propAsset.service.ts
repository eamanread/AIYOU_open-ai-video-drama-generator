/**
 * 道具资产节点服务
 * 从 structured-script 提取道具列表，生成三视图参考图
 */

import { AppNode, NodeType, PortSchema, PropAssetData, StyleConfig } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';
import { generateImageFromText } from '../geminiService';

interface ScriptScene {
  props?: string[];
  description: string;
}

interface StructuredScriptInput {
  title: string;
  visualStyle: 'REAL' | 'ANIME' | '3D';
  episodes: { scenes: ScriptScene[] }[];
}

export class PropAssetService extends BaseNodeService {
  readonly nodeType = NodeType.PROP_ASSET;

  readonly inputSchema: PortSchema[] = [
    { key: 'script', type: 'structured-script', label: '结构化剧本', required: true },
    { key: 'style', type: 'style-config', label: '画风配置', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'props', type: 'prop-assets', label: '道具资产', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. 获取 structured-script
    const raw = this.getSingleInput(node, context) as any;
    const script = (raw?.structured || raw) as StructuredScriptInput | null;
    if (!script?.episodes?.length) {
      return this.createErrorResult('未获取到有效的结构化剧本数据');
    }

    // 2. 提取去重道具
    const uniqueProps = this.extractUniqueProps(script);
    if (uniqueProps.length === 0) {
      return this.createSuccessResult({ propAssets: [] }, { props: { props: [] } });
    }

    // 3. 获取 style-config（可选）
    const inputs = this.getInputData(node, context);
    const style = inputs.find((d): d is StyleConfig => d?.visualStyle !== undefined) ?? null;

    // 4. 为每个道具构建资产数据
    const propAssets: PropAssetData[] = uniqueProps.map((name, i) => {
      const desc = this.findPropDescription(name, script);
      const prompt = this.buildPropPrompt(name, desc, style, script.visualStyle);
      return {
        id: `prop_${String(i + 1).padStart(3, '0')}`,
        name,
        description: desc,
        promptZh: prompt.zh,
        promptEn: prompt.en,
        status: 'PENDING' as const,
      };
    });

    // 5. 生成三视图（TODO: 接入图片生成 API）
    for (const asset of propAssets) {
      asset.threeViewSheet = await this.generateThreeViewSheet(asset);
    }

    // 6. 返回结果
    this.updateNodeData(node.id, { propAssets }, context);
    return this.createSuccessResult({ propAssets }, { props: { props: propAssets } });
  }

  /** 从所有集的场景中提取去重道具名 */
  private extractUniqueProps(script: StructuredScriptInput): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const ep of script.episodes) {
      for (const scene of ep.scenes ?? []) {
        for (const prop of scene.props ?? []) {
          const key = prop.trim();
          if (key && !seen.has(key)) {
            seen.add(key);
            result.push(key);
          }
        }
      }
    }
    return result;
  }

  /** 从场景描述中收集与该道具相关的描述 */
  private findPropDescription(propName: string, script: StructuredScriptInput): string {
    const fragments: string[] = [];
    for (const ep of script.episodes) {
      for (const scene of ep.scenes ?? []) {
        if (scene.description?.includes(propName)) {
          fragments.push(scene.description);
        }
      }
    }
    return fragments.length > 0 ? fragments.join('；') : propName;
  }

  /** 构建道具三视图 prompt（中/英） */
  private buildPropPrompt(
    name: string,
    desc: string,
    style: StyleConfig | null,
    visualStyle: string,
  ): { zh: string; en: string } {
    const styleSuffix = style?.stylePrompt ? `，${style.stylePrompt}` : '';
    const zh = `三视图，${visualStyle}风格，${name}，${desc}${styleSuffix}`;
    const en = `Three-view sheet, ${visualStyle} style, ${name}`;
    return { zh, en };
  }

  private async generateThreeViewSheet(asset: PropAssetData): Promise<string | undefined> {
    try {
      const images = await generateImageFromText(
        asset.promptEn || asset.promptZh,
        'imagen-3.0-generate-002',
        [],
        { aspectRatio: '3:1' },
      );
      return images?.[0];
    } catch {
      return undefined;
    }
  }
}
