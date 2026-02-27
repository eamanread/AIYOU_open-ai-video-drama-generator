/**
 * Sora 平台 Provider
 * 通过 OpenAI API 连接 Sora 视频生成
 */

interface PlatformProvider {
  readonly name: string;
  readonly label: string;
  checkAvailability(): Promise<boolean>;
  submit(prompt: string, referenceImage?: string, duration?: number, aspectRatio?: string): Promise<{ taskId: string }>;
  getStatus(taskId: string): Promise<{ status: string; videoUrl?: string }>;
}

export class SoraProvider implements PlatformProvider {
  readonly name = 'sora';
  readonly label = 'Sora';

  private apiKey: string = '';
  private baseUrl = 'https://api.openai.com/v1';

  setApiKey(key: string): void { this.apiKey = key; }

  async checkAvailability(): Promise<boolean> {
    return !!this.apiKey;
  }

  async submit(prompt: string, referenceImage?: string, duration?: number, aspectRatio?: string): Promise<{ taskId: string }> {
    // TODO: POST /videos/generations (Sora API)
    const taskId = `sora_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[SoraProvider] submit mock, taskId=${taskId}`);
    return { taskId };
  }

  async getStatus(taskId: string): Promise<{ status: string; videoUrl?: string }> {
    // TODO: GET /videos/generations/{taskId}
    console.log(`[SoraProvider] getStatus mock, taskId=${taskId}`);
    return { status: 'pending' };
  }
}
