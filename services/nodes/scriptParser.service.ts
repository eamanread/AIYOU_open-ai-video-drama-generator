/**
 * SCRIPT_PARSER 节点服务
 * 接收用户粘贴的剧本文本，调用 LLM 解析为 structured-script JSON
 * 全链路数据标准化网关
 */

import { AppNode, NodeType, PortSchema } from '../../types';
import { llmProviderManager } from '../llmProviders';
import { getUserDefaultModel } from '../modelConfig';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';

/** structured-script 必须包含的顶层字段 */
const REQUIRED_KEYS = ['title', 'episodes', 'characters'] as const;

const PARSE_SYSTEM_PROMPT = `你是一个专业的剧本结构化解析器。
请将用户提供的剧本文本解析为严格的 JSON，格式要求：
- title: 剧名
- genre: 题材类型
- totalEpisodes: 总集数
- episodeDuration: 单集时长(秒)
- visualStyle: "REAL" | "ANIME" | "3D"
- worldview: 世界观描述
- setting: 时代/地点背景
- characters: 角色数组(id/name/role/age/gender/appearance/personality)
- episodes: 分集数组，每集含 scenes，每场含 dialogue
只输出 JSON，不要任何解释文字。`;

export class ScriptParserService extends BaseNodeService {
  readonly nodeType = NodeType.SCRIPT_PARSER;

  readonly inputSchema: PortSchema[] = [
    { key: 'script', type: 'text', label: '剧本文本', required: true },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'structured', type: 'structured-script', label: '结构化剧本', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. 获取剧本文本：优先上游输入，其次 node.data.prompt
    const upstream = this.getSingleInput(node, context);
    const rawScript = this.resolveRawScript(upstream, node.data.prompt);

    if (!rawScript?.trim()) {
      return this.createErrorResult('未提供剧本文本，请连接上游节点或在面板中粘贴剧本');
    }

    try {
      // 2. 调用 LLM 解析
      const llmResponse = await this.callLLM(rawScript, node.data.model, node.id);

      // 3. 解析 JSON
      const structured = this.normalizeStructured(this.extractJSON(llmResponse), rawScript);

      // 4. 校验必填字段
      const missing = REQUIRED_KEYS.filter((k) => !structured[k]);
      if (missing.length) {
        return this.createErrorResult(`LLM 返回缺少必填字段: ${missing.join(', ')}`);
      }

      // 5. 返回结构化数据
      return this.createSuccessResult(structured, { structured });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '剧本解析失败';
      return this.createErrorResult(msg);
    }
  }

  private resolveRawScript(upstream: any, fallback?: string): string | undefined {
    if (typeof upstream === 'string') return upstream;
    if (upstream && typeof upstream === 'object') {
      if (typeof upstream.prompt === 'string') return upstream.prompt;
      if (typeof upstream.episodes === 'string') return upstream.episodes;
      if (Array.isArray(upstream.generatedEpisodes)) {
        return upstream.generatedEpisodes
          .map((ep: any) => `${ep.title || ''}\n${ep.content || ''}`.trim())
          .join('\n\n');
      }
      if (upstream.structured) {
        return JSON.stringify(upstream.structured, null, 2);
      }
      if (upstream.title || upstream.episodes || upstream.characters) {
        return JSON.stringify(upstream, null, 2);
      }
    }
    return fallback;
  }

  private async callLLM(script: string, model?: string, nodeId?: string): Promise<string> {
    const response = await llmProviderManager.generateContent(
      script,
      model || getUserDefaultModel('text'),
      {
        systemInstruction: PARSE_SYSTEM_PROMPT,
      }
    );
    if (!response?.trim()) {
      throw new Error('LLM 返回为空，请检查 API Key 配置或网络连接');
    }
    return response;
  }

  /** 从 LLM 响应中提取 JSON，兼容 markdown 代码块包裹 */
  private extractJSON(raw: string): Record<string, any> {
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`LLM 返回内容无法解析为 JSON。原始响应片段: ${text.substring(0, 200)}`);
    }
  }

  /** 标准化 LLM 输出，尽量补齐下游节点需要的最小结构 */
  private normalizeStructured(parsed: Record<string, any>, fallbackScript: string): Record<string, any> {
    const safe: Record<string, any> = { ...parsed };

    if (!safe.title || typeof safe.title !== 'string') {
      safe.title = '未命名剧本';
    }

    if (!Array.isArray(safe.characters)) {
      safe.characters = [];
    }

    const episodes = Array.isArray(safe.episodes) ? safe.episodes : [];
    safe.episodes = episodes.map((ep: any, idx: number) => {
      const contentText = typeof ep?.content === 'string' ? ep.content : '';
      const existingScenes = Array.isArray(ep?.scenes) ? ep.scenes : [];

      if (existingScenes.length > 0) {
        return {
          ...ep,
          scenes: existingScenes.map((scene: any) => ({
            location: scene?.location || '未知场景',
            timeOfDay: scene?.timeOfDay || '白天',
            description: scene?.description || contentText || '剧情推进',
            dialogue: scene?.dialogue || '',
            props: Array.isArray(scene?.props) ? scene.props : [],
          })),
        };
      }

      const seed = contentText || fallbackScript || `第${idx + 1}集剧情`;
      return {
        ...ep,
        scenes: [
          {
            location: '未知场景',
            timeOfDay: '白天',
            description: seed.slice(0, 400),
            dialogue: '',
            props: [],
          },
        ],
      };
    });

    return safe;
  }
}
