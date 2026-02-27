/**
 * 角色资产节点服务
 * 从剧本/大纲提取角色列表，结合画风配置生成角色形象资产
 */

import { AppNode, NodeType, PortSchema, StyleConfig } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';

interface CharacterAsset {
  id: string;
  name: string;
  appearance: string;
  expressionSheet?: string;
  threeViewSheet?: string;
  referenceImages?: string[];
  promptZh?: string;
  promptEn?: string;
  status: 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED';
}

export class CharacterNodeService extends BaseNodeService {
  readonly nodeType = NodeType.CHARACTER_NODE;

  readonly inputSchema: PortSchema[] = [
    { key: 'script', type: 'text', label: '剧本/大纲', required: true },
    { key: 'style', type: 'style-config', label: '画风配置', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'characters', type: 'char-assets', label: '角色资产', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. 获取上游剧本/大纲文本
    const scriptText = this.getSingleInput(node, context) as string | null;
    if (!scriptText) {
      return this.createErrorResult('未获取到有效的剧本/大纲文本');
    }

    // 2. 获取可选画风配置
    const inputs = this.getInputData(node, context);
    const style = inputs.find((d): d is StyleConfig => d?.visualStyle !== undefined) ?? null;

    // 3. 从文本中提取角色列表
    const characters = await this.extractCharacters(scriptText);
    if (characters.length === 0) {
      return this.createErrorResult('剧本中未识别到任何角色');
    }

    // 4. 为每个角色生成形象图（TODO）
    for (const char of characters) {
      await this.generateCharacterImages(char, style);
    }

    // 5. 写回节点数据并返回
    this.updateNodeData(node.id, { characters }, context);
    return this.createSuccessResult({ characters }, { characters: { characters } });
  }

  /**
   * 从剧本文本中提取角色信息
   * TODO: import { generateCharacterProfile } from '../geminiService';
   */
  private async extractCharacters(scriptText: string): Promise<CharacterAsset[]> {
    console.log('[CharacterNode] extractCharacters mock, textLen:', scriptText.length);
    return [
      { id: 'char_001', name: 'Mock角色', appearance: '短发青年', status: 'PENDING' },
    ];
  }

  /**
   * 为单个角色生成表情九宫格 / 三视图等图片资产
   * TODO: import { generateImageWithFallback } from '../geminiServiceWithFallback';
   */
  private async generateCharacterImages(char: CharacterAsset, _style: StyleConfig | null): Promise<void> {
    console.log(`[CharacterNode] 待生成角色图: ${char.name}`);
  }
}
