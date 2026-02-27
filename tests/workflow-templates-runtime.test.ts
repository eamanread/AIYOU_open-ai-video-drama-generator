/**
 * Workflow templates runtime integration test
 * Uses real node services + pipeline engine, stubbing only external API calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WORKFLOW_TEMPLATES } from '../services/workflowTemplates';
import { instantiateWorkflow } from '../services/workflowSolidifier';
import { NodeServiceRegistry } from '../services/nodes';
import { registerAllNodeServices } from '../services/nodes/registry';

vi.mock('../services/llmProviders', () => ({
  llmProviderManager: {
    generateContent: vi.fn(async () => JSON.stringify({
      title: '测试剧本',
      genre: '都市',
      totalEpisodes: 1,
      episodeDuration: 60,
      visualStyle: 'ANIME',
      worldview: '现代都市',
      setting: '城市',
      characters: [{ id: 'c1', name: '主角', role: 'main', age: '25', gender: '男', appearance: '短发', personality: '冷静' }],
      episodes: [
        {
          scenes: [
            {
              location: '咖啡店',
              timeOfDay: '白天',
              description: '主角在咖啡店发现线索并拿起手机。',
              dialogue: '这不对劲。',
              props: ['手机'],
            },
          ],
        },
      ],
    })),
  },
}));

vi.mock('../services/geminiService', () => ({
  extractCharactersFromText: vi.fn(async () => ['主角']),
  generateCharacterProfile: vi.fn(async () => ({
    name: '主角',
    basicStats: '25岁，男',
    appearancePrompt: 'anime male, short hair, cinematic',
  })),
  generateImageFromText: vi.fn(async () => ['data:image/png;base64,mock-image']),
  generateDetailedStoryboard: vi.fn(async () => [
    {
      id: 'shot_1',
      shotNumber: 1,
      duration: 4,
      scene: '咖啡店',
      characters: ['主角'],
      shotSize: '中景',
      cameraAngle: '视平',
      cameraMovement: '固定',
      visualDescription: '主角坐在窗边，手握手机。',
      dialogue: '这不对劲。',
      visualEffects: '',
      audioEffects: '',
      startTime: 0,
      endTime: 4,
    },
  ]),
  analyzeDrama: vi.fn(async () => ({
    dramaIntroduction: '测试剧',
    worldview: '现代都市',
    logicalConsistency: '良好',
    extensibility: '高',
    characterTags: '成长,反转',
    protagonistArc: '觉醒',
    audienceResonance: '强',
    artStyle: '写实',
  })),
  generateScriptPlanner: vi.fn(async () => '第1章：在咖啡店发现关键线索，主角开始调查。'),
  generateScriptEpisodes: vi.fn(async () => ([
    {
      title: '线索出现',
      characters: '主角',
      content: '主角在咖啡店发现线索，决定追查真相。',
    },
  ])),
}));

vi.mock('../services/videoPlatforms/yunwuapiProvider', () => ({
  yunwuapiPlatform: {
    submitTask: vi.fn(async () => ({ taskId: 'task_mock_1' })),
    checkStatus: vi.fn(async () => ({ status: 'submitted', videoUrl: '' })),
  },
}));

vi.mock('../services/geminiServiceWithFallback', () => ({
  generateImageWithFallback: vi.fn(async () => ['data:image/png;base64,mock-edited-image']),
}));

const LONG_PROMPT = `
第一幕：
主角在咖啡店收到匿名短信，发现好友失踪。
第二幕：
主角通过旧照片追踪到仓库，发现一段可疑交易记录。
第三幕：
主角揭开真相并完成自我成长。
`.trim();

function buildRuntimeValues(templateId: string): Record<string, Record<string, any>> {
  if (templateId === 'template_b' || templateId === 'template_e') {
    return {
      analyzer_1: {
        dramaName: '测试剧目',
      },
    };
  }

  const baseValues: Record<string, Record<string, any>> = {
    input_1: {
      prompt: LONG_PROMPT,
    },
  };

  // template_d 有 char/scene/prop/storyboard 节点，需要预填上游数据
  if (templateId === 'template_d') {
    const structuredScript = {
      title: '测试剧本',
      episodes: [{ scenes: [{ location: '咖啡店', description: '主角在咖啡店发现线索并拿起手机，决定追查真相。这是一段足够长的描述文本用于通过最小字数校验。' }] }],
      characters: [{ name: '主角', role: 'main', appearance: '短发男性' }],
    };
    Object.assign(baseValues, {
      char_1: { scriptText: LONG_PROMPT, structuredScript },
      scene_1: { structuredScript },
      prop_1: { structuredScript },
      storyboard_1: { prompt: LONG_PROMPT, structuredScript },
    });
  }

  return baseValues;
}

describe('Workflow templates runtime (real services)', () => {
  beforeEach(() => {
    localStorage.setItem('YUNWU_API_KEY', 'test-yunwu-key');
    NodeServiceRegistry.clear();
    registerAllNodeServices();
    NodeServiceRegistry.getRegisteredTypes().forEach((nodeType) => {
      const svc = NodeServiceRegistry.get(nodeType) as any;
      if (svc?.retryConfig) {
        svc.retryConfig.maxRetries = 0;
        svc.retryConfig.backoffMs = 1;
        svc.retryConfig.backoffMultiplier = 1;
      }
    });
  });

  it('all built-in templates A-E should complete successfully', async () => {
    const failures: string[] = [];

    for (const template of WORKFLOW_TEMPLATES) {
      const runtimeValues = buildRuntimeValues(template.id);
      const { nodes, connections } = instantiateWorkflow(template, runtimeValues);
      const state = await NodeServiceRegistry.executePipeline(nodes, connections);

      if (state.status !== 'completed') {
        const nodeErrors = Object.entries(state.failures)
          .map(([nodeId, f]) => `${nodeId}: ${f.error}`)
          .join(' | ');
        failures.push(`${template.id} => ${state.status}; ${nodeErrors}`);
      }
    }

    expect(failures).toEqual([]);
  }, 30000);
});
