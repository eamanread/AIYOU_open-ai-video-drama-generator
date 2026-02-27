/**
 * Technical Spike: IndexedDB Persistence Service
 * Proof-of-concept for migrating from zustand/persist (localStorage) to IndexedDB.
 * Uses native IndexedDB API with Promise wrappers.
 * TODO: Replace with Dexie.js for cleaner syntax once dependency is approved.
 */

import type { Project, Workflow } from '../../types';

// ─── Schema Constants ───────────────────────────────────────────────
const DB_NAME = 'DramaGeneratorDB';
const DB_VERSION = 1;

const STORES = {
  projects: 'projects',   // PK: id, indexes: name, updatedAt
  assets: 'assets',       // PK: [projectId, type, assetId], indexes: projectId, type
  blobs: 'blobs',         // PK: id, indexes: projectId, type
} as const;

type BlobType = 'image' | 'video' | 'audio';

interface BlobEntry {
  id: string;
  projectId: string;
  type: BlobType;
  data: Blob;
}

interface StrippedResult {
  stripped: Project;
  blobEntries: BlobEntry[];
}

// ─── Promise wrapper for IDB requests ───────────────────────────────
function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Blob Stripping Helper ──────────────────────────────────────────
const BASE64_PATTERN = /^data:(image|video|audio)\/[^;]+;base64,/;

export function stripBlobsFromProject(project: Project): StrippedResult {
  const blobEntries: BlobEntry[] = [];
  const stripped = structuredClone(project);

  stripped.workflows.forEach((wf: Workflow) => {
    wf.nodes.forEach((node: any) => {
      const data = node.data;
      if (!data) return;

      // Check common fields that hold base64 data
      for (const key of ['imageData', 'videoData', 'audioData', 'thumbnail'] as const) {
        const val = data[key];
        if (typeof val !== 'string' || !BASE64_PATTERN.test(val)) continue;

        const match = val.match(BASE64_PATTERN)!;
        const mimeType = match[0].slice(5, match[0].indexOf(';'));
        const type = match[1] as BlobType;
        const blobId = `${project.id}_${wf.id}_${node.id}_${key}`;

        // Convert base64 to Blob
        const byteString = atob(val.split(',')[1]);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);

        blobEntries.push({ id: blobId, projectId: project.id, type, data: new Blob([bytes], { type: mimeType }) });
        data[key] = `blob://${blobId}`; // Replace with reference
      }
    });
  });

  return { stripped, blobEntries };
}

// ─── IDBStorageService ──────────────────────────────────────────────
class IDBStorageService {
  private db: IDBDatabase | null = null;

  /** Open database with schema upgrade handling */
  async open(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        // TODO: Dexie handles version migrations declaratively — stores({ ... })
        if (!db.objectStoreNames.contains(STORES.projects)) {
          const ps = db.createObjectStore(STORES.projects, { keyPath: 'id' });
          ps.createIndex('name', 'name', { unique: false });
          ps.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.assets)) {
          const as_ = db.createObjectStore(STORES.assets, { keyPath: ['projectId', 'type', 'assetId'] });
          as_.createIndex('projectId', 'projectId', { unique: false });
          as_.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.blobs)) {
          const bs = db.createObjectStore(STORES.blobs, { keyPath: 'id' });
          bs.createIndex('projectId', 'projectId', { unique: false });
          bs.createIndex('type', 'type', { unique: false });
        }
      };

      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  private tx(stores: string | string[], mode: IDBTransactionMode = 'readonly') {
    if (!this.db) throw new Error('Database not open. Call open() first.');
    return this.db.transaction(stores, mode);
  }

  async saveProject(project: Project): Promise<void> {
    const { stripped, blobEntries } = stripBlobsFromProject(project);
    const txn = this.tx([STORES.projects, STORES.blobs], 'readwrite');
    txn.objectStore(STORES.projects).put(stripped);
    // TODO: Dexie.js bulkPut() would batch this nicely
    for (const entry of blobEntries) {
      txn.objectStore(STORES.blobs).put(entry);
    }
    return new Promise((resolve, reject) => {
      txn.oncomplete = () => resolve();
      txn.onerror = () => reject(txn.error);
    });
  }

  async loadProject(id: string): Promise<Project | undefined> {
    const store = this.tx(STORES.projects).objectStore(STORES.projects);
    return idbRequest(store.get(id));
  }

  async listProjects(): Promise<Project[]> {
    const store = this.tx(STORES.projects).objectStore(STORES.projects);
    const idx = store.index('updatedAt');
    // TODO: Dexie — table.orderBy('updatedAt').reverse().toArray()
    const all: Project[] = await idbRequest(idx.getAll());
    return all.reverse(); // desc
  }

  async deleteProject(id: string): Promise<void> {
    const txn = this.tx([STORES.projects, STORES.assets, STORES.blobs], 'readwrite');
    txn.objectStore(STORES.projects).delete(id);
    // Delete associated blobs by projectId index
    const blobIdx = txn.objectStore(STORES.blobs).index('projectId');
    const blobKeys: IDBValidKey[] = await idbRequest(blobIdx.getAllKeys(id));
    for (const key of blobKeys) txn.objectStore(STORES.blobs).delete(key);
    // Delete associated assets
    const assetIdx = txn.objectStore(STORES.assets).index('projectId');
    const assetKeys: IDBValidKey[] = await idbRequest(assetIdx.getAllKeys(id));
    for (const key of assetKeys) txn.objectStore(STORES.assets).delete(key);

    return new Promise((resolve, reject) => {
      txn.oncomplete = () => resolve();
      txn.onerror = () => reject(txn.error);
    });
  }

  async saveBlob(projectId: string, type: BlobType, id: string, data: Blob): Promise<void> {
    const store = this.tx(STORES.blobs, 'readwrite').objectStore(STORES.blobs);
    await idbRequest(store.put({ id, projectId, type, data }));
  }

  async loadBlob(id: string): Promise<Blob | undefined> {
    const store = this.tx(STORES.blobs).objectStore(STORES.blobs);
    const entry = await idbRequest(store.get(id));
    return entry?.data;
  }

  async getStorageUsage(): Promise<{ usage: number; quota: number }> {
    // TODO: Dexie has no built-in for this either — navigator.storage is the way
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  }
}

export const idbStorage = new IDBStorageService();
