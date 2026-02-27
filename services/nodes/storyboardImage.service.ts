/**
 * 分镜图片生成节点服务
 * 根据分镜数据为每个镜头生成对应图片
 */

import { AppNode, NodeType, PortSchema } from '../../types';
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from './baseNode.service';

export class StoryboardImageService extends BaseNodeService {
  readonly nodeType = NodeType.STORYBOARD_IMAGE;

  readonly inputSchema: PortSchema[] = [
    { key: 'storyboard', type: 'storyboard-shots', label: '分镜数据', required: true },
    { key: 'style', type: 'style-config', label: '画风配置', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'images', type: 'base64-image', label: '分镜图片', required: true },
  ];

  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // 1. 获取上游分镜数据
    const storyboard = this.getSingleInput(node, context);
    if (!storyboard?.shots || storyboard.shots.length === 0) {
      return this.createErrorResult('未获取到有效的分镜数据');
    }

    // 2. 获取可选画风配置
    const inputs = this.getInputData(node, context);
    const style = inputs.find((d: any) => d?.stylePrompt || d?.visualStyle) ?? null;

    // 3. 逐镜头生成图片
    const aspectRatio = node.data.aspectRatio || '16:9';
    const shotImages: { shotId: string; imageBase64: string | undefined; prompt: string }[] = [];

    for (const shot of storyboard.shots) {
      const prompt = this.buildImagePrompt(shot, style);
      const imageBase64 = await this.generateShotImage(prompt, aspectRatio);
      shotImages.push({ shotId: shot.id, imageBase64, prompt });
    }

    // 4. 更新节点数据并返回
    this.updateNodeData(node.id, {
      ...node.data,
      storyboardGridImages: shotImages
        .map((s) => s.imageBase64)
        .filter(Boolean),
    }, context);

    return this.createSuccessResult(
      { images: shotImages },
      { images: shotImages }
    );
  }

  /**
   * 组合镜头描述 + 景别 + 画风为完整 prompt
   */
  private buildImagePrompt(shot: any, style: any): string {
    const parts: string[] = [];
    if (shot.visualDescription) parts.push(shot.visualDescription);
    if (shot.shotSize) parts.push(shot.shotSize);
    if (style?.stylePrompt) parts.push(style.stylePrompt);
    return parts.join(', ');
  }

  /**
   * 单镜头图片生成（占位）
   */
  private async generateShotImage(
    prompt: string,
    aspectRatio: string
  ): Promise<string | undefined> {
    // TODO: import { generateImageWithFallback } from '../geminiServiceWithFallback';
    console.log(`[StoryboardImage] 待生成: ${prompt.slice(0, 50)}...`);
    return undefined;
  }
}
