# 本地存储实施指南

## 已完成的工作

### 阶段0-1: 基础设施 ✅

已创建以下核心服务:

1. **IndexedDBService** (`services/storage/IndexedDBService.ts`)
   - 文件元数据管理
   - 角色元数据管理
   - 工作流元数据管理
   - 存储统计和清理功能

2. **ApiInterceptorService** (`services/apiInterceptor/ApiInterceptorService.ts`)
   - 图片生成拦截
   - 视频生成拦截
   - 音频生成拦截
   - 自动缓存保存

## 下一步: 阶段2 集成到现有系统

### 2.1 在 App.tsx 中初始化服务

在 `App.tsx` 的初始化部分添加:

```typescript
import { indexedDBService } from './services/storage/IndexedDBService';
import { apiInterceptor } from './services/apiInterceptor/ApiInterceptorService';

// 在应用启动时初始化
useEffect(() => {
  const initializeServices = async () => {
    // 初始化 IndexedDB
    await indexedDBService.init();
    console.log('[App] IndexedDB 服务已初始化');

    // 连接 FileStorageService 到 ApiInterceptor
    const { fileStorageService } = useAppStore.getState();
    apiInterceptor.setFileStorageService(fileStorageService);
  };

  initializeServices();
}, []);
```

### 2.2 改造图片生成节点服务

修改 `services/nodes/imageGenerator.service.ts`:

```typescript
import { apiInterceptor } from '../apiInterceptor/ApiInterceptorService';

export class ImageGeneratorNodeService {
  async execute(node: AppNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    try {
      console.log('[ImageGenerator] 开始执行', node.id);

      // 更新节点状态
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'processing'
      }, context);

      // ✅ 使用 API 拦截器替代直接调用
      const result = await apiInterceptor.interceptGenerateImage(
        node.id,
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
        cacheLocation: result.cacheLocation,
        savedPaths: result.savedPaths,
        generatedAt: new Date().toISOString(),
        lastRefreshed: new Date().toISOString()
      }, context);

      console.log('[ImageGenerator] 执行完成', {
        nodeId: node.id,
        imageCount: result.images.length,
        fromCache: result.fromCache,
        cacheLocation: result.cacheLocation
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

### 2.3 改造视频生成节点服务

修改 `services/nodes/videoGenerator.service.ts`:

```typescript
import { apiInterceptor } from '../apiInterceptor/ApiInterceptorService';

export class VideoGeneratorNodeService {
  async execute(node: AppNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    try {
      console.log('[VideoGenerator] 开始执行', node.id);

      // 更新节点状态
      this.updateNodeData(node.id, {
        ...node.data,
        status: 'processing'
      }, context);

      // ✅ 使用 API 拦截器
      const result = await apiInterceptor.interceptGenerateVideo(
        node.id,
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
        cacheLocation: result.cacheLocation,
        savedPath: result.savedPath,
        generatedAt: new Date().toISOString()
      }, context);

      console.log('[VideoGenerator] 执行完成', {
        nodeId: node.id,
        fromCache: result.fromCache,
        cacheLocation: result.cacheLocation
      });

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

### 2.4 在 Node.tsx 中显示缓存状态

修改 `components/Node.tsx` 的图片/视频显示部分,添加缓存指示器:

```typescript
// 图片生成节点
{node.type === NodeType.IMAGE_GENERATOR && (
  <div className="relative">
    {/* 缓存指示器 */}
    {node.data.isCached && (
      <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1">
        📦 已缓存
        {node.data.cacheLocation && (
          <span className="text-[10px] opacity-70">
            {node.data.cacheLocation === 'filesystem' ? '本地文件' : '数据库'}
          </span>
        )}
      </div>
    )}

    {/* 图片显示 */}
    <div className="image-grid">
      {node.data.images?.map((img, idx) => (
        <img key={idx} src={img} alt={`Generated ${idx}`} />
      ))}
    </div>
  </div>
)}

// 视频生成节点
{node.type === NodeType.VIDEO_GENERATOR && node.data.videoUrl && (
  <div className="relative">
    {/* 缓存指示器 */}
    {node.data.isCached && (
      <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1">
        📦 已缓存
        {node.data.cacheLocation && (
          <span className="text-[10px] opacity-70">
            {node.data.cacheLocation === 'filesystem' ? '本地文件' : '数据库'}
          </span>
        )}
      </div>
    )}

    {/* 视频播放器 */}
    <video src={node.data.videoUrl} controls />
  </div>
)}
```

## 测试步骤

### 1. 测试图片生成缓存

1. 启动应用: `npm run dev`
2. 打开浏览器控制台
3. 创建一个图片生成节点,点击生成
4. 观察控制台日志:
   - 首次生成应该看到 `[ApiInterceptor] 🌐 调用 API 生成图片`
   - 保存文件应该看到 `[ApiInterceptor] 💾 保存了 X 个文件到文件系统`
5. 刷新页面
6. 再次点击生成,应该看到:
   - `[ApiInterceptor] ✅ 从文件系统加载图片`
   - 图片立即显示,不调用 API

### 2. 测试视频生成缓存

1. 创建一个视频生成节点,点击生成
2. 首次应该调用 API 并下载保存视频
3. 刷新页面
4. 再次点击生成,应该从本地文件加载

### 3. 查看存储统计

在浏览器控制台运行:

```javascript
// 获取存储统计
import { indexedDBService } from './services/storage/IndexedDBService';
const stats = await indexedDBService.getStorageStats();
console.log('存储统计:', stats);
```

### 4. 清除缓存

```javascript
// 清除特定节点的缓存
import { apiInterceptor } from './services/apiInterceptor/ApiInterceptorService';
await apiInterceptor.clearNodeCache('node-id-here');

// 清理30天前的元数据
await indexedDBService.cleanupOldMetadata(30);
```

## 常见问题

### Q1: FileStorageService 未连接

**现象**: 控制台显示 `⚠️ FileStorageService 未连接`

**原因**: FileStorageService 没有正确传递给 ApiInterceptor

**解决**: 确保 App.tsx 中有:
```typescript
const { fileStorageService } = useAppStore.getState();
apiInterceptor.setFileStorageService(fileStorageService);
```

### Q2: 文件保存失败

**现象**: 控制台显示 `文件系统保存失败`

**原因**: 用户未选择本地文件夹,或文件夹权限不足

**解决**:
1. 在设置中配置本地文件夹
2. 确保应用有文件夹的读写权限

### Q3: 缓存未命中

**现象**: 每次都调用 API,没有使用缓存

**原因**:
1. nodeId 不匹配
2. 文件未正确保存
3. 元数据未正确记录

**解决**: 检查控制台日志,确认文件保存和元数据记录是否成功

## 性能优化建议

### 1. 大视频文件处理

对于大视频文件(>50MB),建议在后台线程处理:

```typescript
// 使用 Web Worker 下载视频
const downloadVideoInWorker = async (url: string) => {
  const worker = new Worker('/workers/video-downloader.js');
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => resolve(e.data);
    worker.onerror = reject;
    worker.postMessage({ url });
  });
};
```

### 2. 渐进式加载

对于多图片场景,先显示缩略图:

```typescript
// 先加载低分辨率版本
const loadImagesProgressively = async (nodeId: string) => {
  const thumbnails = await loadThumbnails(nodeId);
  updateUI(thumbnails);

  // 后台加载完整图片
  const fullImages = await loadFullImages(nodeId);
  updateUI(fullImages);
};
```

### 3. 预加载常用节点

```typescript
// 预加载最近使用的节点
const preloadRecentNodes = async () => {
  const recentNodes = await getRecentNodes();
  for (const node of recentNodes) {
    // 后台预加载,不阻塞UI
    requestIdleCallback(() => preloadNodeData(node.id));
  }
};
```

## 下一步计划

- [ ] 改造音频生成节点
- [ ] 改造角色生成节点
- [ ] 添加数据迁移工具
- [ ] 添加存储管理 UI
- [ ] 性能优化和测试

## 需要帮助?

查看完整规划文档:
- `docs/LOCAL_STORAGE_PLAN_V2.md` - 方案对比和架构设计
- `docs/LOCAL_STORAGE_MIGRATION_PLAN.md` - 详细实施计划
