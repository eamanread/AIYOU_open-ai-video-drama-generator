/**
 * 可灵平台 Provider
 * 通过 REST API 直连可灵视频生成平台
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

  private accessKey: string = '';
  private secretKey: string = '';
  private baseUrl = 'https://api.klingai.com/v1';

  setCredentials(accessKey: string, secretKey: string): void {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
  }

  /**
   * 生成 JWT token (HS256)
   * Kling API 要求用 access_key + secret_key 签发 JWT
   */
  private async generateToken(): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.accessKey,
      exp: now + 1800, // 30 分钟有效期
      nbf: now - 5,
    };

    const encode = (obj: object) =>
      btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const headerB64 = encode(header);
    const payloadB64 = encode(payload);
    const signingInput = `${headerB64}.${payloadB64}`;

    // 使用 Web Crypto API 签名
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    return `${signingInput}.${sigB64}`;
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    const token = await this.generateToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Kling API ${res.status}: ${text}`);
    }

    return res.json();
  }

  async checkAvailability(): Promise<boolean> {
    if (!this.accessKey || !this.secretKey) return false;
    try {
      await this.generateToken();
      return true;
    } catch {
      return false;
    }
  }

  async submit(
    prompt: string,
    referenceImage?: string,
    duration?: number,
    aspectRatio?: string
  ): Promise<{ taskId: string }> {
    const body: Record<string, any> = {
      model_name: 'kling-v1',
      prompt,
      cfg_scale: 0.5,
      mode: 'std',
      aspect_ratio: aspectRatio || '16:9',
      duration: String(duration || 5),
    };
    if (referenceImage) {
      body.image = referenceImage;
    }

    const res = await this.request<{ code: number; data: { task_id: string } }>(
      'POST',
      '/videos/text2video',
      body
    );

    if (res.code !== 0) {
      throw new Error(`Kling submit failed: code=${res.code}`);
    }

    return { taskId: res.data.task_id };
  }

  async getStatus(taskId: string): Promise<{ status: string; videoUrl?: string }> {
    const res = await this.request<{
      code: number;
      data: {
        task_status: string;
        task_result?: { videos?: Array<{ url: string }> };
      };
    }>('GET', `/videos/text2video/${taskId}`);

    if (res.code !== 0) {
      throw new Error(`Kling getStatus failed: code=${res.code}`);
    }

    const videoUrl = res.data.task_result?.videos?.[0]?.url;
    return {
      status: res.data.task_status,
      videoUrl,
    };
  }
}
