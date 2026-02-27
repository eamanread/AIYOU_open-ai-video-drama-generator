/**
 * PLATFORM_SUBMIT 节点服务
 * 通用视频生成平台提交节点，基于 Provider 模式支持多平台扩展
 */

import { AppNode, NodeType, PortSchema, PlatformProvider, PlatformShotRequest } from '../../types';
import {
  BaseNodeService,
  NodeExecutionContext,
  NodeExecutionResult,
} from './baseNode.service';

interface SubmitResult {
  shotId: string;
  platform: string;
  status: 'pending' | 'submitted' | 'generating' | 'success' | 'error';
  taskId?: string;
  videoUrl?: string;
  error?: string;
}

export class PlatformSubmitService extends BaseNodeService {
  readonly nodeType = NodeType.PLATFORM_SUBMIT;

  readonly inputSchema: PortSchema[] = [
    { key: 'prompts', type: 'video-prompt', label: '视频提示词', required: true },
    { key: 'images', type: 'base64-image', label: '参考图', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'results', type: 'text', label: '提交结果', required: true },
  ];

  /* ── Provider 注册表 ── */

  private static providers: Map<string, PlatformProvider> = new Map();

  static registerProvider(provider: PlatformProvider): void {
    PlatformSubmitService.providers.set(provider.name, provider);
  }

  static getProvider(name: string): PlatformProvider | undefined {
    return PlatformSubmitService.providers.get(name);
  }

  /* ── 执行入口 ── */

  async execute(node: AppNode, context: NodeExecutionContext): Promise<NodeExecutionResult> {
    // 1. 获取上游视频提示词
    const promptInput = this.getSingleInput(node, context);
    const shots: any[] = promptInput?.shots ?? [];

    if (!shots.length) {
      return this.createErrorResult('未收到视频提示词，请连接上游 VIDEO_PROMPT_GENERATOR 节点');
    }

    // 2. 读取节点配置
    const providerName: string = (node.data as any).provider ?? 'jimeng';
    const batchSize: number = (node.data as any).batchSize ?? 1;

    // 3. 获取 Provider 并检查可用性
    const provider = PlatformSubmitService.providers.get(providerName);
    if (!provider) {
      return this.createErrorResult(`平台 Provider "${providerName}" 未注册`);
    }

    const available = await provider.checkAvailability();
    if (!available) {
      return this.createErrorResult(`平台 "${provider.label}" 当前不可用`);
    }

    // 4. 获取可选参考图
    const allInputs = this.getInputData(node, context);
    const refImage: string | undefined = allInputs.find((d: any) => typeof d === 'string' && d.startsWith('data:'));

    // 5. 逐镜头提交（按 batchSize 分批）
    const results: SubmitResult[] = [];
    for (let i = 0; i < shots.length; i += batchSize) {
      const batch = shots.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((shot: any) => this.submitShot(provider, shot, refImage)),
      );
      results.push(...batchResults);
    }

    return this.createSuccessResult({ results }, { results });
  }

  /* ── 单镜头提交 ── */

  private async submitShot(provider: PlatformProvider, shot: any, refImage?: string): Promise<SubmitResult> {
    try {
      const request: PlatformShotRequest = {
        shotId: shot.shotId ?? shot.id ?? '',
        prompt: shot.prompt,
        referenceImage: refImage,
        duration: shot.duration ?? 5,
        aspectRatio: shot.aspectRatio ?? '16:9',
        model: shot.model,
        quality: shot.quality,
      };
      const { taskId } = await provider.submit(request);
      return { shotId: request.shotId, platform: provider.name, status: 'submitted', taskId };
    } catch (err) {
      return { shotId: shot.shotId, platform: provider.name, status: 'error', error: err instanceof Error ? err.message : '提交失败' };
    }
  }
}
