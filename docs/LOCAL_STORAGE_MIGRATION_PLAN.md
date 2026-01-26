# 本地数据库存储架构改造完整规划

## 一、项目目标

将系统从"云端依赖"改造为"本地优先"架构：
- ✅ 所有媒体文件（图片、视频、音频）本地持久化存储
- ✅ 保留前端API请求机制
- ✅ API响应数据自动保存到本地
- ✅ 通过接口层访问本地数据
- ✅ 工作流、角色管理、历史记录全部本地化

## 二、当前架构分析

### 2.1 存储现状

| 存储类型 | 当前方式 | 存储位置 | 问题 |
|---------|---------|---------|------|
| 节点数据 | localStorage | 浏览器 | 容量限制（5-10MB） |
| 图片 | Base64 | nodes.data.images | 内存占用大 |
| 视频 | URL引用 | nodes.data.videoUrl | 依赖网络，无缓存 |
| 音频 | Base64 | nodes.data.audioUri | 内存占用大 |
| 角色 | 对象引用 | nodes.data.generatedCharacters | 无持久化 |
| 工作流 | localStorage | 浏览器 | 容量限制 |

### 2.2 API调用点

**核心服务文件**：
- `services/geminiService.ts` - Gemini API（图片、视频、音频、剧本、角色）
- `services/soraService.ts` - Sora API（视频生成）
- `services/nodes/*.service.ts` - 节点执行服务

**需要拦截的API方法**（共21个）：

```typescript
// 图片生成（2个）
- generateImageFromText
- editImageWithText

// 视频生成（2个）
- generateVideo
- analyzeVideo

// 音频生成（1个）
- generateAudio

// 角色生成（4个）
- extractCharactersFromText
- generateCharacterProfile
- generateSupportingCharacter
- detectTextInImage

// 剧本生成（3个）
- generateScriptPlanner
- generateScriptEpisodes
- generateCinematicStoryboard

// 其他（9个）
- extractLastFrame
- generateStylePreset
- analyzeDrama
- orchestrateVideoPrompt
- planStoryboard
- generateDetailedStoryboard
- extractRefinedTags
```

### 2.3 数据流向

```
当前流程：
用户输入 → 节点服务 → API请求 → 响应数据 → 节点数据 → UI显示

问题：
❌ 每次刷新页面都需要重新生成
❌ 依赖网络连接
❌ API调用成本高
❌ 大文件占用内存
```

## 三、目标架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│                     (React Components)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      接口适配层                              │
│                  (API Interceptor Layer)                    │
│  ┌──────────────────┬──────────────────┬────────────────┐  │
│  │  请求拦截器      │   响应拦截器     │  数据获取层    │  │
│  │  Request Hook    │  Response Hook   │  Data Provider │  │
│  └──────────────────┴──────────────────┴────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼               ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  API请求层   │ │ 本地存储 │ │  缓存管理   │
│  (保留)      │ │(IndexedDB)│ │  (LRU)      │
└──────────────┘ └──────────┘ └──────────────┘
```

### 3.2 存储层次

```
L1: 内存缓存（React State）
     ↓
L2: IndexedDB（本地数据库）
     ↓
L3: File System Access API（用户本地文件夹）
```

### 3.3 数据库设计

#### 3.3.1 IndexedDB数据库结构

```sql
-- 数据库名：AIYOU_LOCAL_DB
-- 版本：2

-- 表1：媒体文件（media_files）
CREATE TABLE media_files (
  id VARCHAR(36) PRIMARY KEY,
  node_id VARCHAR(36) NOT NULL,
  node_type VARCHAR(50) NOT NULL,
  media_type ENUM('image', 'video', 'audio') NOT NULL,
  file_data BLOB, -- 二进制数据
  file_path VARCHAR(500), -- 本地文件路径（使用FileSystem API）
  original_url TEXT, -- API返回的原始URL
  original_base64 TEXT, -- API返回的原始Base64
  file_size BIGINT,
  width INT,
  height INT,
  duration DECIMAL(10, 2),
  mime_type VARCHAR(100),
  format VARCHAR(20),
  metadata JSON, -- 其他元数据
  created_at DATETIME,
  last_accessed DATETIME,
  access_count INT DEFAULT 0,
  INDEX idx_node_id (node_id),
  INDEX idx_media_type (media_type),
  INDEX idx_created_at (created_at)
);

-- 表2：角色数据（characters）
CREATE TABLE characters (
  id VARCHAR(36) PRIMARY KEY,
  node_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  character_data JSON NOT NULL, -- CharacterProfile对象
  expression_sheet_id VARCHAR(36), -- 关联media_files.id
  three_view_sheet_id VARCHAR(36), -- 关联media_files.id
  role_type ENUM('main', 'supporting') DEFAULT 'main',
  original_prompt TEXT,
  generation_metadata JSON,
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_node_id (node_id),
  INDEX idx_name (name)
);

-- 表3：API请求历史（api_requests）
CREATE TABLE api_requests (
  id VARCHAR(36) PRIMARY KEY,
  node_id VARCHAR(36) NOT NULL,
  request_type VARCHAR(50) NOT NULL,
  endpoint VARCHAR(200) NOT NULL,
  request_params JSON NOT NULL,
  response_data JSON,
  cached_media_id VARCHAR(36), -- 关联media_files.id
  status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  error_message TEXT,
  duration_ms INT,
  created_at DATETIME,
  completed_at DATETIME,
  INDEX idx_node_id (node_id),
  INDEX idx_request_type (request_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- 表4：工作流数据（workflows）
CREATE TABLE workflows (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  thumbnail VARCHAR(36), -- 关联media_files.id
  nodes JSON NOT NULL, -- AppNode数组
  connections JSON NOT NULL, -- Connection数组
  groups JSON, -- Group数组
  metadata JSON,
  created_at DATETIME,
  updated_at DATETIME,
  is_favorite BOOLEAN DEFAULT FALSE,
  tags JSON, -- 标签数组
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at),
  INDEX idx_is_favorite (is_favorite)
);

-- 表5：历史记录（history）
CREATE TABLE history (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  nodes_snapshot JSON NOT NULL,
  connections_snapshot JSON NOT NULL,
  groups_snapshot JSON,
  description TEXT,
  created_at DATETIME,
  INDEX idx_session_id (session_id),
  INDEX idx_created_at (created_at)
);

-- 表6：生成任务队列（generation_tasks）
CREATE TABLE generation_tasks (
  id VARCHAR(36) PRIMARY KEY,
  node_id VARCHAR(36) NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  priority INT DEFAULT 0,
  status ENUM('queued', 'running', 'completed', 'failed') DEFAULT 'queued',
  progress INT DEFAULT 0,
  result_data JSON,
  error_data JSON,
  created_at DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_created_at (created_at)
);
```

## 四、实现方案

### 4.1 核心服务层设计

#### 4.1.1 本地存储服务

```typescript
// services/localStorage/IndexedDBService.ts

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'AIYOU_LOCAL_DB';
  private readonly DB_VERSION = 2;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建 media_files 表
        if (!db.objectStoreNames.contains('media_files')) {
          const store = db.createObjectStore('media_files', { keyPath: 'id' });
          store.createIndex('node_id', 'node_id', { unique: false });
          store.createIndex('media_type', 'media_type', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }

        // 创建 characters 表
        if (!db.objectStoreNames.contains('characters')) {
          const store = db.createObjectStore('characters', { keyPath: 'id' });
          store.createIndex('node_id', 'node_id', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }

        // 创建 api_requests 表
        if (!db.objectStoreNames.contains('api_requests')) {
          const store = db.createObjectStore('api_requests', { keyPath: 'id' });
          store.createIndex('node_id', 'node_id', { unique: false });
          store.createIndex('request_type', 'request_type', { unique: false });
        }

        // 创建 workflows 表
        if (!db.objectStoreNames.contains('workflows')) {
          const store = db.createObjectStore('workflows', { keyPath: 'id' });
          store.createIndex('created_at', 'created_at', { unique: false });
        }

        // 创建 history 表
        if (!db.objectStoreNames.contains('history')) {
          const store = db.createObjectStore('history', { keyPath: 'id' });
          store.createIndex('session_id', 'session_id', { unique: false });
        }

        // 创建 generation_tasks 表
        if (!db.objectStoreNames.contains('generation_tasks')) {
          const store = db.createObjectStore('generation_tasks', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 保存媒体文件
   */
  async saveMediaFile(media: MediaFile): Promise<void> {
    const tx = this.db!.transaction(['media_files'], 'readwrite');
    const store = tx.objectStore('media_files');
    return new Promise((resolve, reject) => {
      const request = store.put(media);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取媒体文件
   */
  async getMediaFile(id: string): Promise<MediaFile | null> {
    const tx = this.db!.transaction(['media_files'], 'readonly');
    const store = tx.objectStore('media_files');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 根据nodeId获取所有媒体
   */
  async getMediaFilesByNode(nodeId: string): Promise<MediaFile[]> {
    const tx = this.db!.transaction(['media_files'], 'readonly');
    const store = tx.objectStore('media_files');
    const index = store.index('node_id');
    return new Promise((resolve, reject) => {
      const request = index.getAll(nodeId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 保存角色数据
   */
  async saveCharacter(character: CharacterData): Promise<void> {
    const tx = this.db!.transaction(['characters'], 'readwrite');
    const store = tx.objectStore('characters');
    return new Promise((resolve, reject) => {
      const request = store.put(character);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 记录API请求
   */
  async logApiRequest(request: ApiRequest): Promise<void> {
    const tx = this.db!.transaction(['api_requests'], 'readwrite');
    const store = tx.objectStore('api_requests');
    return new Promise((resolve, reject) => {
      const request = store.put(request);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取存储空间使用情况
   */
  async getStorageStats(): Promise<StorageStats> {
    // 实现存储统计逻辑
    return {
      totalFiles: 0,
      totalSize: 0,
      byType: {}
    };
  }
}

// 导出单例
export const indexedDBService = new IndexedDBService();
```

#### 4.1.2 API拦截器服务

```typescript
// services/apiInterceptor/ApiInterceptorService.ts

export class ApiInterceptorService {
  private static instance: ApiInterceptorService;

  private constructor() {}

  static getInstance(): ApiInterceptorService {
    if (!this.instance) {
      this.instance = new ApiInterceptorService();
    }
    return this.instance;
  }

  /**
   * 拦截图片生成API
   */
  async interceptGenerateImage(
    prompt: string,
    model: string,
    referenceImages: string[],
    options: any
  ): Promise<{ images: string[]; fromCache: boolean }> {
    const nodeId = options.nodeId;
    const cacheKey = this.generateCacheKey('image', { prompt, model, referenceImages, options });

    // 1. 检查本地缓存
    const cached = await indexedDBService.getMediaFilesByNode(nodeId);
    if (cached.length > 0) {
      console.log('[ApiInterceptor] 使用缓存的图片');
      return {
        images: cached.map(f => f.file_path || f.original_base64!),
        fromCache: true
      };
    }

    // 2. 调用原始API
    console.log('[ApiInterceptor] 调用API生成图片');
    const images = await generateImageFromText(prompt, model, referenceImages, options);

    // 3. 保存到本地数据库
    await this.saveImagesToDB(nodeId, images, { prompt, model, options });

    return {
      images,
      fromCache: false
    };
  }

  /**
   * 拦截视频生成API
   */
  async interceptGenerateVideo(
    prompt: string,
    model: string,
    referenceImage: string,
    options: any
  ): Promise<{ videoUrl: string; fromCache: boolean }> {
    const nodeId = options.nodeId;

    // 1. 检查本地缓存
    const cached = await indexedDBService.getMediaFilesByNode(nodeId);
    if (cached.length > 0) {
      console.log('[ApiInterceptor] 使用缓存的视频');
      return {
        videoUrl: cached[0].file_path || cached[0].original_url!,
        fromCache: true
      };
    }

    // 2. 调用原始API
    console.log('[ApiInterceptor] 调用API生成视频');
    const result = await generateVideo(prompt, model, referenceImage, options);

    // 3. 保存到本地数据库
    await this.saveVideoToDB(nodeId, result.uri, { prompt, model, options });

    return {
      videoUrl: result.uri,
      fromCache: false
    };
  }

  /**
   * 拦截角色生成API
   */
  async interceptGenerateCharacter(
    name: string,
    text: string,
    style: string,
    options: any
  ): Promise<CharacterProfile> {
    const nodeId = options.nodeId;

    // 1. 检查本地缓存
    const cached = await indexedDBService.getCharacterByName(nodeId, name);
    if (cached) {
      console.log('[ApiInterceptor] 使用缓存的角色');
      return cached.character_data;
    }

    // 2. 调用原始API
    console.log('[ApiInterceptor] 调用API生成角色');
    const character = await generateCharacterProfile(name, text, style);

    // 3. 保存到本地数据库
    await indexedDBService.saveCharacter({
      id: generateUUID(),
      node_id: nodeId,
      name,
      character_data: character,
      role_type: 'main',
      created_at: new Date(),
      updated_at: new Date()
    });

    return character;
  }

  /**
   * 保存图片到数据库
   */
  private async saveImagesToDB(
    nodeId: string,
    images: string[],
    metadata: any
  ): Promise<void> {
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const mediaFile: MediaFile = {
        id: generateUUID(),
        node_id: nodeId,
        node_type: 'IMAGE_GENERATOR',
        media_type: 'image',
        original_base64: image,
        file_size: image.length,
        mime_type: this.getMimeTypeFromBase64(image),
        metadata: { ...metadata, index: i },
        created_at: new Date(),
        last_accessed: new Date(),
        access_count: 0
      };

      await indexedDBService.saveMediaFile(mediaFile);
    }
  }

  /**
   * 保存视频到数据库
   */
  private async saveVideoToDB(
    nodeId: string,
    videoUrl: string,
    metadata: any
  ): Promise<void> {
    // 如果是URL，下载并保存
    if (videoUrl.startsWith('http')) {
      const response = await fetch(videoUrl);
      const blob = await response.blob();

      const mediaFile: MediaFile = {
        id: generateUUID(),
        node_id: nodeId,
        node_type: 'VIDEO_GENERATOR',
        media_type: 'video',
        file_data: blob,
        original_url: videoUrl,
        file_size: blob.size,
        mime_type: blob.type,
        metadata,
        created_at: new Date(),
        last_accessed: new Date(),
        access_count: 0
      };

      await indexedDBService.saveMediaFile(mediaFile);
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(type: string, params: any): string {
    return `${type}_${JSON.stringify(params)}`;
  }

  /**
   * 从Base64获取MIME类型
   */
  private getMimeTypeFromBase64(base64: string): string {
    const match = base64.match(/^data:([^;]+);/);
    return match ? match[1] : 'image/png';
  }
}

export const apiInterceptor = ApiInterceptorService.getInstance();
```

#### 4.1.3 数据提供者服务

```typescript
// services/dataProvider/NodeDataProvider.ts

export class NodeDataProvider {
  /**
   * 获取节点的图片数据
   */
  async getNodeImages(nodeId: string): Promise<string[]> {
    const mediaFiles = await indexedDBService.getMediaFilesByNode(nodeId);
    const images = mediaFiles
      .filter(f => f.media_type === 'image')
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .map(f => {
        // 优先使用本地文件路径
        if (f.file_path) {
          return f.file_path;
        }
        // 否则使用Base64
        if (f.original_base64) {
          return f.original_base64;
        }
        // 最后使用原始URL
        return f.original_url || '';
      });

    return images;
  }

  /**
   * 获取节点的视频数据
   */
  async getNodeVideo(nodeId: string): Promise<string | null> {
    const mediaFiles = await indexedDBService.getMediaFilesByNode(nodeId);
    const video = mediaFiles.find(f => f.media_type === 'video');

    if (!video) {
      return null;
    }

    // 优先使用本地文件
    if (video.file_data) {
      return URL.createObjectURL(video.file_data);
    }

    if (video.file_path) {
      return video.file_path;
    }

    return video.original_url || null;
  }

  /**
   * 获取节点的角色数据
   */
  async getNodeCharacters(nodeId: string): Promise<CharacterProfile[]> {
    const characters = await indexedDBService.getCharactersByNode(nodeId);
    return characters.map(c => c.character_data);
  }

  /**
   * 保存工作流
   */
  async saveWorkflow(workflow: Workflow): Promise<void> {
    await indexedDBService.saveWorkflow({
      id: workflow.id,
      title: workflow.title,
      thumbnail: workflow.thumbnail,
      nodes: JSON.stringify(workflow.nodes),
      connections: JSON.stringify(workflow.connections),
      groups: JSON.stringify(workflow.groups || []),
      metadata: JSON.stringify({}),
      created_at: new Date(),
      updated_at: new Date(),
      is_favorite: false,
      tags: JSON.stringify([])
    });
  }

  /**
   * 加载工作流
   */
  async loadWorkflow(workflowId: string): Promise<Workflow | null> {
    const workflow = await indexedDBService.getWorkflow(workflowId);

    if (!workflow) {
      return null;
    }

    return {
      id: workflow.id,
      title: workflow.title,
      thumbnail: workflow.thumbnail,
      nodes: JSON.parse(workflow.nodes),
      connections: JSON.parse(workflow.connections),
      groups: JSON.parse(workflow.groups),
      metadata: JSON.parse(workflow.metadata)
    };
  }

  /**
   * 保存历史记录
   */
  async saveHistory(
    sessionId: string,
    actionType: string,
    nodes: AppNode[],
    connections: Connection[],
    groups: Group[],
    description?: string
  ): Promise<void> {
    await indexedDBService.saveHistory({
      id: generateUUID(),
      session_id: sessionId,
      action_type: actionType,
      nodes_snapshot: JSON.stringify(nodes),
      connections_snapshot: JSON.stringify(connections),
      groups_snapshot: groups ? JSON.stringify(groups) : null,
      description: description || '',
      created_at: new Date()
    });
  }
}

export const nodeDataProvider = new NodeDataProvider();
```

### 4.2 节点服务改造

#### 4.2.1 图片生成节点改造

```typescript
// services/nodes/imageGenerator.service.ts

export class ImageGeneratorNodeService {
  async execute(node: AppNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    try {
      console.log('[ImageGenerator] 开始执行', node.id);

      // 更新节点状态为处理中
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'processing'
      }, context);

      // 使用API拦截器
      const result = await apiInterceptor.interceptGenerateImage(
        node.data.prompt || '',
        node.data.model || 'gemini-2.0-flash-exp-image-generation',
        node.data.inputAssets || [],
        {
          nodeId: node.id,
          aspectRatio: node.data.aspectRatio,
          count: node.data.count || 1,
          resolution: node.data.resolution
        }
      );

      // 更新节点数据
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'success',
        images: result.images,
        isCached: result.fromCache,
        generatedAt: new Date().toISOString(),
        lastRefreshed: new Date().toISOString()
      }, context);

      console.log('[ImageGenerator] 执行完成', {
        nodeId: node.id,
        imageCount: result.images.length,
        fromCache: result.fromCache
      });

      return this.createSuccessResult({
        images: result.images,
        isCached: result.fromCache
      });

    } catch (error: any) {
      console.error('[ImageGenerator] 执行失败', error);

      this.updateNodeData(node.id, {
        ...node.data,
        status: 'error',
        error: error.message
      }, context);

      return this.createErrorResult(error.message);
    }
  }
}
```

#### 4.2.2 视频生成节点改造

```typescript
// services/nodes/videoGenerator.service.ts

export class VideoGeneratorNodeService {
  async execute(node: AppNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    try {
      console.log('[VideoGenerator] 开始执行', node.id);

      // 更新节点状态
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'processing'
      }, context);

      // 使用API拦截器
      const result = await apiInterceptor.interceptGenerateVideo(
        node.data.prompt || '',
        node.data.model || 'gemini-2.0-flash-exp',
        node.data.inputAssets?.[0] || '',
        {
          nodeId: node.id,
          mode: node.data.generationMode,
          aspectRatio: node.data.aspectRatio
        }
      );

      // 更新节点数据
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'success',
        videoUrl: result.videoUrl,
        isCached: result.fromCache,
        generatedAt: new Date().toISOString()
      }, context);

      return this.createSuccessResult({
        videoUrl: result.videoUrl,
        isCached: result.fromCache
      });

    } catch (error: any) {
      console.error('[VideoGenerator] 执行失败', error);

      this.updateNodeData(node.id, {
        ...node.data,
        status: 'error',
        error: error.message
      }, context);

      return this.createErrorResult(error.message);
    }
  }
}
```

#### 4.2.3 角色节点改造

```typescript
// services/characterActionHandler.ts

export class CharacterActionHandler {
  async handleGenerateCharacter(
    nodeId: string,
    charName: string,
    node: AppNode,
    allNodes: AppNode[],
    onNodeUpdate: (nodeId: string, data: any) => void
  ): Promise<void> {
    try {
      console.log('[CharacterAction] 生成角色档案', charName);

      // 检查本地缓存
      const cached = await indexedDBService.getCharacterByName(nodeId, charName);

      if (cached) {
        console.log('[CharacterAction] 使用缓存的角色', charName);

        // 更新节点数据
        const existing = node.data.generatedCharacters || [];
        onNodeUpdate(nodeId, {
          generatedCharacters: [...existing, cached.character_data]
        });

        return;
      }

      // 调用API生成
      const plannerNode = allNodes.find(n => n.type === NodeType.SCRIPT_PLANNER);
      const scriptText = plannerNode?.data?.scriptOutline || '';

      const character = await apiInterceptor.interceptGenerateCharacter(
        charName,
        scriptText,
        'REAL',
        { nodeId }
      );

      // 保存到数据库
      await indexedDBService.saveCharacter({
        id: generateUUID(),
        node_id: nodeId,
        name: charName,
        character_data: character,
        role_type: 'main',
        created_at: new Date(),
        updated_at: new Date()
      });

      // 更新节点数据
      const existing = node.data.generatedCharacters || [];
      onNodeUpdate(nodeId, {
        generatedCharacters: [...existing, character]
      });

      console.log('[CharacterAction] 角色生成完成', charName);

    } catch (error: any) {
      console.error('[CharacterAction] 角色生成失败', error);
      throw error;
    }
  }

  async handleGenerateExpression(
    nodeId: string,
    charName: string,
    node: AppNode,
    onNodeUpdate: (nodeId: string, data: any) => void
  ): Promise<void> {
    // 类似的改造，保存九宫格到数据库
  }

  async handleGenerateThreeView(
    nodeId: string,
    charName: string,
    node: AppNode,
    onNodeUpdate: (nodeId: string, data: any) => void
  ): Promise<void> {
    // 类似的改造，保存三视图到数据库
  }
}
```

### 4.3 UI层改造

#### 4.3.1 Node组件数据获取

```typescript
// components/Node.tsx

const NodeComponent: React.FC<NodeProps> = ({ node, onUpdate, ...props }) => {
  // 使用数据提供者获取媒体文件
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  useEffect(() => {
    const loadMediaData = async () => {
      if (node.type === NodeType.IMAGE_GENERATOR) {
        const nodeImages = await nodeDataProvider.getNodeImages(node.id);
        setImages(nodeImages);
        setIsFromCache(true); // 标记为来自缓存
      } else if (node.type === NodeType.VIDEO_GENERATOR) {
        const nodeVideo = await nodeDataProvider.getNodeVideo(node.id);
        setVideoUrl(nodeVideo);
        setIsFromCache(true);
      } else if (node.type === NodeType.CHARACTER_NODE) {
        const characters = await nodeDataProvider.getNodeCharacters(node.id);
        // 更新角色数据
      }
    };

    loadMediaData();
  }, [node.id, node.type]);

  // 显示缓存指示器
  const renderCacheIndicator = () => {
    if (!isFromCache) return null;
    return (
      <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
        📦 已缓存
      </div>
    );
  };

  // ... 其他渲染逻辑
};
```

### 4.4 工作流和历史管理

#### 4.4.1 工作流保存和加载

```typescript
// hooks/useWorkflowManager.ts

export function useWorkflowManager() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 保存当前工作流
   */
  const saveWorkflow = async (title: string) => {
    const { nodes, connections, groups } = useAppStore.getState();

    const workflow: Workflow = {
      id: generateUUID(),
      title,
      thumbnail: '', // 可以生成缩略图
      nodes,
      connections,
      groups,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    await nodeDataProvider.saveWorkflow(workflow);

    // 刷新列表
    await loadWorkflows();

    return workflow.id;
  };

  /**
   * 加载工作流列表
   */
  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      const savedWorkflows = await indexedDBService.getAllWorkflows();
      setWorkflows(savedWorkflows);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 加载并应用工作流
   */
  const loadAndApplyWorkflow = async (workflowId: string) => {
    const workflow = await nodeDataProvider.loadWorkflow(workflowId);

    if (workflow) {
      useAppStore.getState().setNodes(workflow.nodes);
      useAppStore.getState().setConnections(workflow.connections);
      useAppStore.getState().setGroups(workflow.groups || []);
    }
  };

  return {
    workflows,
    isLoading,
    saveWorkflow,
    loadWorkflows,
    loadAndApplyWorkflow
  };
}
```

#### 4.4.2 历史记录管理

```typescript
// hooks/useHistoryManager.ts

export function useHistoryManager() {
  const sessionId = useRef(generateUUID());

  /**
   * 保存当前状态到历史
   */
  const saveToHistory = async (actionType: string, description?: string) => {
    const { nodes, connections, groups } = useAppStore.getState();

    await nodeDataProvider.saveHistory(
      sessionId.current,
      actionType,
      nodes,
      connections,
      groups,
      description
    );
  };

  /**
   * 加载历史记录
   */
  const loadHistory = async (historyId: string) => {
    const history = await indexedDBService.getHistory(historyId);

    if (history) {
      useAppStore.getState().setNodes(
        JSON.parse(history.nodes_snapshot)
      );
      useAppStore.getState().setConnections(
        JSON.parse(history.connections_snapshot)
      );
      useAppStore.getState().setGroups(
        JSON.parse(history.groups_snapshot || '[]')
      );
    }
  };

  return {
    saveToHistory,
    loadHistory
  };
}
```

## 五、实施计划

### 5.1 阶段划分

#### 第一阶段：基础设施搭建（2-3天）

**任务**：
1. ✅ 创建 IndexedDB 服务类
2. ✅ 设计数据库表结构
3. ✅ 实现 API 拦截器基础框架
4. ✅ 创建数据提供者服务

**验收标准**：
- IndexedDB 数据库可以正常初始化
- 可以保存和读取简单的媒体文件
- API 拦截器可以拦截并转发请求

#### 第二阶段：图片生成节点改造（2-3天）

**任务**：
1. ✅ 改造 ImageGeneratorNodeService
2. ✅ 实现图片本地存储逻辑
3. ✅ 更新 Node.tsx 图片显示组件
4. ✅ 添加缓存指示器

**验收标准**：
- 生成的图片自动保存到 IndexedDB
- 刷新页面后图片依然显示
- 显示"已缓存"标识

#### 第三阶段：视频生成节点改造（2-3天）

**任务**：
1. ✅ 改造 VideoGeneratorNodeService
2. ✅ 实现视频下载和本地存储
3. ✅ 处理 Blob URL 的创建和清理
4. ✅ 支持 Sora 视频的本地化

**验收标准**：
- 生成的视频自动保存到本地
- 视频可以离线播放
- 减少视频加载时间

#### 第四阶段：角色节点改造（3-4天）

**任务**：
1. ✅ 改造角色生成服务
2. ✅ 实现角色数据本地化
3. ✅ 保存九宫格和三视图
4. ✅ 实现角色数据的管理和查询

**验收标准**：
- 角色档案完整保存到本地
- 九宫格和三视图可以离线查看
- 角色数据可以跨工作流复用

#### 第五阶段：音频和其他节点改造（2-3天）

**任务**：
1. ✅ 改造音频生成节点
2. ✅ 实现音频文件本地存储
3. ✅ 改造剧本生成节点
4. ✅ 改造分镜生成节点

**验收标准**：
- 音频文件本地化存储
- 剧本和分镜数据持久化

#### 第六阶段：工作流和历史管理（2-3天）

**任务**：
1. ✅ 实现工作流保存和加载
2. ✅ 实现历史记录系统
3. ✅ 添加工作流缩略图生成
4. ✅ 实现历史回放功能

**验收标准**：
- 工作流可以完整保存和恢复
- 历史记录支持撤销/重做
- 可以加载任意历史状态

#### 第七阶段：优化和测试（2-3天）

**任务**：
1. ✅ 性能优化（压缩、分片存储）
2. ✅ 存储空间管理（LRU淘汰）
3. ✅ 错误处理和降级策略
4. ✅ 全面测试和修复

**验收标准**：
- 系统运行稳定
- 存储空间可控
- 降级策略有效

### 5.2 时间估算

| 阶段 | 任务 | 预计时间 |
|-----|------|---------|
| 1 | 基础设施搭建 | 2-3天 |
| 2 | 图片节点改造 | 2-3天 |
| 3 | 视频节点改造 | 2-3天 |
| 4 | 角色节点改造 | 3-4天 |
| 5 | 其他节点改造 | 2-3天 |
| 6 | 工作流和历史 | 2-3天 |
| 7 | 优化和测试 | 2-3天 |
| **总计** | | **15-22天** |

## 六、关键技术点

### 6.1 存储优化

**Base64 压缩**：
```typescript
async function compressBase64(base64: string): Promise<string> {
  // 移除 data URL 前缀
  const base64Data = base64.split(',')[1];

  // 使用 pako 压缩
  const compressed = pako.deflate(base64Data);

  // 转回 base64
  return 'data:application/gzip;base64,' + btoa(String.fromCharCode(...compressed));
}
```

**大文件分片存储**：
```typescript
async function saveLargeFile(file: Blob, chunkSize = 5 * 1024 * 1024): Promise<string> {
  const chunks = Math.ceil(file.size / chunkSize);
  const fileId = generateUUID();

  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    await indexedDBService.saveMediaFile({
      id: `${fileId}_chunk_${i}`,
      node_id: nodeId,
      media_type: 'video',
      file_data: chunk,
      metadata: { fileId, chunkIndex: i, totalChunks: chunks }
    });
  }

  return fileId;
}
```

### 6.2 缓存策略

**LRU 缓存淘汰**：
```typescript
class LRUCache {
  private maxSize: number;
  private cache: Map<string, any>;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: string): any {
    if (this.cache.has(key)) {
      // 移到最后（最近使用）
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key: string, value: any): void {
    // 如果已存在，删除旧的
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 添加新的
    this.cache.set(key, value);
    // 如果超过最大大小，删除最旧的
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}
```

### 6.3 数据一致性

**事务处理**：
```typescript
async function saveWithTransaction<T>(operations: (() => Promise<void>)[]): Promise<void> {
  // 使用 IndexedDB 事务确保原子性
  const tx = db.transaction(['media_files', 'characters'], 'readwrite');

  // 等待所有操作完成
  await Promise.all(operations.map(op => op()));
}
```

### 6.4 错误降级

**降级策略**：
```typescript
async function loadWithFallback(nodeId: string): Promise<string[]> {
  try {
    // 优先从 IndexedDB 加载
    const images = await nodeDataProvider.getNodeImages(nodeId);
    if (images.length > 0) {
      return images;
    }
  } catch (error) {
    console.warn('[Fallback] IndexedDB 加载失败，尝试从节点数据加载');
  }

  // 降级：从节点数据加载
  const node = await getNodeFromStore(nodeId);
  return node.data.images || [];
}
```

## 七、风险和挑战

### 7.1 存储空间限制

**问题**：
- IndexedDB 配额有限（通常几百MB到几GB）
- 大量媒体文件可能超出限制

**解决方案**：
- 实现文件压缩
- 使用 LRU 策略自动清理
- 提供"清理缓存"功能
- 使用 File System Access API 作为扩展存储

### 7.2 性能影响

**问题**：
- 大文件保存可能阻塞主线程
- IndexedDB 操作可能较慢

**解决方案**：
- 使用 Web Worker 处理大文件
- 实现分片存储和加载
- 使用事务批处理
- 添加加载进度提示

### 7.3 数据迁移

**问题**：
- 用户现有数据需要迁移
- 迁移过程不能影响使用

**解决方案**：
- 实现渐进式迁移
- 保留旧数据兼容
- 提供迁移进度显示
- 支持迁移回滚

### 7.4 跨浏览器兼容性

**问题**：
- 不同浏览器 IndexedDB 实现差异
- File System Access API 支持有限

**解决方案**：
- 使用 polyfill
- 实现特性检测
- 提供多种存储方案降级
- 测试主流浏览器

## 八、测试策略

### 8.1 单元测试

```typescript
// services/__tests__/IndexedDBService.test.ts

describe('IndexedDBService', () => {
  beforeEach(async () => {
    await indexedDBService.init();
  });

  test('应该保存和读取媒体文件', async () => {
    const mediaFile: MediaFile = {
      id: 'test-id',
      node_id: 'node-1',
      media_type: 'image',
      original_base64: 'data:image/png;base64,...',
      // ...
    };

    await indexedDBService.saveMediaFile(mediaFile);
    const retrieved = await indexedDBService.getMediaFile('test-id');

    expect(retrieved).toEqual(mediaFile);
  });
});
```

### 8.2 集成测试

```typescript
// integration/mediaGeneration.test.ts

describe('媒体生成集成测试', () => {
  test('应该生成图片并保存到本地', async () => {
    const result = await apiInterceptor.interceptGenerateImage(
      'test prompt',
      'gemini-2.0-flash',
      [],
      { nodeId: 'test-node' }
    );

    expect(result.images).toBeDefined();
    expect(result.images.length).toBeGreaterThan(0);

    const cached = await nodeDataProvider.getNodeImages('test-node');
    expect(cached).toEqual(result.images);
  });
});
```

### 8.3 性能测试

```typescript
// performance/storage.test.ts

describe('存储性能测试', () => {
  test('应该在合理时间内保存大视频文件', async () => {
    const largeVideo = new Blob([new Array(10 * 1024 * 1024).fill(0)], {
      type: 'video/mp4'
    });

    const start = Date.now();
    await saveLargeFile(largeVideo);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // 5秒内完成
  });
});
```

## 九、监控和日志

### 9.1 性能监控

```typescript
// services/monitoring/PerformanceMonitor.ts

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordOperation(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);

    // 保持最近100条记录
    if (this.metrics.get(operation)!.length > 100) {
      this.metrics.get(operation)!.shift();
    }
  }

  getAverageTime(operation: string): number {
    const times = this.metrics.get(operation);
    if (!times || times.length === 0) return 0;

    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  getStats(): OperationStats[] {
    return Array.from(this.metrics.entries()).map(([operation, times]) => ({
      operation,
      count: times.length,
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times)
    }));
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

### 9.2 存储监控

```typescript
// services/monitoring/StorageMonitor.ts

export class StorageMonitor {
  async getStorageUsage(): Promise<StorageUsage> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        percentage: (estimate.usage || 0) / (estimate.quota || 1) * 100
      };
    }

    // 降级：估算 IndexedDB 使用量
    const stats = await indexedDBService.getStorageStats();
    return {
      usage: stats.totalSize,
      quota: 1024 * 1024 * 1024, // 假设1GB
      percentage: (stats.totalSize / (1024 * 1024 * 1024)) * 100
    };
  }

  async cleanupOldFiles(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const oldFiles = await indexedDBService.getMediaFilesOlderThan(cutoffDate);

    for (const file of oldFiles) {
      await indexedDBService.deleteMediaFile(file.id);
    }

    return oldFiles.length;
  }
}

export const storageMonitor = new StorageMonitor();
```

## 十、文档和培训

### 10.1 API文档

```typescript
// docs/api/local-storage-api.md

# 本地存储 API 文档

## IndexedDBService

### saveMediaFile(media: MediaFile): Promise<void>
保存媒体文件到数据库。

**参数**：
- `media`: 媒体文件对象

**示例**：
```typescript
await indexedDBService.saveMediaFile({
  id: 'file-1',
  node_id: 'node-1',
  media_type: 'image',
  original_base64: 'data:image/png;base64,...',
  created_at: new Date()
});
```

### getMediaFile(id: string): Promise<MediaFile | null>
根据ID获取媒体文件。

## ApiInterceptorService

### interceptGenerateImage(...): Promise<{images: string[], fromCache: boolean}>
拦截图片生成请求，优先使用缓存。

## NodeDataProvider

### getNodeImages(nodeId: string): Promise<string[]>
获取节点的所有图片。
```

### 10.2 开发者指南

```markdown
# 开发者指南

## 添加新的本地化节点类型

1. 在 `IndexedDBService` 中添加存储方法
2. 在 `ApiInterceptorService` 中添加拦截器
3. 在 `NodeDataProvider` 中添加获取方法
4. 更新节点服务使用拦截器
5. 更新 UI 组件显示缓存状态

## 示例：添加音频节点本地化

```typescript
// 1. 添加拦截器
async interceptGenerateAudio(prompt: string): Promise<{audioUrl: string, fromCache: boolean}> {
  const cached = await indexedDBService.getMediaFilesByNode(nodeId);
  if (cached.length > 0) {
    return { audioUrl: cached[0].file_path, fromCache: true };
  }

  const audio = await generateAudio(prompt);
  await this.saveAudioToDB(nodeId, audio);

  return { audioUrl: audio, fromCache: false };
}

// 2. 更新节点服务
class AudioGeneratorNodeService {
  async execute(node, context) {
    const result = await apiInterceptor.interceptGenerateAudio(node.data.prompt);
    this.updateNodeData(node.id, { audioUrl: result.audioUrl, isCached: result.fromCache });
  }
}

// 3. 更新 UI
const audioUrl = await nodeDataProvider.getNodeAudio(node.id);
setAudioUrl(audioUrl);
```
```

## 十一、总结

本规划实现了一个完整的"本地优先"架构：

### 核心特性
✅ 所有媒体文件本地持久化存储
✅ API 响应自动缓存
✅ 保留刷新能力
✅ 工作流和历史记录本地化
✅ 智能缓存管理
✅ 降级策略保证可用性

### 技术亮点
- IndexedDB + File System Access API 双层存储
- API 拦截器模式透明集成
- LRU 缓存淘汰策略
- 性能监控和优化
- 完整的测试覆盖

### 预期收益
- 🚀 减少 API 调用成本 80%+
- ⚡ 提升加载速度 5-10倍
- 💾 支持离线工作
- 🔄 数据可恢复
- 📈 提升用户体验

本规划为系统提供了可扩展、可维护的本地存储架构，为后续功能开发奠定坚实基础。
