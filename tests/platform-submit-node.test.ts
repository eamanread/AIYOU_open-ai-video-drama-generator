import { describe, it, expect, beforeEach } from 'vitest';
import { AppNode, Connection, NodeStatus, NodeType, PlatformProvider } from '../types';
import { PlatformSubmitService } from '../services/nodes/platformSubmit.service';

function makeNode(): AppNode {
  return {
    id: 'submit_1',
    type: NodeType.PLATFORM_SUBMIT,
    x: 0,
    y: 0,
    title: 'submit',
    status: NodeStatus.IDLE,
    data: { provider: 'test_provider' },
    inputs: ['vp_1'],
  };
}

function makeContext(inputPayload: any) {
  const nodes: AppNode[] = [
    {
      id: 'vp_1',
      type: NodeType.VIDEO_PROMPT_GENERATOR,
      x: 0,
      y: 0,
      title: 'vp',
      status: NodeStatus.IDLE,
      data: inputPayload,
      inputs: [],
    },
    makeNode(),
  ];

  const connections: Connection[] = [{ from: 'vp_1', to: 'submit_1', fromPort: 'prompts' }];

  return {
    nodeId: 'submit_1',
    nodes,
    connections,
    getInputData: (fromNodeId: string, outputKey?: string) => {
      const source = nodes.find((n) => n.id === fromNodeId);
      if (!source) return null;
      if (outputKey) return (source.data as any)[outputKey];
      return source.data;
    },
    updateNodeStatus: () => {},
    updateNodeData: (nodeId: string, data: any) => {
      const idx = nodes.findIndex((n) => n.id === nodeId);
      if (idx >= 0) {
        nodes[idx] = { ...nodes[idx], data: { ...nodes[idx].data, ...data } };
      }
    },
  };
}

describe('PlatformSubmitService strict failure mode', () => {
  beforeEach(() => {
    const provider: PlatformProvider = {
      name: 'test_provider',
      label: 'Test Provider',
      checkAvailability: async () => true,
      getStatus: async () => ({ status: 'submitted', videoUrl: '' }),
      submit: async (request) => {
        if (request.shotId === 'shot_2') {
          throw new Error('mock submit failed');
        }
        return { taskId: `task_${request.shotId}` };
      },
    };
    PlatformSubmitService.registerProvider(provider);
  });

  it('returns error when any shot submit fails', async () => {
    const service = new PlatformSubmitService();
    const node = makeNode();
    const context = makeContext({
      prompts: {
        shots: [
          { shotId: 'shot_1', prompt: 'p1' },
          { shotId: 'shot_2', prompt: 'p2' },
        ],
      },
    });

    const result = await service.execute(node, context as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain('视频平台提交失败');
    expect(result.error).toContain('1/2');
    expect(result.error).toContain('shot_2');
  });

  it('returns success when all shot submits succeed', async () => {
    const service = new PlatformSubmitService();
    const node = makeNode();
    const context = makeContext({
      prompts: {
        shots: [
          { shotId: 'shot_1', prompt: 'p1' },
          { shotId: 'shot_3', prompt: 'p3' },
        ],
      },
    });

    const result = await service.execute(node, context as any);

    expect(result.success).toBe(true);
    expect(result.outputs?.results?.length).toBe(2);
  });
});

