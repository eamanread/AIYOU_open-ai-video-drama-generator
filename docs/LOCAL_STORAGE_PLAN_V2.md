# 本地存储架构改造方案（修正版）

## 一、方案对比分析

### 1.1 三种存储方案对比

| 维度 | 方案A：纯文件系统 | 方案B：纯IndexedDB | 方案C：混合方案（推荐） |
|-----|----------------|----------------|----------------------|
| **主存储** | File System Access API | IndexedDB | 文件系统 + IndexedDB |
| **容量** | ✅ 无限（硬盘） | ❌ 有限（50-100MB） | ✅ 无限（硬盘） |
| **持久性** | ✅ 永久保存 | ⚠️ 可能被清理 | ✅ 永久保存 |
| **用户可见** | ✅ 用户直接管理 | ❌ 浏览器黑盒 | ✅ 用户直接管理 |
| **跨浏览器** | ✅ 换浏览器可访问 | ❌ 浏览器独立 | ✅ 换浏览器可访问 |
| **备份** | ✅ 直接复制文件夹 | ❌ 需要导出工具 | ✅ 直接复制文件夹 |
| **速度** | ⚠️ 较慢（硬盘IO） | ✅ 快速（内存） | ✅ 两级缓存 |
| **已有实现** | ✅ 完整实现 | ⚠️ 部分实现 | ✅ 基于现有实现 |
| **查询能力** | ❌ 需要遍历文件 | ✅ 索引查询 | ✅ IndexedDB索引 |
| **兼容性** | ⚠️ 仅Chromium系 | ✅ 所有现代浏览器 | ⚠️ 非Chromium降级到IndexedDB |

### 1.2 推荐方案：混合方案

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│                     (React Components)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      API拦截层                               │
│  - 拦截API调用                                              │
│  - 检查本地缓存                                              │
│  - 自动保存到本地                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼               ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ 文件系统存储  │ │IndexedDB │ │  内存缓存    │
│ (主存储)     │ │(元数据)  │ │  (L1 Cache)  │
│              │ │          │ │              │
│ ✅ 图片      │ │ ✅ 文件   │ │ ✅ 快速访问  │
│ ✅ 视频      │ │   索引   │ │              │
│ ✅ 音频      │ │ ✅ 查询  │ │              │
│ ✅ 剧本      │ │ ✅ 元数据 │ │              │
│ ✅ 角色      │ │          │ │              │
└──────────────┘ └──────────┘ └──────────────┘
```

### 1.3 数据分层

| 层级 | 存储介质 | 用途 | 生命周期 |
|-----|---------|------|---------|
| **L1** | 内存（React State） | 当前使用的数据 | 页面会话 |
| **L2** | IndexedDB | 元数据索引、快速查询 | 长期（除非清理） |
| **L3** | 文件系统 | 实际媒体文件 | 永久（用户控制） |

## 二、现有系统分析

### 2.1 当前存储架构

```
当前系统（已实现）：
┌─────────────────────────────────────┐
│      节点数据存储 (IndexedDB)        │
│  - nodes: AppNode[]                │
│  - connections: Connection[]        │
│  - 包含大量 Base64 数据             │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│      文件存储 (FileStorageService)  │
│  - 手动保存或自动保存               │
│  - 存储到用户选择的文件夹            │
│  - 元数据：.aiyou-metadata.json     │
└─────────────────────────────────────┘
```

### 2.2 现有实现状态

#### 已实现 ✅

1. **FileStorageService** - 完整实现
   ```typescript
   - saveFile()           // 保存文件
   - saveFiles()          // 批量保存
   - readFile()           // 读取文件
   - deleteFile()         // 删除文件
   - getMetadata()        // 获取元数据
   - selectRootDirectory() // 选择目录
   ```

2. **自动保存机制**
   ```typescript
   // App.tsx 中已有的自动保存调用
   await saveImageNodeOutput(id, res, 'IMAGE_GENERATOR');
   await saveVideoNodeOutput(id, videoUris, 'VIDEO_GENERATOR');
   await saveAudioNodeOutput(id, audioUri, 'AUDIO_GENERATOR');
   ```

3. **元数据管理**
   - MetadataManager 类
   - 存储在 `.aiyou-metadata.json`
   - 按工作区、节点、类型索引

#### 部分实现 ⚠️

1. **API拦截**
   - 没有统一的拦截层
   - 每个节点独立调用保存
   - 没有缓存检查机制

2. **文件加载**
   - 保存后不会自动加载回节点
   - 需要手动操作才能查看已保存的文件

#### 未实现 ❌

1. **缓存检查**
   - 不检查本地是否已有文件
   - 每次都重新生成

2. **智能降级**
   - 文件系统不可用时的降级策略
   - 跨浏览器兼容性处理

3. **数据迁移**
   - 旧数据迁移到新存储
   - Base64 数据迁移到文件系统

## 三、改造方案详细设计

### 3.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                    节点服务层                             │
│  (ImageGeneratorNodeService, VideoGeneratorNodeService) │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  API拦截器 (新增)                         │
│  - 检查文件系统缓存                                         │
│  - 检查IndexedDB元数据                                     │
│  - 调用原始API                                             │
│  - 保存到文件系统 + 更新元数据                             │
└──────────────────────┬───────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                              ▼
┌──────────────────┐         ┌──────────────────┐
│ FileStorageService│         │ IndexedDBService │
│   (已有实现)      │         │   (需要增强)     │
│                  │         │                  │
│ • 保存媒体文件    │         │ • 文件元数据     │
│ • 读取媒体文件    │         │ • 快速查询       │
│ • 目录管理        │         │ • 索引           │
└──────────────────┘         └──────────────────┘
```

### 3.2 核心组件设计

#### 3.2.1 API拦截器

```typescript
// services/apiInterceptor/ApiInterceptor.ts

export class ApiInterceptor {
  private fileStorageService: FileStorageService | null = null;
  private indexedDBService: IndexedDBService;

  constructor() {
    // 获取全局文件存储服务
    const { fileStorageService } = useAppStore.getState();
    this.fileStorageService = fileStorageService;
    this.indexedDBService = new IndexedDBService();
    this.indexedDBService.init();
  }

  /**
   * 拦截图片生成
   */
  async interceptGenerateImage(
    nodeId: string,
    prompt: string,
    model: string,
    referenceImages: string[],
    options: any
  ): Promise<ImageGenerationResult> {
    const workspaceId = 'default';
    const nodeType = 'IMAGE_GENERATOR';

    // 第1步：检查文件系统缓存
    if (this.fileStorageService?.isEnabled()) {
      try {
        const existingFiles = await this.fileStorageService.getFilesByNode(
          workspaceId,
          nodeId
        );

        if (existingFiles.length > 0) {
          console.log('[ApiInterceptor] ✅ 从文件系统加载图片');

          // 更新访问时间
          await this.indexedDBService.updateFileAccessTime(
            nodeId,
            existingFiles[0].id
          );

          return {
            images: existingFiles.map(f => f.relativePath),
            fromCache: true,
            cacheLocation: 'filesystem'
          };
        }
      } catch (error) {
        console.warn('[ApiInterceptor] 文件系统查询失败，继续API调用');
      }
    }

    // 第2步：检查IndexedDB元数据
    const metadata = await this.indexedDBService.getFileMetadata(nodeId);
    if (metadata && metadata.files.length > 0) {
      console.log('[ApiInterceptor] ✅ 从IndexedDB找到元数据');

      // 尝试从文件系统加载
      if (this.fileStorageService?.isEnabled()) {
        try {
          const files = await Promise.all(
            metadata.files.map(f =>
              this.fileStorageService.readFileAsDataUrl(f.relativePath)
            )
          );

          return {
            images: files,
            fromCache: true,
            cacheLocation: 'indexeddb-filesystem'
          };
        } catch (error) {
          console.warn('[ApiInterceptor] 文件加载失败，重新生成');
        }
      }
    }

    // 第3步：调用原始API
    console.log('[ApiInterceptor] 🌐 调用API生成图片');
    const images = await generateImageFromText(
      prompt,
      model,
      referenceImages,
      options
    );

    // 第4步：保存到文件系统
    let savedPaths: string[] = [];
    if (this.fileStorageService?.isEnabled()) {
      try {
        for (let i = 0; i < images.length; i++) {
          const result = await this.fileStorageService.saveFile(
            workspaceId,
            nodeId,
            nodeType,
            images[i],
            {
              prefix: `image-${i + 1}`,
              updateMetadata: true
            }
          );

          if (result.success) {
            savedPaths.push(result.relativePath);
          }
        }
        console.log(`[ApiInterceptor] 💾 保存了 ${savedPaths.length} 个文件到文件系统`);
      } catch (error) {
        console.error('[ApiInterceptor] 文件系统保存失败:', error);
      }
    }

    // 第5步：保存元数据到IndexedDB
    await this.indexedDBService.saveFileMetadata({
      id: generateUUID(),
      node_id: nodeId,
      node_type: nodeType,
      file_count: images.length,
      files: savedPaths.map((path, index) => ({
        id: generateUUID(),
        relative_path: path,
        index: index + 1,
        created_at: new Date()
      })),
      generation_params: {
        prompt,
        model,
        aspectRatio: options.aspectRatio,
        count: options.count
      },
      created_at: new Date(),
      last_accessed: new Date()
    });

    return {
      images,
      fromCache: false,
      savedPaths
    };
  }

  /**
   * 拦截视频生成
   */
  async interceptGenerateVideo(
    nodeId: string,
    prompt: string,
    model: string,
    referenceImage: string,
    options: any
  ): Promise<VideoGenerationResult> {
    // 类似的实现
    // 特殊处理：视频文件较大，需要特殊处理
  }

  /**
   * 拦截角色生成
   */
  async interceptGenerateCharacter(
    nodeId: string,
    name: string,
    text: string,
    style: string
  ): Promise<CharacterGenerationResult> {
    // 角色数据包含九宫格和三视图
    // 需要保存多个图片文件
  }
}

export const apiInterceptor = new ApiInterceptor();
```

#### 3.2.2 增强的IndexedDB服务

```typescript
// services/storage/IndexedDBService.ts

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'AIYOU_LOCAL_DB';
  private readonly DB_VERSION = 2;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 文件元数据表
        if (!db.objectStoreNames.contains('file_metadata')) {
          const store = db.createObjectStore('file_metadata', {
            keyPath: 'id'
          });
          store.createIndex('node_id', 'node_id', { unique: false });
          store.createIndex('node_type', 'node_type', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }

        // 角色元数据表
        if (!db.objectStoreNames.contains('character_metadata')) {
          const store = db.createObjectStore('character_metadata', {
            keyPath: 'id'
          });
          store.createIndex('node_id', 'node_id', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 保存文件元数据
   */
  async saveFileMetadata(metadata: FileMetadataRecord): Promise<void> {
    const tx = this.db!.transaction(['file_metadata'], 'readwrite');
    const store = tx.objectStore('file_metadata');

    return new Promise((resolve, reject) => {
      const request = store.put(metadata);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取文件元数据
   */
  async getFileMetadata(nodeId: string): Promise<FileMetadataRecord | null> {
    const tx = this.db!.transaction(['file_metadata'], 'readonly');
    const store = tx.objectStore('file_metadata');
    const index = store.index('node_id');

    return new Promise((resolve, reject) => {
      const request = index.get(nodeId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 更新文件访问时间
   */
  async updateFileAccessTime(nodeId: string, fileId: string): Promise<void> {
    const metadata = await this.getFileMetadata(nodeId);
    if (metadata) {
      metadata.last_accessed = new Date();
      await this.saveFileMetadata(metadata);
    }
  }

  /**
   * 清理旧元数据
   */
  async cleanupOldMetadata(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const tx = this.db!.transaction(['file_metadata'], 'readwrite');
    const store = tx.objectStore('file_metadata');
    const index = store.index('created_at');

    const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate));

    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取存储统计
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalNodes: number;
    byType: Record<string, number>;
  }> {
    const tx = this.db!.transaction(['file_metadata'], 'readonly');
    const store = tx.objectStore('file_metadata');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const allMetadata = request.result as FileMetadataRecord[];
        const byType: Record<string, number> = {};

        allMetadata.forEach(m => {
          byType[m.node_type] = (byType[m.node_type] || 0) + 1;
        });

        resolve({
          totalFiles: allMetadata.reduce((sum, m) => sum + m.file_count, 0),
          totalNodes: allMetadata.length,
          byType
        });
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDBService = new IndexedDBService();
```

### 3.3 节点服务改造

#### 3.3.1 改造原则

**最小化修改原则**：
- 不改变现有服务接口
- 通过拦截器透明集成
- 保持向后兼容

#### 3.3.2 图片生成节点改造

```typescript
// services/nodes/imageGenerator.service.ts

export class ImageGeneratorNodeService {
  async execute(
    node: AppNode,
    context: ExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      // 更新状态
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'processing'
      }, context);

      // 使用拦截器（改造点）
      const result = await apiInterceptor.interceptGenerateImage(
        node.id,
        node.data.prompt || '',
        node.data.model || 'gemini-2.0-flash-exp-image-generation',
        node.data.inputAssets || [],
        {
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
        savedPaths: result.savedPaths,
        isCached: result.fromCache,
        cacheLocation: result.cacheLocation,
        generatedAt: new Date().toISOString()
      }, context);

      return this.createSuccessResult(result);

    } catch (error: any) {
      // 错误处理...
      return this.createErrorResult(error.message);
    }
  }
}
```

## 四、对当前系统的影响分析

### 4.1 正面影响 ✅

#### 1. 性能提升

| 场景 | 当前 | 改造后 | 提升 |
|-----|------|--------|------|
| 刷新页面 | 重新生成所有内容 | 从文件系统加载 | **10-100倍** |
| 切换工作流 | 可能需要重新生成 | 直接读取 | **5-50倍** |
| 内存占用 | Base64全部在内存 | 引用路径 | **减少80%** |
| 首次加载 | N/A | 首次后缓存 | **2-5倍** |

#### 2. 用户体验改善

- ✅ **数据持久化**：关闭浏览器不丢失
- ✅ **跨设备访问**：通过云同步文件夹
- ✅ **易于备份**：直接复制文件夹
- ✅ **透明管理**：用户可直接查看文件
- ✅ **节省成本**：减少重复API调用

#### 3. 开发维护优势

- ✅ **利用现有实现**：FileStorageService 已完善
- ✅ **渐进式改造**：可以分阶段实施
- ✅ **向后兼容**：不影响现有功能
- ✅ **易于调试**：文件可见，便于排查问题

### 4.2 潜在问题和风险 ⚠️

#### 问题1：浏览器兼容性

**影响**：
- File System Access API 仅支持 Chromium 系浏览器
- Firefox、Safari 用户无法使用文件系统存储

**解决方案**：
```typescript
// 检测浏览器支持
const isFileSystemAPISupported = () => {
  return 'showDirectoryPicker' in window;
};

// 降级策略
if (!isFileSystemAPISupported()) {
  console.warn('文件系统API不支持，降级到IndexedDB存储');
  // 将文件数据直接存入IndexedDB（有容量限制）
  return await fallbackToIndexedDB(data);
}
```

**风险等级**：⚠️ 中等
**缓解措施**：
- 提供浏览器兼容性检测
- 非Chromium浏览器降级到IndexedDB
- 在设置中提示用户推荐使用Chrome

#### 问题2：重新授权问题

**影响**：
- 每次打开应用都需要重新选择文件夹
- 用户体验下降

**当前实现**：
```typescript
// services/storage/FileStorageService.ts
if (saved.enabled && saved.rootPath) {
  console.log('存储已启用，需要重新选择目录以获取访问权限');
}
```

**解决方案**：
```typescript
// 改进的授权处理
class FileStorageService {
  private lastSelectedPath: string | null = null;

  async reauthorizeDirectory(): Promise<boolean> {
    // 1. 尝试从localStorage读取路径
    const savedConfig = this.loadConfigFromStorage();
    if (!savedConfig.rootPath) {
      return false;
    }

    // 2. 显示提示，引导用户选择同一目录
    const message = `
      请选择之前的工作目录：
      ${savedConfig.rootPath}

      这是为了获取文件访问权限（浏览器安全要求）
    `;

    // 3. 打开目录选择器
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
        // id: savedConfig.rootPath // 未来可能支持持久化ID
      });

      // 4. 验证是否是同一目录
      if (handle.name === savedConfig.rootPath) {
        await this.initialize({ ...savedConfig, rootDirectoryHandle: handle });
        return true;
      } else {
        console.warn('选择的目录与之前不同');
        return false;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('用户取消选择目录');
      }
      return false;
    }
  }

  /**
   * 应用启动时尝试重新连接
   */
  async autoReconnect(): Promise<boolean> {
    const savedConfig = this.loadConfigFromStorage();

    if (savedConfig.enabled && savedConfig.rootPath) {
      // 显示重连提示
      const shouldReconnect = confirm(
        `检测到之前使用的工作目录：\n${savedConfig.rootPath}\n\n` +
        `是否重新连接此目录以访问已保存的文件？\n\n` +
        `（这是浏览器安全要求，每次打开都需要重新授权）`
      );

      if (shouldReconnect) {
        return await this.reauthorizeDirectory();
      }
    }

    return false;
  }
}
```

**风险等级**：⚠️ 中等
**缓解措施**：
- 优化重连流程
- 保存上次使用的路径
- 提供清晰的用户提示
- 未来等待File System Access API的持久化权限功能

#### 问题3：文件与节点数据同步

**影响**：
- 节点数据在IndexedDB
- 文件在文件系统
- 可能出现不一致

**场景示例**：
```typescript
// 问题场景
1. 用户生成了5张图片
2. 文件保存到：workspace/node-123/image-1.png
3. 节点数据：node.data.images = ['data:image/png;base64,...']
4. 用户关闭浏览器
5. 重新打开，节点数据从IndexedDB加载
6. node.data.images 还是 Base64（因为保存在IndexedDB）
7. 但文件系统中有 PNG 文件
8. ❌ 数据不一致：节点不知道文件存在
```

**解决方案**：
```typescript
// 方案1：节点数据只存储引用
interface NodeData {
  // 移除直接存储 Base64
  // images: string[];  ❌ 删除

  // 改为存储引用
  assets: Array<{
    id: string;           // 文件ID
    type: 'image' | 'video';
    relativePath: string;  // 相对于工作目录的路径
    metadata: {
      size: number;
      width?: number;
      height?: number;
      createdAt: string;
    };
  }>;
}

// 方案2：智能加载策略
class NodeDataProvider {
  async getNodeImages(nodeId: string): Promise<string[]> {
    const images: string[] = [];

    // 第1步：检查文件系统
    if (this.fileStorageService?.isEnabled()) {
      try {
        const files = await this.fileStorageService.getFilesByNode('default', nodeId);

        for (const file of files) {
          const dataUrl = await this.fileStorageService.readFileAsDataUrl(file.relativePath);
          images.push(dataUrl);
        }

        if (images.length > 0) {
          console.log('✅ 从文件系统加载图片');
          return images;
        }
      } catch (error) {
        console.warn('文件系统加载失败，降级到节点数据');
      }
    }

    // 第2步：降级到节点数据（向后兼容）
    const node = await this.getNodeFromStore(nodeId);
    if (node.data.images && node.data.images.length > 0) {
      console.log('⚠️ 从节点数据加载（向后兼容）');
      return node.data.images;
    }

    // 第3步：都没有，返回空
    return [];
  }
}
```

**风险等级**：❌ 高
**缓解措施**：
- 实施智能加载策略
- 保持向后兼容
- 提供数据迁移工具
- 渐进式迁移节点数据

#### 问题4：Base64数据迁移

**影响**：
- 现有节点数据包含大量Base64
- 迁移到文件系统需要时间
- 可能造成应用卡顿

**数据量估算**：
```typescript
// 假设现有数据
100个节点 × 平均5MB Base64 = 500MB

// 迁移时间估算
// 写入文件系统：~10MB/s
// 总时间：500MB ÷ 10MB/s = 50秒
// 加上处理时间：约1-2分钟
```

**解决方案**：
```typescript
// 渐进式迁移策略
class DataMigrationService {
  private migrationQueue: Set<string> = new Set();
  private isMigrating = false;

  /**
   * 后台迁移节点数据
   */
  async migrateNodeInBackground(nodeId: string): Promise<void> {
    if (this.migrationQueue.has(nodeId)) {
      return; // 已在队列中
    }

    this.migrationQueue.add(nodeId);

    // 使用 requestIdleCallback 在空闲时迁移
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(async () => {
        await this.performMigration(nodeId);
        this.migrationQueue.delete(nodeId);
      });
    } else {
      // 降级：setTimeout 延迟执行
      setTimeout(async () => {
        await this.performMigration(nodeId);
        this.migrationQueue.delete(nodeId);
      }, 100);
    }
  }

  /**
   * 执行迁移
   */
  private async performMigration(nodeId: string): Promise<void> {
    try {
      const node = await this.getNodeFromStore(nodeId);
      const { fileStorageService } = useAppStore.getState();

      if (!fileStorageService?.isEnabled()) {
        console.log('文件系统未启用，跳过迁移');
        return;
      }

      // 迁移图片
      if (node.data.images && node.data.images.length > 0) {
        console.log(`[Migration] 迁移节点 ${nodeId} 的 ${node.data.images.length} 张图片`);

        for (let i = 0; i < node.data.images.length; i++) {
          const base64 = node.data.images[i];

          // 保存到文件系统
          const result = await fileStorageService.saveFile(
            'default',
            nodeId,
            node.type,
            base64,
            {
              prefix: `migrated-image-${i + 1}`,
              updateMetadata: true
            }
          );

          if (result.success) {
            // 更新节点数据为引用
            node.data.assets = node.data.assets || [];
            node.data.assets.push({
              id: generateUUID(),
              type: 'image',
              relativePath: result.relativePath,
              metadata: {
                migratedAt: new Date().toISOString()
              }
            });
          }
        }

        // 清除Base64数据，释放内存
        node.data.images = [];

        // 保存更新后的节点数据
        await this.saveNodeData(node);

        console.log(`[Migration] ✅ 节点 ${nodeId} 迁移完成`);
      }

    } catch (error) {
      console.error(`[Migration] ❌ 节点 ${nodeId} 迷移失败:`, error);
    }
  }

  /**
   * 批量迁移所有节点
   */
  async migrateAllNodes(): Promise<{
    total: number;
    success: number;
    failed: number;
  }> {
    const nodes = await this.getAllNodes();
    let success = 0;
    let failed = 0;

    for (const node of nodes) {
      try {
        await this.migrateNodeInBackground(node.id);
        success++;
      } catch (error) {
        console.error(`迁移节点 ${node.id} 失败:`, error);
        failed++;
      }
    }

    return {
      total: nodes.length,
      success,
      failed
    };
  }
}

// 自动触发迁移
const migrationService = new DataMigrationService();

// 应用启动时检查
window.addEventListener('load', async () => {
  const { fileStorageService } = useAppStore.getState();

  if (fileStorageService?.isEnabled()) {
    // 检查是否有未迁移的数据
    const hasOldData = await checkIfNeedsMigration();

    if (hasOldData) {
      const shouldMigrate = confirm(
        '检测到旧的Base64数据，是否迁移到文件系统以节省空间？\n\n' +
        '迁移将在后台进行，不会影响使用。'
      );

      if (shouldMigrate) {
        await migrationService.migrateAllNodes();
      }
    }
  }
});
```

**风险等级**：⚠️ 中等
**缓解措施**：
- 后台渐进式迁移
- 不阻塞用户操作
- 提供迁移进度显示
- 保留原始数据作为备份

#### 问题5：存储空间管理

**影响**：
- 用户可能不知道文件占用了多少空间
- 长期使用可能累积大量文件
- 需要清理机制

**解决方案**：
```typescript
// services/storage/StorageManager.ts

export class StorageManager {
  /**
   * 分析存储使用情况
   */
  async analyzeStorage(): Promise<StorageAnalysis> {
    const { fileStorageService } = useAppStore.getState();
    const stats = await indexedDBService.getStorageStats();

    // 获取文件系统占用（如果可用）
    let fileSystemUsage = 0;
    if (fileStorageService?.isEnabled()) {
      fileSystemUsage = await fileStorageService.calculateTotalSize();
    }

    return {
      totalNodes: stats.totalNodes,
      totalFiles: stats.totalFiles,
      totalSize: fileSystemUsage,
      byType: stats.byType,
      breakdown: await this.getDetailedBreakdown()
    };
  }

  /**
   * 清理策略
   */
  async cleanup(strategy: CleanupStrategy): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedFiles: 0,
      freedSpace: 0,
      errors: []
    };

    if (strategy === 'old') {
      // 删除30天前的文件
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const oldFiles = await fileStorageService.getFilesOlderThan(cutoffDate);

      for (const file of oldFiles) {
        try {
          const size = await fileStorageService.getFileSize(file.relativePath);
          await fileStorageService.deleteFile(file.relativePath);

          result.deletedFiles++;
          result.freedSpace += size;
        } catch (error) {
          result.errors.push({ file: file.relativePath, error });
        }
      }

      // 清理IndexedDB元数据
      const deletedMetadata = await indexedDBService.cleanupOldMetadata(30);
    }

    if (strategy === 'unused') {
      // 删除未引用的文件
      const allFiles = await fileStorageService.getAllFiles();
      const allNodes = await this.getAllNodes();
      const referencedFiles = new Set<string>();

      // 收集所有被引用的文件
      allNodes.forEach(node => {
        node.data.assets?.forEach(asset => {
          referencedFiles.add(asset.relativePath);
        });
      });

      // 删除未引用的文件
      for (const file of allFiles) {
        if (!referencedFiles.has(file.relativePath)) {
          try {
            await fileStorageService.deleteFile(file.relativePath);
            result.deletedFiles++;
          } catch (error) {
            result.errors.push({ file: file.relativePath, error });
          }
        }
      }
    }

    return result;
  }

  /**
   * 自动清理策略
   */
  async autoCleanup(): Promise<void> {
    const analysis = await this.analyzeStorage();

    // 如果超过阈值（例如10GB），自动清理
    const THRESHOLD = 10 * 1024 * 1024 * 1024; // 10GB

    if (analysis.totalSize > THRESHOLD) {
      console.log('[StorageManager] 存储空间超过阈值，开始自动清理');

      await this.cleanup('old');

      const newSize = (await this.analyzeStorage()).totalSize;
      console.log(`[StorageManager] 清理完成，释放空间: ${formatBytes(analysis.totalSize - newSize)}`);
    }
  }
}

// 在设置面板添加存储管理
function StorageSettings() {
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(null);

  useEffect(() => {
    storageManager.analyzeStorage().then(setAnalysis);
  }, []);

  return (
    <div className="storage-settings">
      <h3>存储管理</h3>

      {analysis && (
        <>
          <div className="storage-stats">
            <p>总节点数：{analysis.totalNodes}</p>
            <p>总文件数：{analysis.totalFiles}</p>
            <p>占用空间：{formatBytes(analysis.totalSize)}</p>

            <h4>按类型统计：</h4>
            {Object.entries(analysis.byType).map(([type, count]) => (
              <p key={type}>{type}: {count} 个文件</p>
            ))}
          </div>

          <div className="storage-actions">
            <button onClick={() => storageManager.cleanup('old')}>
              清理30天前的文件
            </button>
            <button onClick={() => storageManager.cleanup('unused')}>
              清理未使用的文件
            </button>
            <button onClick={() => storageManager.autoCleanup()}>
              自动清理
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

**风险等级**：⚠️ 中等
**缓解措施**：
- 提供存储分析工具
- 自动清理策略
- 用户手动清理选项
- 清理前确认提示

### 4.3 对现有代码的影响

#### 影响范围分析

| 影响类型 | 影响范围 | 影响程度 | 需要修改 |
|---------|---------|---------|---------|
| **新增拦截器** | 所有生成类节点 | 🟡 中等 | 集成到现有服务 |
| **节点数据结构** | 所有节点类型 | 🟡 中等 | 可选：添加assets字段 |
| **UI组件** | 显示媒体文件的组件 | 🟢 较小 | 添加缓存指示器 |
| **存储服务** | FileStorageService | 🟢 较小 | 增强元数据处理 |
| **启动流程** | App初始化 | 🟢 较小 | 添加自动重连 |

#### 兼容性保证

```typescript
// 向后兼容策略
interface NodeData {
  // 保留原有字段（向后兼容）
  images?: string[];      // 旧：直接存储Base64
  videoUrl?: string;      // 旧：直接存储URL
  audioUrl?: string;      // 旧：直接存储Base64

  // 新增字段（推荐使用）
  assets?: Array<{       // 新：文件引用
    id: string;
    type: 'image' | 'video' | 'audio';
    relativePath: string;
    metadata: any;
  }>;

  // 缓存信息（新增）
  cacheInfo?: {
    isCached: boolean;
    cacheLocation: 'filesystem' | 'indexeddb';
    lastRefreshed: string;
  };
}

// 智能读取逻辑
function getImagesFromNode(node: AppNode): string[] {
  // 优先使用新的引用方式
  if (node.data.assets && node.data.assets.length > 0) {
    return node.data.assets.map(a => a.relativePath);
  }

  // 降级到旧的Base64方式
  if (node.data.images && node.data.images.length > 0) {
    return node.data.images;
  }

  // 都没有，返回空
  return [];
}
```

## 五、实施计划（修订版）

### 5.1 阶段划分

| 阶段 | 任务 | 时间 | 风险等级 |
|-----|------|------|---------|
| **阶段0** | 需求确认和技术调研 | 1-2天 | 低 |
| **阶段1** | 增强IndexedDB元数据服务 | 2-3天 | 低 |
| **阶段2** | 创建API拦截器 | 3-4天 | 中 |
| **阶段3** | 改造图片生成节点 | 2-3天 | 中 |
| **阶段4** | 改造视频生成节点 | 2-3天 | 中 |
| **阶段5** | 改造角色节点 | 3-4天 | 中 |
| **阶段6** | 数据迁移工具 | 2-3天 | 中 |
| **阶段7** | UI改进和用户提示 | 2-3天 | 低 |
| **阶段8** | 测试和优化 | 3-4天 | 中 |
| **总计** | | **20-27天** | |

### 5.2 详细任务

#### 阶段1：增强IndexedDB元数据服务

**目标**：创建文件元数据索引系统

**任务**：
1. 创建 IndexedDBService 类
2. 设计元数据schema
3. 实现CRUD操作
4. 添加查询功能
5. 添加清理功能

**验收**：
- 可以保存文件元数据
- 可以按节点ID查询
- 可以清理旧数据

#### 阶段2：创建API拦截器

**目标**：统一的API调用拦截层

**任务**：
1. 创建 ApiInterceptor 类
2. 实现缓存检查逻辑
3. 集成 FileStorageService
4. 添加降级策略
5. 单元测试

**验收**：
- 可以拦截API调用
- 缓存命中时直接返回
- 未命中时调用API并保存

#### 阶段3：改造图片生成节点

**目标**：图片自动缓存到文件系统

**任务**：
1. 修改 ImageGeneratorNodeService
2. 集成 apiInterceptor
3. 更新UI显示缓存状态
4. 测试缓存功能

**验收**：
- 生成图片自动保存
- 刷新后从文件系统加载
- 显示"已缓存"标识

#### 阶段4：改造视频生成节点

**目标**：视频自动缓存到文件系统

**任务**：
1. 修改 VideoGeneratorNodeService
2. 处理大文件下载和保存
3. 测试视频播放
4. 性能优化

**验收**：
- 视频保存到本地
- 可以离线播放
- 性能可接受

#### 阶段5：改造角色节点

**目标**：角色数据和图片自动保存

**任务**：
1. 修改角色生成流程
2. 保存九宫格和三视图
3. 保存角色档案JSON
4. 测试完整性

**验收**：
- 角色数据持久化
- 图片文件正确保存
- 可以完整恢复

#### 阶段6：数据迁移工具

**目标**：迁移旧的Base64数据

**任务**：
1. 创建迁移服务
2. 实现后台迁移
3. 添加进度显示
4. 提供回滚功能

**验收**：
- 可以迁移旧数据
- 不影响正常使用
- 迁移进度可见

#### 阶段7：UI改进和用户提示

**目标**：更好的用户体验

**任务**：
1. 添加缓存指示器
2. 添加存储管理面板
3. 优化重连流程
4. 添加清理工具

**验收**：
- 用户知道数据存储位置
- 可以管理存储空间
- 重连流程顺畅

#### 阶段8：测试和优化

**目标**：确保稳定性和性能

**任务**：
1. 功能测试
2. 性能测试
3. 兼容性测试
4. 用户测试
5. Bug修复

**验收**：
- 所有功能正常
- 性能可接受
- 主流浏览器可用

## 六、风险矩阵

| 风险 | 影响 | 概率 | 等级 | 缓解措施 |
|-----|------|------|------|---------|
| 浏览器兼容性 | 高 | 中 | 🔴 高 | 提供降级方案（IndexedDB） |
| 重新授权体验 | 中 | 高 | 🟡 中 | 优化重连流程 |
| 数据迁移性能 | 中 | 低 | 🟢 低 | 后台渐进式迁移 |
| 文件系统性能 | 中 | 低 | 🟢 低 | 两级缓存，异步操作 |
| 数据一致性 | 高 | 中 | 🟡 中 | 智能加载策略 |
| 存储空间管理 | 低 | 中 | 🟢 低 | 自动清理工具 |
| 用户接受度 | 中 | 低 | 🟢 低 | 充分说明，保持透明 |

## 七、成功标准

### 7.1 技术指标

- ✅ 刷新页面后数据不丢失
- ✅ 文件正确保存到本地
- ✅ 缓存命中率 > 80%
- ✅ 加载时间 < 2秒（文件系统）
- ✅ 内存占用减少 > 50%
- ✅ 兼容 Chrome 86+、Edge 86+
- ✅ 非Chromium浏览器降级可用

### 7.2 用户体验指标

- ✅ 用户知道文件存储位置
- ✅ 可以直接查看和管理文件
- ✅ 重连流程简单明了
- ✅ 缓存状态清晰可见
- ✅ 存储空间易于管理

## 八、总结和建议

### 8.1 核心优势

1. **利用现有实现** - FileStorageService 已经完善
2. **渐进式改造** - 可以分阶段实施
3. **向后兼容** - 不破坏现有功能
4. **用户可控** - 文件对用户可见
5. **性能提升** - 缓存显著加快加载

### 8.2 关键注意事项

1. **浏览器兼容性** - 必须提供降级方案
2. **重新授权** - 需要优化用户体验
3. **数据一致性** - 确保文件和元数据同步
4. **Base64迁移** - 避免阻塞用户操作
5. **存储管理** - 防止空间无限增长

### 8.3 建议的实施顺序

**推荐顺序**：
1. 先实现 API 拦截器（不破坏现有功能）
2. 再增强 IndexedDB 元数据（提供查询能力）
3. 然后改造单个节点类型（图片节点最简单）
4. 最后实现数据迁移（最复杂的部分）

**不建议**：
- ❌ 不要一次性改造所有节点
- ❌ 不要立即删除旧的Base64数据
- ❌ 不要忽略浏览器兼容性
- ❌ 不要跳过用户测试

### 8.4 下一步行动

1. **审阅本规划** - 确认方案可行
2. **技术调研** - File System Access API 最新特性
3. **原型验证** - 先实现一个节点类型验证
4. **用户沟通** - 说明改造的价值
5. **分阶段实施** - 按计划逐步推进

---

**文档版本**：v2.0（修正版）
**创建时间**：2025-01-26
**最后更新**：2025-01-26
