/**
 * 角色生成状态管理服务
 * 解决多个角色并发生成时的状态混乱问题
 */

import { CharacterProfile } from '../types';

// 角色生成任务类型
export type CharacterTaskType = 'PROFILE' | 'EXPRESSION' | 'THREE_VIEW';

// 任务状态
export type TaskStatus = 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED';

// 单个生成任务
export interface CharacterTask {
  id: string; // 全局唯一任务ID
  characterId: string; // 角色名称
  nodeId: string; // 节点ID
  taskType: CharacterTaskType;
  status: TaskStatus;
  startTime?: number;
  endTime?: number;
  error?: string;
  result?: {
    expressionSheet?: string;
    threeViewSheet?: string;
    profile?: Partial<CharacterProfile>;
  };
}

// 角色生成状态（对外展示用）
export interface CharacterGenerationState {
  characterId: string;
  characterName: string;
  nodeId: string;

  // 角色基础数据
  profile: CharacterProfile | null;

  // 生成状态
  profileStatus: TaskStatus;
  expressionStatus: TaskStatus;
  threeViewStatus: TaskStatus;

  // 生成中的任务ID（用于取消）
  currentProfileTaskId?: string;
  currentExpressionTaskId?: string;
  currentThreeViewTaskId?: string;

  // 结果数据
  expressionSheet?: string;
  threeViewSheet?: string;

  // 存储的提示词（用于重新生成）
  expressionPromptZh?: string;
  expressionPromptEn?: string;
  threeViewPromptZh?: string;
  threeViewPromptEn?: string;

  // 错误信息
  profileError?: string;
  expressionError?: string;
  threeViewError?: string;

  // UI状态
  isSaved: boolean;
}

// 生成队列项
interface QueueItem {
  task: CharacterTask;
  executor: () => Promise<any>;
  onSuccess: (result: any) => void;
  onError: (error: Error) => void;
}

class CharacterGenerationManager {
  // 存储所有节点角色的状态
  private nodeStates: Map<string, Map<string, CharacterGenerationState>> = new Map();

  // 存储所有任务（用于跟踪和取消）
  private tasks: Map<string, CharacterTask> = new Map();

  // 生成队列（确保任务按顺序执行）
  private queue: QueueItem[] = [];
  private isProcessingQueue: boolean = false;

  /**
   * 获取节点的所有角色状态
   */
  getNodeStates(nodeId: string): Map<string, CharacterGenerationState> {
    if (!this.nodeStates.has(nodeId)) {
      this.nodeStates.set(nodeId, new Map());
    }
    return this.nodeStates.get(nodeId)!;
  }

  /**
   * 获取单个角色的状态
   */
  getCharacterState(nodeId: string, characterId: string): CharacterGenerationState | null {
    const nodeStates = this.getNodeStates(nodeId);
    return nodeStates.get(characterId) || null;
  }

  /**
   * 初始化角色（当添加新角色时调用）
   */
  initializeCharacter(nodeId: string, characterId: string, characterName: string): CharacterGenerationState {
    const nodeStates = this.getNodeStates(nodeId);

    const state: CharacterGenerationState = {
      characterId,
      characterName,
      nodeId,
      profile: null,
      profileStatus: 'PENDING',
      expressionStatus: 'PENDING',
      threeViewStatus: 'PENDING',
      isSaved: false
    };

    nodeStates.set(characterId, state);
    return state;
  }

  /**
   * 更新角色状态（内部方法，保证不可变性）
   */
  private updateCharacterState(
    nodeId: string,
    characterId: string,
    updates: Partial<CharacterGenerationState>
  ): CharacterGenerationState {
    const nodeStates = this.getNodeStates(nodeId);
    const currentState = nodeStates.get(characterId);

    if (!currentState) {
      throw new Error(`Character ${characterId} not found in node ${nodeId}`);
    }

    // 不可变更新
    const newState: CharacterGenerationState = {
      ...currentState,
      ...updates
    };

    nodeStates.set(characterId, newState);
    return newState;
  }

  /**
   * 添加任务到队列
   */
  async enqueueTask(
    task: CharacterTask,
    executor: () => Promise<any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        executor,
        onSuccess: resolve,
        onError: reject
      });

      this.processQueue();
    });
  }

  /**
   * 处理队列（确保任务按顺序执行）
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.queue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      try {
        // 更新任务状态为 GENERATING
        this.updateTaskStatus(item.task.id, 'GENERATING');

        // 执行任务
        const result = await item.executor();

        // 更新任务状态为 SUCCESS
        this.updateTaskStatus(item.task.id, 'SUCCESS', result);

        item.onSuccess(result);
      } catch (error) {
        // 更新任务状态为 FAILED
        this.updateTaskStatus(item.task.id, 'FAILED', undefined, error);

        item.onError(error as Error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 更新任务状态
   */
  private updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    result?: any,
    error?: Error
  ) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // 更新任务
    task.status = status;
    task.endTime = Date.now();
    if (error) task.error = error.message;
    if (result) task.result = result;

    // 更新角色状态
    const state = this.getCharacterState(task.nodeId, task.characterId);
    if (!state) return;

    switch (task.taskType) {
      case 'PROFILE':
        if (status === 'GENERATING') {
          this.updateCharacterState(task.nodeId, task.characterId, {
            profileStatus: 'GENERATING',
            currentProfileTaskId: taskId
          });
        } else if (status === 'SUCCESS') {
          this.updateCharacterState(task.nodeId, task.characterId, {
            profileStatus: 'SUCCESS',
            profile: result || null,  // result is the CharacterProfile object itself
            currentProfileTaskId: undefined
          });
        } else if (status === 'FAILED') {
          this.updateCharacterState(task.nodeId, task.characterId, {
            profileStatus: 'FAILED',
            profileError: error?.message,
            currentProfileTaskId: undefined
          });
        }
        break;

      case 'EXPRESSION':
        if (status === 'GENERATING') {
          this.updateCharacterState(task.nodeId, task.characterId, {
            expressionStatus: 'GENERATING',
            currentExpressionTaskId: taskId
          });
        } else if (status === 'SUCCESS') {
          this.updateCharacterState(task.nodeId, task.characterId, {
            expressionStatus: 'SUCCESS',
            expressionSheet: result,  // result is the image URL string
            currentExpressionTaskId: undefined
          });
        } else if (status === 'FAILED') {
          this.updateCharacterState(task.nodeId, task.characterId, {
            expressionStatus: 'FAILED',
            expressionError: error?.message,
            currentExpressionTaskId: undefined
          });
        }
        break;

      case 'THREE_VIEW':
        if (status === 'GENERATING') {
          this.updateCharacterState(task.nodeId, task.characterId, {
            threeViewStatus: 'GENERATING',
            currentThreeViewTaskId: taskId
          });
        } else if (status === 'SUCCESS') {
          this.updateCharacterState(task.nodeId, task.characterId, {
            threeViewStatus: 'SUCCESS',
            threeViewSheet: result,  // result is the image URL string
            currentThreeViewTaskId: undefined
          });
        } else if (status === 'FAILED') {
          this.updateCharacterState(task.nodeId, task.characterId, {
            threeViewStatus: 'FAILED',
            threeViewError: error?.message,
            currentThreeViewTaskId: undefined
          });
        }
        break;
    }

    // 清理完成的任务
    if (status === 'SUCCESS' || status === 'FAILED') {
      this.tasks.delete(taskId);
    }
  }

  /**
   * 创建任务ID
   */
  private createTaskId(nodeId: string, characterId: string, taskType: CharacterTaskType): string {
    return `${nodeId}-${characterId}-${taskType}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * 生成角色档案
   */
  async generateProfile(
    nodeId: string,
    characterId: string,
    characterName: string,
    executor: () => Promise<CharacterProfile>
  ): Promise<CharacterProfile> {
    // 确保角色已初始化
    let state = this.getCharacterState(nodeId, characterId);
    if (!state) {
      state = this.initializeCharacter(nodeId, characterId, characterName);
    }

    // 创建任务
    const taskId = this.createTaskId(nodeId, characterId, 'PROFILE');
    const task: CharacterTask = {
      id: taskId,
      characterId,
      nodeId,
      taskType: 'PROFILE',
      status: 'PENDING',
      startTime: Date.now()
    };

    this.tasks.set(taskId, task);

    // 立即更新状态为GENERATING，这样UI可以立即响应
    this.updateCharacterState(nodeId, characterId, {
      profileStatus: 'GENERATING',
      currentProfileTaskId: taskId
    });

    // 添加到队列并执行
    return this.enqueueTask(task, executor);
  }

  /**
   * 生成表情图
   */
  async generateExpression(
    nodeId: string,
    characterId: string,
    characterName: string,
    executor: () => Promise<string>
  ): Promise<string> {
    // 确保角色已初始化
    let state = this.getCharacterState(nodeId, characterId);
    if (!state) {
      state = this.initializeCharacter(nodeId, characterId, characterName);
    }

    // 创建任务
    const taskId = this.createTaskId(nodeId, characterId, 'EXPRESSION');
    const task: CharacterTask = {
      id: taskId,
      characterId,
      nodeId,
      taskType: 'EXPRESSION',
      status: 'PENDING',
      startTime: Date.now()
    };

    this.tasks.set(taskId, task);

    // 立即更新状态为GENERATING，这样UI可以立即响应
    this.updateCharacterState(nodeId, characterId, {
      expressionStatus: 'GENERATING',
      currentExpressionTaskId: taskId
    });

    // 添加到队列并执行
    return this.enqueueTask(task, executor);
  }

  /**
   * 生成三视图
   */
  async generateThreeView(
    nodeId: string,
    characterId: string,
    characterName: string,
    executor: () => Promise<string>
  ): Promise<string> {
    // 确保角色已初始化
    let state = this.getCharacterState(nodeId, characterId);
    if (!state) {
      state = this.initializeCharacter(nodeId, characterId, characterName);
    }

    // 创建任务
    const taskId = this.createTaskId(nodeId, characterId, 'THREE_VIEW');
    const task: CharacterTask = {
      id: taskId,
      characterId,
      nodeId,
      taskType: 'THREE_VIEW',
      status: 'PENDING',
      startTime: Date.now()
    };

    this.tasks.set(taskId, task);

    // 立即更新状态为GENERATING，这样UI可以立即响应
    this.updateCharacterState(nodeId, characterId, {
      threeViewStatus: 'GENERATING',
      currentThreeViewTaskId: taskId
    });

    // 添加到队列并执行
    return this.enqueueTask(task, executor);
  }

  /**
   * 保存角色到库
   */
  saveCharacter(nodeId: string, characterId: string): void {
    const state = this.getCharacterState(nodeId, characterId);
    if (!state) return;

    this.updateCharacterState(nodeId, characterId, {
      isSaved: true
    });
  }

  /**
   * 删除角色
   */
  deleteCharacter(nodeId: string, characterId: string): void {
    const nodeStates = this.getNodeStates(nodeId);
    nodeStates.delete(characterId);
  }

  /**
   * 获取节点的所有角色（用于UI展示）
   */
  getCharactersForNode(nodeId: string): CharacterProfile[] {
    const nodeStates = this.getNodeStates(nodeId);
    return Array.from(nodeStates.values()).map(state => this.stateToProfile(state));
  }

  /**
   * 将内部状态转换为 CharacterProfile（兼容现有代码）
   */
  private stateToProfile(state: CharacterGenerationState): CharacterProfile {
    return {
      id: `${state.nodeId}-${state.characterId}`,
      name: state.characterName,
      alias: state.profile?.alias,
      basicStats: state.profile?.basicStats,
      profession: state.profile?.profession,
      background: state.profile?.background,
      personality: state.profile?.personality,
      motivation: state.profile?.motivation,
      values: state.profile?.values,
      weakness: state.profile?.weakness,
      relationships: state.profile?.relationships,
      habits: state.profile?.habits,
      appearance: state.profile?.appearance,

      // 生成结果
      expressionSheet: state.expressionSheet,
      threeViewSheet: state.threeViewSheet,

      // 存储的提示词
      expressionPromptZh: state.expressionPromptZh,
      expressionPromptEn: state.expressionPromptEn,
      threeViewPromptZh: state.threeViewPromptZh,
      threeViewPromptEn: state.threeViewPromptEn,

      // 状态
      status: this.getOverallStatus(state),
      error: this.getOverallError(state),

      // UI状态
      isSaved: state.isSaved,

      // 生成中的状态
      isGeneratingExpression: state.expressionStatus === 'GENERATING',
      isGeneratingThreeView: state.threeViewStatus === 'GENERATING',
      expressionError: state.expressionError,
      threeViewError: state.threeViewError,

      // 原始数据
      rawProfileData: state.profile
    } as CharacterProfile;
  }

  /**
   * 计算总体状态
   */
  private getOverallStatus(state: CharacterGenerationState): 'GENERATING' | 'SUCCESS' | 'ERROR' {
    if (state.profileStatus === 'GENERATING' ||
        state.expressionStatus === 'GENERATING' ||
        state.threeViewStatus === 'GENERATING') {
      return 'GENERATING';
    }

    if (state.profileStatus === 'FAILED' ||
        state.expressionStatus === 'FAILED' ||
        state.threeViewStatus === 'FAILED') {
      return 'ERROR';
    }

    if (state.profileStatus === 'SUCCESS') {
      return 'SUCCESS';
    }

    return 'ERROR'; // 默认为错误
  }

  /**
   * 获取总体错误信息
   */
  private getOverallError(state: CharacterGenerationState): string | undefined {
    return state.profileError || state.expressionError || state.threeViewError;
  }

  /**
   * 清理节点数据
   */
  clearNode(nodeId: string): void {
    this.nodeStates.delete(nodeId);

    // 清理该节点的所有任务
    for (const [taskId, task] of this.tasks) {
      if (task.nodeId === nodeId) {
        this.tasks.delete(taskId);
      }
    }
  }

  /**
   * 获取节点状态快照（用于调试）
   */
  getDebugSnapshot(nodeId: string): any {
    const nodeStates = this.getNodeStates(nodeId);
    const nodeTasks: CharacterTask[] = [];

    for (const [taskId, task] of this.tasks) {
      if (task.nodeId === nodeId) {
        nodeTasks.push(task);
      }
    }

    return {
      characters: Array.from(nodeStates.entries()).map(([id, state]) => ({
        id,
        name: state.characterName,
        profileStatus: state.profileStatus,
        expressionStatus: state.expressionStatus,
        threeViewStatus: state.threeViewStatus
      })),
      tasks: nodeTasks,
      queueLength: this.queue.length
    };
  }
}

// 全局单例
export const characterGenerationManager = new CharacterGenerationManager();
