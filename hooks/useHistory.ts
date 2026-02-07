// hooks/useHistory.ts
import { useState, useCallback, useRef } from 'react';
import { AppNode, Connection, Group } from '../types';

interface HistoryState {
  nodes: AppNode[];
  connections: Connection[];
  groups: Group[];
}

/**
 * 历史记录管理 Hook
 * 实现撤销/重做功能
 */
export function useHistory(maxHistorySize = 50) {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  /**
   * 保存当前状态到历史记录
   */
  const saveToHistory = useCallback((
    nodes: AppNode[],
    connections: Connection[],
    groups: Group[]
  ) => {
    const newState: HistoryState = {
      nodes: structuredClone(nodes),
      connections: structuredClone(connections),
      groups: structuredClone(groups)
    };

    setHistory(prev => {
      // 如果当前不在历史记录的末尾,则丢弃后面的记录
      const newHistory = prev.slice(0, historyIndex + 1);

      // 添加新状态
      newHistory.push(newState);

      // 限制历史记录大小
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        setHistoryIndex(prev => prev); // 保持索引不变
      } else {
        setHistoryIndex(newHistory.length - 1);
      }

      return newHistory;
    });
  }, [historyIndex, maxHistorySize]);

  /**
   * 撤销
   */
  const undo = useCallback((): HistoryState | null => {
    if (historyIndex <= 0) return null;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    return history[newIndex];
  }, [history, historyIndex]);

  /**
   * 重做
   */
  const redo = useCallback((): HistoryState | null => {
    if (historyIndex >= history.length - 1) return null;

    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    return history[newIndex];
  }, [history, historyIndex]);

  /**
   * 清空历史记录
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  /**
   * 获取当前状态
   */
  const getCurrentState = useCallback((): HistoryState | null => {
    if (historyIndex < 0 || historyIndex >= history.length) return null;
    return history[historyIndex];
  }, [history, historyIndex]);

  return {
    // 状态
    history,
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,

    // 操作
    saveToHistory,
    undo,
    redo,
    clearHistory,
    getCurrentState
  };
}
