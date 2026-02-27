/**
 * 可灵平台 Provider
 * 通过 API 直连可灵视频生成平台
 */

interface PlatformProvider {
  readonly name: string;
  readonly label: string;
  checkAvailability(): Promise<boolean>;
  submit(prompt: string, referenceImage?: string, duration?: number, aspectRatio?: string): Promise<{ taskId: string }>;
  getStatus(taskId: string): Promise<{ status: string; videoUrl?: string }>;
}

export class KlingProvider implements PlatformProvider {
  readonly name = 'kling';
  readonly label = '可灵AI';

  private apiKey: string = '';
  private baseUrl = 'https://api.klingai.com/v1';

  setApiKey(key: string): void { this.apiKey = key; }

  async checkAvailability(): Promise<boolean> {
    // TODO: call /health or /models endpoint
    return !!this.apiKey;
  }

  async submit(prompt: string, referenceImage?: string, duration?: number, aspectRatio?: string): Promise<{ taskId: string }> {
    // TODO: POST /videos/generations
    // body: { prompt, image: referenceImage, duration: duration || 5, aspect_ratio: aspectRatio || '16:9' }
    const taskId = `kling_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[KlingProvider] submit mock, taskId=${taskId}`);
    return { taskId };
  }

  async getStatus(taskId: string): Promise<{ status: string; videoUrl?: string }> {
    // TODO: GET /videos/generations/{taskId}
    console.log(`[KlingProvider] getStatus mock, taskId=${taskId}`);
    return { status: 'pending' };
  }
}
