import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useEditorStore } from '../stores/editor.store';
import { useAppStore } from '../stores/app.store';
import { MemoizedConnectionLayer } from './ConnectionLayer';
import type { AppNode, Connection } from '../types';

// Constants
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;
const SNAP_GRID = 20;
const DEFAULT_NODE_WIDTH = 420;

// --------------- Coordinate helpers ---------------

function screenToWorld(
  sx: number, sy: number,
  vp: { x: number; y: number; zoom: number },
) {
  return { x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom };
}

// AABB collision for box-select
function intersectsRect(
  rect: { x: number; y: number; w: number; h: number },
  node: AppNode,
) {
  const nw = node.width || DEFAULT_NODE_WIDTH;
  const nh = getNodeHeight(node);
  return (
    rect.x < node.x + nw &&
    rect.x + rect.w > node.x &&
    rect.y < node.y + nh &&
    rect.y + rect.h > node.y
  );
}

/** Approximate node height – mirrors existing nodeHelpers logic */
function getNodeHeight(node: AppNode): number {
  if (node.type === 'STORYBOARD_GENERATOR') return 500;
  if (node.type === 'CHARACTER_NODE') return 600;
  return 360;
}

// --------------- Component ---------------

interface CanvasBoardProps {
  className?: string;
  renderNode: (node: AppNode) => React.ReactNode;
}

export const CanvasBoard: React.FC<CanvasBoardProps> = ({ className, renderNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Store state
  const nodes = useEditorStore(s => s.nodes);
  const connections = useEditorStore(s => s.connections);
  const selectedNodeIds = useEditorStore(s => s.selectedNodeIds);
  const connectionStart = useEditorStore(s => s.connectionStart);
  const selectionRect = useEditorStore(s => s.selectionRect);
  const viewport = useAppStore(s => s.viewport);
  const setViewport = useAppStore(s => s.setViewport);

  // Store actions
  const setNodes = useEditorStore(s => s.setNodes);
  const addConnection = useEditorStore(s => s.addConnection);
  const setSelectedNodeIds = useEditorStore(s => s.setSelectedNodeIds);
  const setDraggingNodeId = useEditorStore(s => s.setDraggingNodeId);
  const setConnectionStart = useEditorStore(s => s.setConnectionStart);
  const setSelectionRect = useEditorStore(s => s.setSelectionRect);

  // Local refs – avoid re-renders during drag
  const dragRef = useRef<{
    nodeId: string; offsetX: number; offsetY: number; selected: string[];
  } | null>(null);
  const panRef = useRef<{
    startX: number; startY: number; vpX: number; vpY: number;
  } | null>(null);
  const selectRef = useRef<{ startX: number; startY: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);

  // --------------- Wheel zoom (anchor at cursor) ---------------

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * factor));
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    setViewport({
      x: sx - (sx - viewport.x) * (newZoom / viewport.zoom),
      y: sy - (sy - viewport.y) * (newZoom / viewport.zoom),
      zoom: newZoom,
    });
  }, [viewport, setViewport]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // --------------- Mouse down dispatcher ---------------

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 1) Output port -> start connection
    if (target.dataset.portType === 'output' && target.dataset.nodeId) {
      const portRect = target.getBoundingClientRect();
      setConnectionStart({
        id: target.dataset.nodeId,
        x: portRect.left + portRect.width / 2,
        y: portRect.top + portRect.height / 2,
      });
      return;
    }

    // 2) Node element -> start drag
    const nodeEl = target.closest('[data-node-id]') as HTMLElement | null;
    if (nodeEl?.dataset.nodeId) {
      const nodeId = nodeEl.dataset.nodeId;
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      const wp = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, viewport);
      const selected = selectedNodeIds.includes(nodeId) ? selectedNodeIds : [nodeId];
      if (!selectedNodeIds.includes(nodeId)) setSelectedNodeIds([nodeId]);
      dragRef.current = {
        nodeId, offsetX: wp.x - node.x, offsetY: wp.y - node.y, selected,
      };
      setDraggingNodeId(nodeId);
      return;
    }

    // 3) Middle button -> pan
    if (e.button === 1) {
      panRef.current = {
        startX: e.clientX, startY: e.clientY,
        vpX: viewport.x, vpY: viewport.y,
      };
      return;
    }

    // 4) Empty canvas -> box select
    if (target === containerRef.current || target.closest('[data-canvas-bg]')) {
      if (!e.shiftKey) setSelectedNodeIds([]);
      selectRef.current = {
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
      };
    }
  }, [nodes, viewport, selectedNodeIds, setConnectionStart, setDraggingNodeId, setSelectedNodeIds]);

  // --------------- Global mousemove / mouseup ---------------

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Connection dragging
      if (connectionStart) {
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      // Node dragging (rAF-throttled)
      if (dragRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          if (!dragRef.current) return;
          const wp = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, viewport);
          const snapX = Math.round((wp.x - dragRef.current.offsetX) / SNAP_GRID) * SNAP_GRID;
          const snapY = Math.round((wp.y - dragRef.current.offsetY) / SNAP_GRID) * SNAP_GRID;
          const primary = nodes.find(n => n.id === dragRef.current!.nodeId);
          if (!primary) return;
          const dx = snapX - primary.x;
          const dy = snapY - primary.y;
          if (dx === 0 && dy === 0) return;
          setNodes(prev =>
            prev.map(n =>
              dragRef.current!.selected.includes(n.id)
                ? { ...n, x: n.x + dx, y: n.y + dy }
                : n,
            ),
          );
        });
      }

      // Panning
      if (panRef.current) {
        setViewport({
          x: panRef.current.vpX + (e.clientX - panRef.current.startX),
          y: panRef.current.vpY + (e.clientY - panRef.current.startY),
          zoom: viewport.zoom,
        });
      }

      // Box select
      if (selectRef.current) {
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const rx = Math.min(selectRef.current.startX, sx);
        const ry = Math.min(selectRef.current.startY, sy);
        const rw = Math.abs(sx - selectRef.current.startX);
        const rh = Math.abs(sy - selectRef.current.startY);
        setSelectionRect({ x: rx, y: ry, width: rw, height: rh });

        const worldRect = {
          x: (rx - viewport.x) / viewport.zoom,
          y: (ry - viewport.y) / viewport.zoom,
          w: rw / viewport.zoom,
          h: rh / viewport.zoom,
        };
        setSelectedNodeIds(nodes.filter(n => intersectsRect(worldRect, n)).map(n => n.id));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Finish connection
      if (connectionStart) {
        const target = e.target as HTMLElement;
        if (target.dataset.portType === 'input' && target.dataset.nodeId) {
          addConnection({
            from: connectionStart.id,
            to: target.dataset.nodeId,
          } as Connection);
        }
        setConnectionStart(null);
        setMousePos(null);
      }
      if (dragRef.current) { dragRef.current = null; setDraggingNodeId(null); }
      panRef.current = null;
      if (selectRef.current) { selectRef.current = null; setSelectionRect(null); }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    connectionStart, viewport, nodes, setNodes, setViewport,
    addConnection, setConnectionStart, setDraggingNodeId,
    setSelectionRect, setSelectedNodeIds,
  ]);

  // --------------- Render ---------------

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#0a0a0a] ${className || ''}`}
      onMouseDown={handleMouseDown}
      data-canvas-bg
    >
      {/* Transform layer (zoom + pan) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          willChange: 'transform',
        }}
      >
        {/* SVG connection layer */}
        <svg
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', overflow: 'visible',
          }}
        >
          <MemoizedConnectionLayer
            nodes={nodes}
            connections={connections}
            scale={viewport.zoom}
            pan={{ x: viewport.x, y: viewport.y }}
            connectionStart={connectionStart}
            mousePos={mousePos ?? undefined}
            getNodeHeight={getNodeHeight}
          />
        </svg>

        {/* Node cards */}
        {nodes.map(node => (
          <div
            key={node.id}
            data-node-id={node.id}
            style={{
              position: 'absolute',
              left: node.x,
              top: node.y,
              width: node.width || DEFAULT_NODE_WIDTH,
            }}
            className={
              selectedNodeIds.includes(node.id) ? 'ring-2 ring-cyan-400 rounded-xl' : ''
            }
          >
            {renderNode(node)}
          </div>
        ))}
      </div>

      {/* Selection rect overlay (screen-space, unaffected by transform) */}
      {selectionRect && (
        <div
          style={{
            position: 'absolute',
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height,
            border: '1px solid rgba(34, 211, 238, 0.5)',
            backgroundColor: 'rgba(34, 211, 238, 0.1)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};
