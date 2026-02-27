/**
 * 管线执行引擎 — 替代 executeNodesInOrder
 * 支持拓扑分层并行、暂停/恢复、跳过失败节点
 */

import {
  AppNode, Connection, PipelineState, PipelineStatus, NodeRunStatus,
} from '../types';
import { NodeServiceRegistry, NodeExecutionContext } from './nodes/index';

type RegistryType = typeof NodeServiceRegistry;

export class PipelineEngine {
  private state: PipelineState;
  private abortController: AbortController | null = null;
  private pausePromise: Promise<void> | null = null;
  private pauseResolve: (() => void) | null = null;

  constructor(
    private nodes: AppNode[],
    private connections: Connection[],
    private registry: RegistryType,
    private context: NodeExecutionContext,
  ) {
    const ids = nodes.map(n => n.id);
    this.state = {
      status: 'idle',
      executionOrder: ids,
      nodeStatuses: Object.fromEntries(ids.map(id => [id, 'pending' as NodeRunStatus])),
      currentIndex: 0,
      failures: {},
    };
  }

  /** Kahn 算法拓扑排序，返回执行层级（同层可并行） */
  private buildExecutionLayers(): string[][] {
    const nodeIds = new Set(this.nodes.map(n => n.id));
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    nodeIds.forEach(id => { inDegree.set(id, 0); adj.set(id, []); });

    this.connections.forEach(c => {
      if (!nodeIds.has(c.from) || !nodeIds.has(c.to)) return;
      adj.get(c.from)!.push(c.to);
      inDegree.set(c.to, (inDegree.get(c.to) ?? 0) + 1);
    });

    const layers: string[][] = [];
    let queue = Array.from(nodeIds).filter(id => inDegree.get(id) === 0);

    while (queue.length) {
      layers.push(queue);
      const next: string[] = [];
      for (const id of queue) {
        for (const nb of adj.get(id) ?? []) {
          const d = inDegree.get(nb)! - 1;
          inDegree.set(nb, d);
          if (d === 0) next.push(nb);
        }
      }
      queue = next;
    }

    // 环检测：如果拓扑排序未能覆盖所有节点，说明存在环
    const sorted = layers.flat();
    if (sorted.length < nodeIds.size) {
      const cycleNodeIds = Array.from(nodeIds).filter(id => !sorted.includes(id));
      throw new Error(
        `Pipeline contains a cycle involving nodes: ${cycleNodeIds.join(', ')}`,
      );
    }

    // 更新 executionOrder 为拓扑展平结果
    this.state.executionOrder = sorted;
    return layers;
  }

  /** 等待暂停恢复 */
  private async waitIfPaused(): Promise<void> {
    if (this.state.status === 'paused' && !this.pausePromise) {
      this.pausePromise = new Promise(r => { this.pauseResolve = r; });
    }
    if (this.pausePromise) await this.pausePromise;
  }

  /** 执行单个节点 */
  private async executeNode(nodeId: string): Promise<void> {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const service = this.registry.get(node.type);
    if (!service) {
      this.state.nodeStatuses[nodeId] = 'error';
      this.state.failures[nodeId] = { error: `未注册的节点类型: ${node.type}`, retryCount: 0 };
      return;
    }

    this.state.nodeStatuses[nodeId] = 'running';
    const result = await service.executeNode(node, { ...this.context, nodeId });

    if (result.success) {
      this.state.nodeStatuses[nodeId] = 'success';
    } else {
      this.state.nodeStatuses[nodeId] = 'error';
      this.state.failures[nodeId] = { error: result.error ?? '未知错误', retryCount: 0 };
    }
  }

  /** 启动管线执行 */
  async run(): Promise<PipelineState> {
    this.state.status = 'running';
    this.state.startedAt = Date.now();
    this.abortController = new AbortController();

    let layers: string[][];
    try {
      layers = this.buildExecutionLayers();
    } catch (err) {
      this.state.status = 'error';
      this.state.failures['__cycle__'] = {
        error: err instanceof Error ? err.message : String(err),
        retryCount: 0,
      };
      this.state.completedAt = Date.now();
      return this.state;
    }

    for (let i = 0; i < layers.length; i++) {
      this.state.currentIndex = i;

      // 暂停检查
      await this.waitIfPaused();
      if ((this.state.status as string) === 'error') break;

      // 过滤掉已跳过的节点
      const active = layers[i].filter(
        id => this.state.nodeStatuses[id] !== 'skipped',
      );

      // 同层并行执行，失败不阻塞同层其他节点
      await Promise.allSettled(active.map(id => this.executeNode(id)));
    }

    // 收尾状态
    if (this.state.status === 'running') {
      const hasError = Object.values(this.state.nodeStatuses).some(s => s === 'error');
      this.state.status = hasError ? 'error' : 'completed';
    }
    this.state.completedAt = Date.now();
    return this.state;
  }

  /** 暂停执行 */
  pause(): void {
    if (this.state.status !== 'running') return;
    this.state.status = 'paused';

    // 通知所有已注册的 service 暂停
    for (const nodeType of this.registry.getRegisteredTypes()) {
      this.registry.get(nodeType)?.setPaused(true);
    }
  }

  /** 恢复执行 */
  resume(): void {
    if (this.state.status !== 'paused') return;
    this.state.status = 'running';

    // 通知所有 service 恢复
    for (const nodeType of this.registry.getRegisteredTypes()) {
      this.registry.get(nodeType)?.setPaused(false);
    }

    // 释放暂停锁
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pausePromise = null;
      this.pauseResolve = null;
    }
  }

  /** 跳过指定失败节点，继续后续层 */
  skipAndContinue(nodeId: string): void {
    if (this.state.nodeStatuses[nodeId] !== 'error') return;
    this.state.nodeStatuses[nodeId] = 'skipped';

    // 如果整体因 error 停住，恢复为 running 让循环继续
    if (this.state.status === 'error') {
      this.state.status = 'running';
    }
    // 如果处于暂停态，也一并恢复
    if (this.state.status === 'paused') {
      this.resume();
    }
  }

  /** 获取当前管线状态快照（深拷贝，外部修改不影响内部状态） */
  getState(): PipelineState {
    return {
      ...this.state,
      executionOrder: [...this.state.executionOrder],
      nodeStatuses: { ...this.state.nodeStatuses },
      failures: Object.fromEntries(
        Object.entries(this.state.failures).map(([k, v]) => [k, { ...v }]),
      ),
    };
  }
}
