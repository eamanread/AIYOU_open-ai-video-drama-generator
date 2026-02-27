/**
 * 节点服务基类
 * 所有节点服务必须继承此基类并实现 execute 方法
 */

import { AppNode, Connection, PortSchema, RetryConfig, NodeStatus } from '../../types';

/**
 * 节点执行结果接口
 */
export interface NodeExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  outputs?: Record<string, any>; // 输出数据（用于连接到下游节点）
  status?: NodeStatus;
}

/**
 * 节点执行上下文
 */
export interface NodeExecutionContext {
  nodeId: string;
  nodes: AppNode[];
  connections: Connection[];
  // 通过 connections 获取输入数据的方法
  getInputData: (fromNodeId: string, outputKey?: string) => any;
  // 更新节点状态的方法
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  // 更新节点数据的方法
  updateNodeData: (nodeId: string, data: any) => void;
}

// NodeStatus is re-exported from ../../types (single source of truth)
export { NodeStatus } from '../../types';

/**
 * 节点服务基类（抽象类）
 * 所有具体的节点服务都应该继承此类并实现 execute 方法
 */
export abstract class BaseNodeService {
  /**
   * 节点类型（子类必须实现）
   */
  abstract readonly nodeType: string;

  /**
   * 输入端口 Schema 声明（子类必须实现）
   */
  abstract readonly inputSchema: PortSchema[];

  /**
   * 输出端口 Schema 声明（子类必须实现）
   */
  abstract readonly outputSchema: PortSchema[];

  /**
   * 重试配置，子类可覆盖
   */
  protected retryConfig: RetryConfig = {
    maxRetries: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
    pauseAware: true,
  };

  /**
   * 暂停信号，由 PipelineEngine 外部设置
   */
  private _paused = false;

  setPaused(paused: boolean): void {
    this._paused = paused;
  }

  /**
   * 等待暂停恢复，重试间隔内感知暂停信号
   */
  protected async waitIfPaused(): Promise<void> {
    while (this._paused) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  /**
   * 执行节点逻辑（子类必须实现）
   * @param node - 当前节点
   * @param context - 执行上下文
   * @returns Promise<NodeExecutionResult>
   */
  abstract execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult>;

  /**
   * 验证输入数据（可选实现）
   * 子类可以重写此方法以提供自定义验证逻辑
   * @param node - 当前节点
   * @param context - 执行上下文
   * @returns { valid: boolean, errors: string[] }
   */
  protected validateInputs(
    node: AppNode,
    context: NodeExecutionContext
  ): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  /**
   * 更新节点状态（工具方法）
   * @param nodeId - 节点ID
   * @param status - 节点状态
   * @param context - 执行上下文
   */
  protected updateNodeStatus(
    nodeId: string,
    status: NodeStatus,
    context: NodeExecutionContext
  ): void {
    context.updateNodeStatus(nodeId, status);
  }

  /**
   * 更新节点数据（工具方法）
   * @param nodeId - 节点ID
   * @param data - 节点数据
   * @param context - 执行上下文
   */
  protected updateNodeData(
    nodeId: string,
    data: any,
    context: NodeExecutionContext
  ): void {
    context.updateNodeData(nodeId, data);
  }

  /**
   * 获取输入数据（工具方法）
   * 从连接的输入节点获取数据
   * @param node - 当前节点
   * @param context - 执行上下文
   * @returns 输入数据数组
   */
  protected getInputData(
    node: AppNode,
    context: NodeExecutionContext
  ): any[] {
    // 找到所有连接到当前节点的连接
    const inputConnections = context.connections.filter(
      conn => conn.to === node.id
    );

    // 获取所有输入节点的数据
    return inputConnections.map(conn =>
      context.getInputData(conn.from, conn.fromPort)
    );
  }

  /**
   * 获取单个输入数据（工具方法）
   * 适用于只有一个输入的节点
   * @param node - 当前节点
   * @param context - 执行上下文
   * @returns 第一个输入节点的数据
   */
  protected getSingleInput(
    node: AppNode,
    context: NodeExecutionContext
  ): any {
    const inputs = this.getInputData(node, context);
    return inputs.length > 0 ? inputs[0] : null;
  }

  /**
   * 创建成功结果（工具方法）
   * @param data - 节点数据
   * @param outputs - 输出数据
   */
  protected createSuccessResult(
    data?: any,
    outputs?: Record<string, any>
  ): NodeExecutionResult {
    return {
      success: true,
      data,
      outputs,
      status: NodeStatus.SUCCESS
    };
  }

  /**
   * 创建错误结果（工具方法）
   * @param error - 错误信息
   */
  protected createErrorResult(error: string): NodeExecutionResult {
    return {
      success: false,
      error,
      status: NodeStatus.ERROR
    };
  }

  /**
   * 执行节点（模板方法）
   * 提供统一的执行流程：验证 -> 执行 -> 错误处理
   * @param node - 当前节点
   * @param context - 执行上下文
   * @returns Promise<NodeExecutionResult>
   */
  async executeNode(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // 1. 验证输入
    const validation = this.validateInputs(node, context);
    if (!validation.valid) {
      const errorMessage = `输入验证失败: ${validation.errors.join(', ')}`;
      this.updateNodeStatus(node.id, NodeStatus.ERROR, context);
      return this.createErrorResult(errorMessage);
    }

    // 2. 更新状态为运行中
    this.updateNodeStatus(node.id, NodeStatus.RUNNING, context);

    // 3. 带重试的执行
    const { maxRetries, backoffMs, backoffMultiplier } = this.retryConfig;
    let lastError: string = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 暂停感知
        await this.waitIfPaused();

        const result = await this.execute(node, context);
        if (result.success) {
          this.updateNodeStatus(node.id, NodeStatus.SUCCESS, context);
          return result;
        }
        lastError = result.error || '执行返回失败';
      } catch (error) {
        lastError = error instanceof Error ? error.message : '未知错误';
      }

      // 还有重试机会则等待退避
      if (attempt < maxRetries) {
        const delay = backoffMs * Math.pow(backoffMultiplier, attempt);
        console.warn(`节点 ${node.id} 第 ${attempt + 1} 次失败，${delay}ms 后重试`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 4. 全部重试耗尽
    console.error(`节点 ${node.id} 重试 ${maxRetries} 次后仍失败:`, lastError);
    this.updateNodeStatus(node.id, NodeStatus.ERROR, context);
    return this.createErrorResult(lastError);
  }
}
