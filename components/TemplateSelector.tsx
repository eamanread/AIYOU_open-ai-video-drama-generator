import React from 'react';
import { Play, Pause, SkipForward, CheckCircle, XCircle, Clock, Zap, X } from 'lucide-react';
import { WORKFLOW_TEMPLATES } from '../services/workflowTemplates';
import type { PipelineState, PipelineStatus, NodeRunStatus } from '../types';

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: string) => void;
  pipelineState?: PipelineState;
  onPause?: () => void;
  onResume?: () => void;
  onSkip?: () => void;
}

const TEMPLATE_DESC: Record<string, string> = {
  template_a: '剧本→资产→分镜→提交，仅画风确认',
  template_b: '从剧目分析到平台提交，逐步确认',
  template_c: '跳过资产生成，直接出分镜和视频提示词',
  template_d: '专注角色/场景/道具资产打磨，逐节点确认',
  template_e: '剧目分析→精炼→规划→分集，专注剧本质量',
};

const STATUS_STYLE: Record<PipelineStatus, { color: string; label: string }> = {
  idle:         { color: 'bg-gray-600',  label: '空闲' },
  running:      { color: 'bg-blue-500 animate-pulse', label: '运行中' },
  paused:       { color: 'bg-yellow-500', label: '已暂停' },
  waiting_user: { color: 'bg-yellow-400', label: '等待确认' },
  completed:    { color: 'bg-green-500',  label: '已完成' },
  error:        { color: 'bg-red-500',    label: '出错' },
};

const NODE_ICON: Record<NodeRunStatus, React.ReactNode> = {
  pending: <Clock size={14} className="text-gray-400" />,
  running: <Play size={14} className="text-blue-400 animate-pulse" />,
  success: <CheckCircle size={14} className="text-green-400" />,
  error:   <XCircle size={14} className="text-red-400" />,
  skipped: <SkipForward size={14} className="text-gray-500" />,
  waiting: <Clock size={14} className="text-yellow-400" />,
};

/* ── TemplateCard ─────────────────────────────────────────── */
function TemplateCard({ id, name, nodeCount, mode, onClick }: {
  id: string; name: string; nodeCount: number; mode: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-gray-700 bg-gray-800
                 hover:border-blue-500 hover:bg-gray-750 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-white font-medium text-sm">{name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
          {mode === 'one_click' ? '全自动' : '逐步确认'}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-1.5">{TEMPLATE_DESC[id] ?? ''}</p>
      <div className="flex items-center gap-1 text-[11px] text-gray-500">
        <Zap size={12} /> {nodeCount} 个节点
      </div>
    </button>
  );
}

/* ── PipelineStatusPanel ─────────────────────────────────── */
function PipelineStatusPanel({ state, onPause, onResume, onSkip }: {
  state: PipelineState; onPause?: () => void; onResume?: () => void; onSkip?: () => void;
}) {
  const { status, executionOrder, nodeStatuses, currentIndex } = state;
  const style = STATUS_STYLE[status];

  return (
    <div className="border-t border-gray-700 flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${style.color}`} />
          <span className="text-xs text-gray-300">{style.label}</span>
        </div>
        <span className="text-xs text-gray-500">{currentIndex} / {executionOrder.length}</span>
      </div>

      {/* node list */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
        {executionOrder.map((nodeId) => (
          <div key={nodeId} className="flex items-center gap-2 py-0.5">
            {NODE_ICON[nodeStatuses[nodeId] ?? 'pending']}
            <span className="text-xs text-gray-400 truncate">{nodeId}</span>
          </div>
        ))}
      </div>

      {/* control buttons */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-700">
        {status === 'running' && onPause && (
          <button onClick={onPause} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-500 text-white">
            <Pause size={12} /> 暂停
          </button>
        )}
        {status === 'paused' && onResume && (
          <button onClick={onResume} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white">
            <Play size={12} /> 继续
          </button>
        )}
        {(status === 'running' || status === 'paused') && onSkip && (
          <button onClick={onSkip} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300">
            <SkipForward size={12} /> 跳过
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
function TemplateSelector({
  isOpen, onClose, onSelectTemplate, pipelineState, onPause, onResume, onSkip,
}: TemplateSelectorProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-gray-900 border-l border-gray-700 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-white font-medium">工作流模板</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Template cards */}
      <div className="p-3 space-y-3">
        {WORKFLOW_TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            id={t.id}
            name={t.name}
            nodeCount={t.nodes.length}
            mode={t.executionMode}
            onClick={() => onSelectTemplate(t.id)}
          />
        ))}
      </div>

      {/* Pipeline status (if active) */}
      {pipelineState && (
        <PipelineStatusPanel
          state={pipelineState}
          onPause={onPause}
          onResume={onResume}
          onSkip={onSkip}
        />
      )}
    </div>
  );
}

export default TemplateSelector;
