/**
 * SCRIPT_PARSER 节点服务
 * 接收用户粘贴的剧本文本，调用 LLM 解析为 structured-script JSON
 * 全链路数据标准化网关
 */

import { AppNode, NodeType, PortSchema } from '../../types';
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
    const rawScript: string | undefined = upstream ?? node.data.prompt;

    if (!rawScript?.trim()) {
      return this.createErrorResult('未提供剧本文本，请连接上游节点或在面板中粘贴剧本');
    }

    try {
      // 2. 调用 LLM 解析
      const llmResponse = await this.callLLM(rawScript, node.data.model);

      // 3. 解析 JSON
      const structured = this.extractJSON(llmResponse);

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

  /**
   * TODO: 替换为项目实际 LLM 调用（依赖 API 服务层）
   * 当前返回 mock 数据用于联调
   */
  private async callLLM(script: string, _model?: string): Promise<string> {
    // TODO: 集成实际 LLM API，示例：
    // const resp = await llmService.chat({
    //   model: _model ?? 'gemini-2.0-flash',
    //   system: PARSE_SYSTEM_PROMPT,
    //   user: script,
    // });
    // return resp.text;

    console.log(`[ScriptParser] callLLM mock, input length=${script.length}, model=${_model}`);
    return JSON.stringify({
      title: 'Mock 剧本',
      genre: '都市',
      totalEpisodes: 1,
      episodeDuration: 60,
      visualStyle: 'REAL',
      worldview: '现代都市背景',
      setting: '2025年，某一线城市',
      characters: [
        { id: 'char_001', name: '主角', role: 'protagonist', age: '28岁', gender: '男', appearance: '短发，深色西装', personality: '沉稳内敛' },
      ],
      episodes: [
        { episodeNumber: 1, title: '第一集', synopsis: 'Mock 梗概', scenes: [] },
      ],
    });
  }

  /** 从 LLM 响应中提取 JSON，兼容 markdown 代码块包裹 */
  private extractJSON(raw: string): Record<string, any> {
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('LLM 返回内容无法解析为 JSON');
    }
  }
}