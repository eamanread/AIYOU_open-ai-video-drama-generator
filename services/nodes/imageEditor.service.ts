/**
 * 图像编辑节点服务
 * 接收原始图片和编辑指令，调用图像生成 API 产出编辑后的图片
 */

import { AppNode, NodeType, PortSchema } from '../../types';
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from './baseNode.service';

export class ImageEditorService extends BaseNodeService {
  readonly nodeType = NodeType.IMAGE_EDITOR;

  readonly inputSchema: PortSchema[] = [
    { key: 'image', type: 'base64-image', label: '原始图片', required: true },
    { key: 'text', type: 'text', label: '编辑指令', required: false },
  ];

  readonly outputSchema: PortSchema[] = [
    { key: 'image', type: 'base64-image', label: '编辑后图片', required: true },
  ];

  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      // 1. 获取原始图片：优先上游输入，其次节点自身数据
      const upstream = this.getSingleInput(node, context);
      const sourceImage: string | undefined =
        upstream?.image || node.data.image;

      // 2. 获取编辑指令
      const prompt: string =
        node.data.prompt || upstream?.text || '默认编辑';

      if (!sourceImage) {
        return this.createErrorResult('缺少原始图片');
      }

      // 3. 调用编辑（当前为占位实现）
      const editedImage = await this.editImage(sourceImage, prompt);

      if (!editedImage) {
        return this.createErrorResult('图像编辑未返回结果');
      }

      // 4. 返回成功
      return this.createSuccessResult(
        { image: editedImage },
        { image: editedImage }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : '图像编辑失败';
      console.error('[ImageEditor] 执行异常:', error);
      return this.createErrorResult(msg);
    }
  }

  /**
   * 占位：后续接入 generateImageWithFallback
   */
  private async editImage(
    sourceImage: string,
    prompt: string
  ): Promise<string | undefined> {
    // TODO: import { generateImageWithFallback } from '../geminiServiceWithFallback';
    console.log(`[ImageEditor] 待编辑图片, prompt=${prompt.slice(0, 50)}`);
    return undefined;
  }
}
