/**
 * 即梦平台 Provider
 * 通过浏览器扩展桥接与即梦平台通信
 */

interface PlatformProvider {
  readonly name: string;
  readonly label: string;
  checkAvailability(): Promise<boolean>;
  submit(prompt: string, referenceImage?: string, duration?: number, aspectRatio?: string): Promise<{ taskId: string }>;
  getStatus(taskId: string): Promise<{ status: string; videoUrl?: string }>;
}

export class JimengProvider implements PlatformProvider {
  readonly name = 'jimeng';
  readonly label = '即梦AI';

  /**
   * 检查即梦扩展是否可用
   * 通过 window.postMessage 探测扩展注入的 content script
   */
  async checkAvailability(): Promise<boolean> {
    // TODO: 实际检测逻辑 — 发送 ping 消息，等待 pong 响应
    // return new Promise((resolve) => {
    //   const handler = (event: MessageEvent) => {
    //     if (event.data?.type === 'JIMENG_PONG') { resolve(true); window.removeEventListener('message', handler); }
    //   };
    //   window.addEventListener('message', handler);
    //   window.postMessage({ type: 'JIMENG_PING' }, '*');
    //   setTimeout(() => { resolve(false); window.removeEventListener('message', handler); }, 3000);
    // });
    console.log('[JimengProvider] checkAvailability mock');
    return true;
  }

  /**
   * 提交视频生成任务到即梦
   */
  async submit(prompt: string, referenceImage?: string, duration?: number, aspectRatio?: string): Promise<{ taskId: string }> {
    // TODO: 通过 postMessage 发送到浏览器扩展
    // window.postMessage({
    //   type: 'JIMENG_SUBMIT',
    //   payload: { prompt, referenceImage, duration, aspectRatio }
    // }, '*');
    // return new Promise((resolve, reject) => { ... listen for JIMENG_SUBMIT_RESULT });
    const taskId = `jimeng_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[JimengProvider] submit mock, taskId=${taskId}`);
    return { taskId };
  }

  /**
   * 查询任务状态
   */
  async getStatus(taskId: string): Promise<{ status: string; videoUrl?: string }> {
    // TODO: 通过 postMessage 查询
    console.log(`[JimengProvider] getStatus mock, taskId=${taskId}`);
    return { status: 'pending' };
  }
}
