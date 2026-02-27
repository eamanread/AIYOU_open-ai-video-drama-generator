/**
 * 画风预设节点服务
 * 支持 simple / fourPart 双模式，内置多套风格模板
 */

import { AppNode, NodeType, PortSchema, StyleConfig } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';

interface StyleTemplate {
  id: string;
  name: string;
  mode: 'simple' | 'fourPart';
  config: Partial<StyleConfig>;
}

const BUILT_IN_TEMPLATES: StyleTemplate[] = [
  {
    id: 'real_cinematic',
    name: '电影写实',
    mode: 'fourPart',
    config: {
      visualStyle: 'REAL',
      prefix: 'cinematic, photorealistic, 8k',
      lens: '35mm anamorphic lens, shallow depth of field',
      scene: 'dramatic composition',
      lighting: 'natural lighting, golden hour',
      negativePrompt: 'cartoon, anime, illustration, low quality',
    },
  },
  {
    id: 'anime_standard',
    name: '日系动漫',
    mode: 'fourPart',
    config: {
      visualStyle: 'ANIME',
      prefix: 'masterpiece, best quality, anime style',
      lens: 'dynamic angle',
      scene: 'detailed background, vibrant colors',
      lighting: 'cel shading, soft shadows',
      negativePrompt: 'realistic, photo, 3d render, low quality',
    },
  },
  {
    id: '3d_stylized',
    name: '3D风格化',
    mode: 'simple',
    config: {
      visualStyle: '3D',
      stylePrompt: 'Pixar style 3D render, stylized characters, vibrant lighting',
      negativePrompt: 'realistic, photo, 2d, flat',
    },
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    mode: 'fourPart',
    config: {
      visualStyle: 'REAL',
      prefix: 'cyberpunk, neon, futuristic',
      lens: 'wide angle, dutch angle',
      scene: 'neon-lit streets, holographic displays, rain-soaked',
      lighting: 'neon rim lighting, volumetric fog, cyan and magenta',
      negativePrompt: 'natural, pastoral, bright daylight, cartoon',
    },
  },
];

export class StylePresetNodeService extends BaseNodeService {
  readonly nodeType = NodeType.STYLE_PRESET;

  readonly inputSchema: PortSchema[] = [
    { key: 'text', type: 'text', label: '风格描述(可选)', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'style', type: 'style-config', label: '画风配置', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const upstreamText = this.getSingleInput(node, context) as string | null;
    const styleConfig = this.buildStyleConfig(node, upstreamText);

    this.updateNodeData(node.id, { styleConfig }, context);
    return this.createSuccessResult(styleConfig, { style: styleConfig });
  }

  private getTemplate(id: string): StyleTemplate | undefined {
    return BUILT_IN_TEMPLATES.find(t => t.id === id);
  }

  private buildStyleConfig(node: AppNode, upstreamText: string | null): StyleConfig {
    const data = node.data;
    const mode: 'simple' | 'fourPart' = (data as any).mode ?? 'simple';
    const template = (data as any).templateId ? this.getTemplate((data as any).templateId) : undefined;

    // Base config from template or empty
    const base: Partial<StyleConfig> = template?.config ?? {};

    const visualStyle = (data.visualStyle as StyleConfig['visualStyle']) ?? base.visualStyle ?? 'REAL';
    const negativePrompt = data.negativePrompt ?? base.negativePrompt;

    if (mode === 'fourPart') {
      return {
        mode: 'fourPart',
        prefix: (data as any).prefix ?? base.prefix ?? '',
        lens: (data as any).lens ?? base.lens ?? '',
        scene: (data as any).scene ?? base.scene ?? '',
        lighting: (data as any).lighting ?? base.lighting ?? '',
        visualStyle,
        negativePrompt,
        templateId: template?.id,
      };
    }

    // simple mode
    return {
      mode: 'simple',
      stylePrompt: data.stylePrompt ?? base.stylePrompt ?? upstreamText ?? '',
      visualStyle,
      negativePrompt,
      templateId: template?.id,
    };
  }
}

export { BUILT_IN_TEMPLATES };
