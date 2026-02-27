/**
 * Storage adapter factory with feature flag routing and localStorage migration.
 * Provides graceful fallback to localStorage if IndexedDB is unavailable.
 */

import type { StateStorage } from 'zustand/middleware';
import { IndexedDBStateStorage } from '../services/storage/IndexedDBStateStorage';

const STORAGE_KEY = 'fcyh-storage';
const MIGRATED_KEY = 'fcyh-storage-migrated';

type StorageBackend = 'indexeddb' | 'localstorage';

const STORAGE_BACKEND: StorageBackend =
  ((import.meta as any).env?.VITE_STORAGE_BACKEND as StorageBackend) ?? 'indexeddb';

/**
 * Create the appropriate storage adapter based on feature flag + availability.
 */
export function createStorageAdapter(): StateStorage {
  if (STORAGE_BACKEND === 'localstorage') {
    return localStorage;
  }

  try {
    if (typeof indexedDB === 'undefined') {
      console.warn('[Storage] IndexedDB 不可用，降级到 localStorage');
      return localStorage;
    }
    return new IndexedDBStateStorage();
  } catch (e) {
    console.warn('[Storage] IndexedDB 初始化失败，降级到 localStorage', e);
    return localStorage;
  }
}

/**
 * One-time migration from localStorage to IndexedDB.
 * Called on app startup. Safe to call multiple times — no-ops if already migrated.
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  if (STORAGE_BACKEND === 'localstorage') return false;
  if (localStorage.getItem(MIGRATED_KEY)) return false;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const adapter = new IndexedDBStateStorage();
    await adapter.setItem(STORAGE_KEY, raw);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
    console.info('[Storage] localStorage → IndexedDB 迁移完成');
    return true;
  } catch (e) {
    console.error('[Storage] 迁移失败，保留 localStorage 数据', e);
    return false;
  }
}
