/**
 * 即梦浏览器扩展桥接 — Technical Spike
 * Tauri webview ↔ browser extension 通信协议验证
 */

import type { PlatformShotRequest } from '../../types';

// ── Protocol Types ──────────────────────────────────────────

type BridgeMessageType = 'SUBMIT_SHOT' | 'CHECK_STATUS' | 'CANCEL_TASK' | 'PING' | 'BATCH_SUBMIT';

interface BridgeRequest {
  id: string;
  type: BridgeMessageType;
  payload: any;
  timestamp: number;
}

interface BridgeResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

// Tauri webview + local dev origins
const ALLOWED_ORIGINS: string[] = [
  'tauri://localhost',
  'https://tauri.localhost',
  'http://localhost:3000',
  'http://localhost:5173',
];

// ── Bridge Class ────────────────────────────────────────────

type PendingEntry = {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
};

class JimengBridge {
  private pendingRequests = new Map<string, PendingEntry>();
  private connected = false;
  private messageHandler: (event: MessageEvent) => void;

  constructor() {
    this.messageHandler = this.handleMessage.bind(this);
  }

  // ── Connection lifecycle ──

  async connect(): Promise<void> {
    window.addEventListener('message', this.messageHandler);
    try {
      await this.sendRequest('PING', null, 5000);
      this.connected = true;
    } catch {
      this.disconnect();
      throw new Error('[JimengBridge] Extension not responding — PING timeout');
    }
  }

  disconnect(): void {
    window.removeEventListener('message', this.messageHandler);
    for (const [id, entry] of this.pendingRequests) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Bridge disconnected'));
    }
    this.pendingRequests.clear();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── Public API ──

  async submitShot(request: PlatformShotRequest): Promise<{ taskId: string }> {
    return this.sendRequest('SUBMIT_SHOT', request);
  }

  async checkStatus(taskId: string): Promise<{ status: string; videoUrl?: string }> {
    return this.sendRequest('CHECK_STATUS', { taskId });
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.sendRequest('CANCEL_TASK', { taskId });
  }

  async batchSubmit(requests: PlatformShotRequest[]): Promise<{ taskIds: string[] }> {
    return this.sendRequest('BATCH_SUBMIT', { requests });
  }

  // ── Internals ──

  private sendRequest(type: BridgeMessageType, payload: any, timeoutMs = 30000): Promise<any> {
    const id = this.generateId();
    const request: BridgeRequest = { id, type, payload, timestamp: Date.now() };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`[JimengBridge] ${type} timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      window.postMessage(request, '*');
    });
  }

  private handleMessage(event: MessageEvent): void {
    if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(event.origin) && event.origin !== '') {
      return; // ignore messages from unknown origins
    }

    const resp = event.data as BridgeResponse;
    if (!resp?.id) return;

    const pending = this.pendingRequests.get(resp.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(resp.id);

    if (resp.success) {
      pending.resolve(resp.data);
    } else {
      pending.reject(new Error(resp.error ?? 'Unknown bridge error'));
    }
  }

  private generateId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `jb_${ts}_${rand}`;
  }
}

// ── Singleton Export ────────────────────────────────────────

export const jimengBridge = new JimengBridge();
export type { BridgeRequest, BridgeResponse, BridgeMessageType };
