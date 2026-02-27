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

const MESSAGE_TIMEOUT = 30000; // 30s

/** 发送 postMessage 并等待指定类型的响应 */
function sendAndWait<T>(
  type: string,
  payload?: Record<string, unknown>,
  timeout = MESSAGE_TIMEOUT,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window || event.data?.source !== 'jimeng-extension') return;
      if (event.data?.type === `${type}_RESULT`) {
        cleanup();
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.payload as T);
        }
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`即梦扩展响应超时 (${timeout / 1000}s)，请确认扩展已安装且即梦页面已打开`));
    }, timeout);

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('message', handler);
    };

    window.addEventListener('message', handler);
    window.postMessage({ type, payload, source: 'fcyh-app' }, '*');
  });
}

export class JimengProvider implements PlatformProvider {
  readonly name = 'jimeng';
  readonly label = '即梦AI';

  async checkAvailability(): Promise<boolean> {
    try {
      await sendAndWait<{ ok: boolean }>('JIMENG_PING', undefined, 5000);
      return true;
    } catch {
      return false;
    }
  }

  async submit(
    prompt: string,
    referenceImage?: string,
    duration?: number,
    aspectRatio?: string,
  ): Promise<{ taskId: string }> {
    return sendAndWait<{ taskId: string }>('JIMENG_SUBMIT', {
      prompt,
      referenceImage,
      duration,
      aspectRatio,
    });
  }

  async getStatus(taskId: string): Promise<{ status: string; videoUrl?: string }> {
    return sendAndWait<{ status: string; videoUrl?: string }>('JIMENG_GET_STATUS', { taskId });
  }
}
