// hooks/useCanvasState.ts
import { useState, useCallback, useRef } from 'react';

interface CanvasState {
  pan: { x: number; y: number };
  scale: number;
  isDraggingCanvas: boolean;
}

interface MouseState {
  x: number;
  y: number;
}

/**
 * 画布状态管理 Hook
 * 管理平移、缩放、拖拽等画布交互状态
 */
export function useCanvasState() {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const panStartRef = useRef({ x: 0, y: 0 });
  const mouseStartRef = useRef({ x: 0, y: 0 });

  /**
   * 开始拖拽画布
   */
  const startCanvasDrag = useCallback((clientX: number, clientY: number) => {
    setIsDraggingCanvas(true);
    panStartRef.current = pan;
    mouseStartRef.current = { x: clientX, y: clientY };
  }, [pan]);

  /**
   * 拖拽画布中
   */
  const dragCanvas = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingCanvas) return;

    const dx = clientX - mouseStartRef.current.x;
    const dy = clientY - mouseStartRef.current.y;

    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy
    });
  }, [isDraggingCanvas]);

  /**
   * 结束拖拽画布
   */
  const endCanvasDrag = useCallback(() => {
    setIsDraggingCanvas(false);
  }, []);

  /**
   * 缩放画布（以指定屏幕坐标为中心）
   * @param delta 缩放增量
   * @param screenX 缩放中心的屏幕 X 坐标（可选）
   * @param screenY 缩放中心的屏幕 Y 坐标（可选）
   */
  const zoomCanvas = useCallback((delta: number, screenX?: number, screenY?: number) => {
    if (screenX !== undefined && screenY !== undefined) {
      // 以鼠标位置为中心缩放
      // 1. 计算鼠标在当前画布世界坐标系中的位置
      const worldX = (screenX - pan.x) / scale;
      const worldY = (screenY - pan.y) / scale;

      // 2. 应用新缩放
      const newScale = Math.max(0.2, Math.min(3, scale + delta));

      // 3. 计算新的平移值，使鼠标下的世界坐标点保持在鼠标下方
      const newPanX = screenX - worldX * newScale;
      const newPanY = screenY - worldY * newScale;

      setPan({ x: newPanX, y: newPanY });
      setScale(newScale);
    } else {
      // 无中心点，简单缩放
      setScale(prevScale => Math.max(0.2, Math.min(3, prevScale + delta)));
    }
  }, [pan, scale]);

  /**
   * 重置画布视图
   */
  const resetCanvas = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setScale(1);
  }, []);

  /**
   * 更新鼠标位置
   */
  const updateMousePos = useCallback((clientX: number, clientY: number) => {
    setMousePos({ x: clientX, y: clientY });
  }, []);

  /**
   * 屏幕坐标转换为画布坐标
   */
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - pan.x) / scale,
      y: (screenY - pan.y) / scale
    };
  }, [pan, scale]);

  /**
   * 画布坐标转换为屏幕坐标
   */
  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    return {
      x: canvasX * scale + pan.x,
      y: canvasY * scale + pan.y
    };
  }, [pan, scale]);

  return {
    // 状态
    pan,
    scale,
    isDraggingCanvas,
    mousePos,

    // 操作
    setPan,
    setScale,
    setIsDraggingCanvas,
    startCanvasDrag,
    dragCanvas,
    endCanvasDrag,
    zoomCanvas,
    resetCanvas,
    updateMousePos,

    // 工具函数
    screenToCanvas,
    canvasToScreen
  };
}
