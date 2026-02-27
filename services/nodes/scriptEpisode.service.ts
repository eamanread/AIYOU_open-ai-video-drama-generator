/**
 * SCRIPT_EPISODE 节点服务
 * 接收剧本大纲 + 章节配置，调用 LLM 生成分集剧本
 * 自动收集已有分集保证剧情连续性
 */

import { AppNode, NodeType, PortSchema } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';
import { generateScriptEpisodes } from '../geminiService';

interface GeneratedEpisode {
  title: string;
  characters: string;
  keyItems?: string;
  content: string;
  continuityNote?: string;
}

export class ScriptEpisodeService extends BaseNodeService {
  readonly nodeType = NodeType.SCRIPT_EPISODE;

  readonly inputSchema: PortSchema[] = [
    { key: 'outline', type: 'text', label: '剧本大纲', required: true },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'episodes', type: 'text', label: '分集剧本', required: true },
  ];

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. 上游大纲
    const outline = this.getSingleInput(node, context);
    if (!outline) {
      return this.createErrorResult('未获取到剧本大纲，请连接 SCRIPT_PLANNER 节点');
    }

    // 2. 读取节点配置
    const {
      selectedChapter,
      episodeSplitCount = 3,
      scriptVisualStyle,
      episodeModificationSuggestion,
    } = node.data;

    if (!selectedChapter) {
      return this.createErrorResult('请先选择要生成的章节');
    }

    // 3. 收集已有分集（连续性上下文）
    const previousEpisodes = context.nodes
      .filter((n) => n.type === NodeType.SCRIPT_EPISODE && n.data.generatedEpisodes)
      .flatMap((n) => n.data.generatedEpisodes as GeneratedEpisode[]);

    try {
      // 4. 调用 LLM
      const episodes = await this.callLLM(outline, {
        selectedChapter,
        episodeSplitCount,
        scriptVisualStyle,
        episodeModificationSuggestion,
        previousEpisodes,
      });

      // 5. 格式化输出
      const formattedContent = episodes
        .map((ep, i) => [
          `## 第${i + 1}集: ${ep.title}`,
          `角色: ${ep.characters}`,
          ep.keyItems ? `关键道具: ${ep.keyItems}` : '',
          '',
          ep.content,
          ep.continuityNote ? `\n> 连续性备注: ${ep.continuityNote}` : '',
        ].filter(Boolean).join('\n'))
        .join('\n\n---\n\n');

      return this.createSuccessResult(
        { generatedEpisodes: episodes },
        { episodes: formattedContent },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分集剧本生成失败';
      return this.createErrorResult(msg);
    }
  }

  private async callLLM(outline: string, config: any): Promise<GeneratedEpisode[]> {
    const episodes = await generateScriptEpisodes(
      outline,
      config.selectedChapter,
      config.episodeSplitCount,
      config.episodeSplitCount, // duration in minutes
      config.scriptVisualStyle,
      config.episodeModificationSuggestion,
      undefined, // model — use default
      config.previousEpisodes,
    );
    if (!episodes?.length) {
      throw new Error('未生成任何分集，请检查大纲内容');
    }
    return episodes;
  }
}
