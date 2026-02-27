import React, { useState } from 'react';
import { FolderPlus, Trash2, Edit, Check, X, ChevronRight } from 'lucide-react';
import { useProjectStore } from '../stores/project.store';
import type { Project } from '../types';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProjectRowProps {
  project: Project;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

const ProjectRow: React.FC<ProjectRowProps> = ({ project, isActive, onSelect, onRename, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [confirming, setConfirming] = useState(false);

  const commitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) onRename(trimmed);
    else setName(project.name);
    setEditing(false);
  };

  return (
    <div
      onClick={() => !editing && onSelect()}
      className={`group flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors ${
        isActive ? 'bg-blue-600/20 border-l-2 border-blue-500' : 'hover:bg-white/5 border-l-2 border-transparent'
      }`}
    >
      <ChevronRight size={14} className={`shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setName(project.name); setEditing(false); } }}
              className="flex-1 min-w-0 px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-sm text-white outline-none focus:border-blue-500"
            />
            <button onClick={commitRename} className="p-0.5 text-green-400 hover:text-green-300"><Check size={14} /></button>
            <button onClick={() => { setName(project.name); setEditing(false); }} className="p-0.5 text-gray-400 hover:text-white"><X size={14} /></button>
          </div>
        ) : (
          <>
            <p className="text-sm text-white truncate">{project.name}</p>
            <p className="text-[11px] text-gray-500">
              {project.workflows.length} 个工作流 · {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </>
        )}
      </div>

      {!editing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10">
            <Edit size={13} />
          </button>
          {confirming ? (
            <button onClick={() => { onDelete(); setConfirming(false); }} className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-500/10">
              <Check size={13} />
            </button>
          ) : (
            <button onClick={() => setConfirming(true)} className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-white/10">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const ProjectManager: React.FC<ProjectManagerProps> = ({ isOpen, onClose }) => {
  const { projects, activeProjectId, createProject, deleteProject, renameProject, setActiveProject } = useProjectStore();

  if (!isOpen) return null;

  const handleCreate = () => {
    createProject(`新项目 ${projects.length + 1}`);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-white font-medium">项目管理</h2>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* New Project */}
      <div className="p-3">
        <button onClick={handleCreate} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors">
          <FolderPlus size={16} /> 新建项目
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="text-center text-gray-500 text-sm mt-8">暂无项目，点击上方按钮创建</p>
        ) : (
          projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              onSelect={() => setActiveProject(project.id)}
              onRename={(name) => renameProject(project.id, name)}
              onDelete={() => deleteProject(project.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectManager;
