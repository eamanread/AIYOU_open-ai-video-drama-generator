/**
 * Project 层状态管理
 *
 * 功能：
 * - Project CRUD
 * - 共享资产池管理
 * - 工作流关联
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Project,
  AssetLibrary,
  StyleConfig,
  RetryConfig,
  Workflow,
  CharacterProfile,
  SceneAssetData,
  PropAssetData,
} from '../types';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;

  // Project CRUD
  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setActiveProject: (id: string) => void;
  getActiveProject: () => Project | null;

  // 共享资产池
  updateSharedStyle: (style: StyleConfig) => void;
  addCharacterAsset: (char: CharacterProfile) => void;
  addSceneAsset: (scene: SceneAssetData) => void;
  addPropAsset: (prop: PropAssetData) => void;

  // 工作流关联
  addWorkflowToProject: (workflow: Workflow) => void;
  removeWorkflowFromProject: (workflowId: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => ({
    // ========== 初始状态 ==========
    projects: [],
    activeProjectId: null,

    // ========== Project CRUD ==========
    createProject: (name) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      const project: Project = {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        sharedStyle: null,
        sharedAssets: { characters: [], scenes: [], props: [] },
        workflows: [],
        settings: {
          defaultModel: 'gemini',
          retryConfig: {
            maxRetries: 3,
            backoffMs: 1000,
            backoffMultiplier: 2,
            pauseAware: true,
          },
          apiConfig: { provider: 'gemini' },
        },
      };
      set((state) => {
        state.projects.push(project);
        state.activeProjectId = id;
      });
      return id;
    },

    deleteProject: (id) =>
      set((state) => {
        state.projects = state.projects.filter((p) => p.id !== id);
        if (state.activeProjectId === id) {
          state.activeProjectId = state.projects[0]?.id ?? null;
        }
      }),

    renameProject: (id, name) =>
      set((state) => {
        const p = state.projects.find((p) => p.id === id);
        if (p) {
          p.name = name;
          p.updatedAt = Date.now();
        }
      }),

    setActiveProject: (id) =>
      set((state) => {
        state.activeProjectId = id;
      }),

    getActiveProject: () => {
      const { projects, activeProjectId } = get();
      return projects.find((p) => p.id === activeProjectId) ?? null;
    },

    // ========== 共享资产池 ==========
    updateSharedStyle: (style) =>
      set((state) => {
        const p = state.projects.find((p) => p.id === state.activeProjectId);
        if (p) {
          p.sharedStyle = style;
          p.updatedAt = Date.now();
        }
      }),

    addCharacterAsset: (char) =>
      set((state) => {
        const p = state.projects.find((p) => p.id === state.activeProjectId);
        if (p) {
          p.sharedAssets.characters.push(char);
          p.updatedAt = Date.now();
        }
      }),

    addSceneAsset: (scene) =>
      set((state) => {
        const p = state.projects.find((p) => p.id === state.activeProjectId);
        if (p) {
          p.sharedAssets.scenes.push(scene);
          p.updatedAt = Date.now();
        }
      }),

    addPropAsset: (prop) =>
      set((state) => {
        const p = state.projects.find((p) => p.id === state.activeProjectId);
        if (p) {
          p.sharedAssets.props.push(prop);
          p.updatedAt = Date.now();
        }
      }),

    // ========== 工作流关联 ==========
    addWorkflowToProject: (workflow) =>
      set((state) => {
        const p = state.projects.find((p) => p.id === state.activeProjectId);
        if (p) {
          p.workflows.push(workflow);
          p.updatedAt = Date.now();
        }
      }),

    removeWorkflowFromProject: (workflowId) =>
      set((state) => {
        const p = state.projects.find((p) => p.id === state.activeProjectId);
        if (p) {
          p.workflows = p.workflows.filter((w) => w.id !== workflowId);
          p.updatedAt = Date.now();
        }
      }),
  }))
);
