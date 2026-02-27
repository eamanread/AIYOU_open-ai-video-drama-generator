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
import { extractCharactersFromText, generateCharacterProfile, generateImageFromText } from '../geminiService';

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
    // 1. 获取上游剧本/大纲（兼容 text 与 structured-script）
    const primaryInput = this.getSingleInput(node, context);
    const allInputs = this.getInputData(node, context);
    const { scriptText, structured } = this.normalizeScriptInput(primaryInput, allInputs);
    if (!scriptText) {
      return this.createErrorResult('未获取到有效的剧本/大纲文本');
    }

    // 2. 获取可选画风配置
    const style = allInputs.find((d): d is StyleConfig => d?.visualStyle !== undefined) ?? null;

    // 3. 从文本中提取角色列表
    const characters = await this.extractCharacters(scriptText, structured);
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

  private async extractCharacters(scriptText: string, structured?: any): Promise<CharacterAsset[]> {
    const structuredNames = Array.isArray(structured?.characters)
      ? structured.characters
        .map((c: any) => (typeof c === 'string' ? c : c?.name))
        .filter((n: any) => typeof n === 'string' && n.trim().length > 0)
      : [];
    const names = structuredNames.length > 0
      ? structuredNames
      : (await extractCharactersFromText(scriptText));
    if (!names?.length) {
      return [];
    }
    const assets: CharacterAsset[] = [];
    for (const name of names) {
      try {
        const profile = await generateCharacterProfile(name, scriptText);
        assets.push({
          id: `char_${String(assets.length + 1).padStart(3, '0')}`,
          name: profile.name || name,
          appearance: profile.basicStats || '',
          promptEn: profile.appearancePrompt,
          status: 'PENDING',
        });
      } catch {
        assets.push({
          id: `char_${String(assets.length + 1).padStart(3, '0')}`,
          name,
          appearance: '',
          status: 'FAILED',
        });
      }
    }
    return assets;
  }

  private async generateCharacterImages(char: CharacterAsset, _style: StyleConfig | null): Promise<void> {
    if (!char.promptEn) return;
    try {
      char.status = 'GENERATING';
      const styleSuffix = _style?.stylePrompt ? `, ${_style.stylePrompt}` : '';
      const images = await generateImageFromText(
        `${char.promptEn}${styleSuffix}`,
        'imagen-3.0-generate-002',
      );
      const first = Array.isArray(images) ? images[0] : images;
      if (first) {
        char.expressionSheet = first;
        char.status = 'SUCCESS';
      }
    } catch {
      char.status = 'FAILED';
    }
  }

  private normalizeScriptInput(primaryInput: any, allInputs: any[]): { scriptText: string; structured?: any } {
    const candidates = [primaryInput, ...allInputs];
    const structured = candidates.find((v: any) => v?.structured)?.structured
      || candidates.find((v: any) => v?.episodes && v?.characters);

    if (typeof primaryInput === 'string') {
      return { scriptText: primaryInput, structured };
    }
    if (primaryInput?.prompt && typeof primaryInput.prompt === 'string') {
      return { scriptText: primaryInput.prompt, structured };
    }
    if (structured) {
      return { scriptText: JSON.stringify(structured, null, 2), structured };
    }
    return { scriptText: '' };
  }
}
