# Web 本地存储优化方案（基于现有系统）

## 一、现状分析

### 1.1 已实现的功能 ✅

**FileStorageService** (`services/storage/FileStorageService.ts`)
- ✅ 使用 File System Access API
- ✅ 文件保存到用户选择的文件夹
- ✅ 元数据管理（MetadataManager）
- ✅ 自动保存机制（storageHelper.ts）
- ✅ 配置持久化（localStorage）

**当前工作流程：**
```
用户生成图片 → API 调用 → 保存 Base64 到节点数据
                ↓
            自动保存到文件系统（FileStorageService）
                ↓
            文件存储在：/用户选择的文件夹/default/IMAGE_GENERATOR/node-123/image-1.png
```

### 1.2 核心问题 ❌

#### 问题 1：没有缓存检查机制
```typescript
// 当前流程（App.tsx）
if (node.type === NodeType.IMAGE_GENERATOR) {
    // ❌ 直接调用 API，不管本地是否已有
    const res = await generateImageFromText(...);
    handleNodeUpdate(id, { images: res });
    // 保存到文件系统（但下次不会读取）
    await saveImageNodeOutput(id, res, 'IMAGE_GENERATOR');
}
```

**影响：**
- 每次刷新页面都重新生成
- 浪费 API 调用（成本高）
- 用户体验差（等待时间长）

#### 问题 2：节点数据存储大量 Base64
```typescript
interface NodeData {
    images: string[];  // ❌ 包含完整的 Base64 数据
    // 例如: "data:image/png;base64,iVBORw0KGgoAAAANS..." (5MB+)
}

// 100 个节点 × 平均 5MB = 500MB 内存占用
```

**影响：**
- 页面内存占用巨大
- 保存到 IndexedDB（节点数据）时阻塞
- 刷新页面加载慢

#### 问题 3：每次刷新需重新授权
```
用户打开页面 → 检测到已配置存储 → 提示重新选择文件夹
            → 用户选择同一文件夹 → 获取访问权限
```

**影响：**
- 用户操作繁琐
- 用户体验差
- 这是 File System Access API 的安全限制，**无法完全避免**

## 二、优化方案（渐进式、最小侵入）

### 核心思路

**不创建新架构，基于现有 FileStorageService 优化：**
1. 添加缓存检查逻辑
2. 添加从文件加载回节点的机制
3. 逐步优化节点数据存储方式
4. 改进授权体验

---

## 三、详细实施方案

### 阶段 1：添加缓存检查逻辑 ⭐ 优先级最高

**目标：** 生成前检查本地是否已有文件，避免重复 API 调用

**实施位置：** `App.tsx` 中的节点执行逻辑

#### 3.1.1 创建缓存检查工具

```typescript
// utils/cacheChecker.ts (新建)

import { getFileStorageService } from '../services/storage';

/**
 * 检查节点是否已有缓存的文件
 */
export async function checkNodeCache(
    nodeId: string,
    nodeType: string
): Promise<{
    hasCache: boolean;
    files?: Array<{
        relativePath: string;
        dataUrl: string;
    }>;
}> {
    const service = getFileStorageService();

    // 检查存储是否启用
    if (!service.isEnabled()) {
        console.log('[CacheChecker] 存储未启用');
        return { hasCache: false };
    }

    try {
        // 从元数据获取该节点的文件
        const metadataManager = (service as any).metadataManager;
        if (!metadataManager) {
            return { hasCache: false };
        }

        const files = metadataManager.getFilesByNode(nodeId);

        if (files.length === 0) {
            console.log('[CacheChecker] 节点无缓存文件:', nodeId);
            return { hasCache: false };
        }

        console.log(`[CacheChecker] 找到 ${files.length} 个缓存文件`);

        // 读取文件内容
        const fileData = await Promise.all(
            files.map(async (file) => {
                try {
                    const dataUrl = await service.readFileAsDataUrl(file.relativePath);
                    return {
                        relativePath: file.relativePath,
                        dataUrl
                    };
                } catch (error) {
                    console.error('[CacheChecker] 读取文件失败:', file.relativePath, error);
                    return null;
                }
            })
        );

        // 过滤掉读取失败的
        const validFiles = fileData.filter(f => f !== null);

        return {
            hasCache: validFiles.length > 0,
            files: validFiles
        };

    } catch (error) {
        console.error('[CacheChecker] 检查缓存失败:', error);
        return { hasCache: false };
    }
}

/**
 * 检查图片节点缓存
 */
export async function checkImageNodeCache(nodeId: string): Promise<string[] | null> {
    const result = await checkNodeCache(nodeId, 'IMAGE_GENERATOR');

    if (!result.hasCache || !result.files) {
        return null;
    }

    // 返回图片 Data URLs
    return result.files.map(f => f.dataUrl);
}

/**
 * 检查视频节点缓存
 */
export async function checkVideoNodeCache(nodeId: string): Promise<string | null> {
    const result = await checkNodeCache(nodeId, 'VIDEO_GENERATOR');

    if (!result.hasCache || !result.files || result.files.length === 0) {
        return null;
    }

    return result.files[0].dataUrl;
}

/**
 * 检查音频节点缓存
 */
export async function checkAudioNodeCache(nodeId: string): Promise<string | null> {
    const result = await checkNodeCache(nodeId, 'AUDIO_GENERATOR');

    if (!result.hasCache || !result.files || result.files.length === 0) {
        return null;
    }

    return result.files[0].dataUrl;
}
```

#### 3.1.2 修改 App.tsx 节点执行逻辑

```typescript
// App.tsx - 在 executeNode 函数中添加缓存检查

import { checkImageNodeCache, checkVideoNodeCache, checkAudioNodeCache } from './utils/cacheChecker';

// 修改图片生成节点逻辑
if (node.type === NodeType.IMAGE_GENERATOR) {
    console.log('[App] IMAGE_GENERATOR 节点执行');

    // ✅ 新增：检查缓存
    const cachedImages = await checkImageNodeCache(id);

    if (cachedImages && cachedImages.length > 0) {
        console.log('[App] ✅ 使用缓存的图片', cachedImages.length);

        handleNodeUpdate(id, {
            images: cachedImages,
            status: 'success',
            isCached: true,
            cacheLocation: 'filesystem'
        });

        continue; // 跳过 API 调用
    }

    // ❌ 没有缓存，调用 API
    console.log('[App] 🌐 缓存未命中，调用 API 生成图片');
    const res = await generateImageFromText(...);

    handleNodeUpdate(id, {
        images: res,
        status: 'success',
        isCached: false
    });

    // 保存到文件系统（现有逻辑）
    await saveImageNodeOutput(id, res, 'IMAGE_GENERATOR');
}

// 修改视频生成节点逻辑
else if (node.type === NodeType.VIDEO_GENERATOR) {
    // ✅ 新增：检查缓存
    const cachedVideo = await checkVideoNodeCache(id);

    if (cachedVideo) {
        console.log('[App] ✅ 使用缓存的视频');

        handleNodeUpdate(id, {
            videoUri: cachedVideo,
            status: 'success',
            isCached: true,
            cacheLocation: 'filesystem'
        });

        continue;
    }

    // ❌ 没有缓存，调用 API
    console.log('[App] 🌐 缓存未命中，调用 API 生成视频');
    const res = await generateVideo(...);

    handleNodeUpdate(id, {
        videoUri: res.uri,
        status: 'success',
        isCached: false
    });

    await saveVideoNodeOutput(id, [res.uri], 'VIDEO_GENERATOR');
}

// 修改音频生成节点逻辑
else if (node.type === NodeType.AUDIO_GENERATOR) {
    // ✅ 新增：检查缓存
    const cachedAudio = await checkAudioNodeCache(id);

    if (cachedAudio) {
        console.log('[App] ✅ 使用缓存的音频');

        handleNodeUpdate(id, {
            audioUri: cachedAudio,
            status: 'success',
            isCached: true,
            cacheLocation: 'filesystem'
        });

        continue;
    }

    // ❌ 没有缓存，调用 API
    console.log('[App] 🌐 缓存未命中，调用 API 生成音频');
    const audioUri = await generateAudio(...);

    handleNodeUpdate(id, {
        audioUri: audioUri,
        status: 'success',
        isCached: false
    });

    await saveAudioNodeOutput(id, audioUri, 'AUDIO_GENERATOR');
}
```

**影响分析：**

| 影响类型 | 说明 | 风险等级 |
|---------|------|---------|
| **性能** | 缓存命中时速度提升 10-100 倍 | ✅ 正面 |
| **成本** | 减少 API 调用 80%+ | ✅ 正面 |
| **兼容性** | 不破坏现有逻辑，只是添加前置检查 | 🟢 低风险 |
| **用户体验** | 显著提升，几乎即时加载 | ✅ 正面 |

**潜在问题：**

1. **文件损坏或删除**
   - 问题：元数据显示有文件，但实际文件已删除
   - 解决：try-catch 包裹，失败时调用 API
   - 影响：低（有降级方案）

2. **文件格式不匹配**
   - 问题：用户在文件系统修改了文件
   - 解决：添加文件验证（检查魔数、尺寸）
   - 影响：低（可忽略）

---

### 阶段 2：优化授权流程

**目标：** 让重新授权更顺畅，减少用户困扰

#### 3.2.1 改进启动时的重连提示

```typescript
// App.tsx - 在应用启动时检查存储状态

useEffect(() => {
    const initStorage = async () => {
        const service = getFileStorageService();
        const savedConfig = FileStorageService.loadConfigFromStorage();

        // 检查是否曾启用存储
        if (savedConfig.enabled && savedConfig.rootPath) {
            console.log('[App] 检测到已配置的存储:', savedConfig.rootPath);

            // 显示友好的重连提示
            const shouldReconnect = window.confirm(
                `📁 检测到您之前使用的工作文件夹：\n\n` +
                `   ${savedConfig.rootPath}\n\n` +
                `是否重新连接此文件夹以访问已保存的文件？\n\n` +
                `提示：这是浏览器安全要求，每次打开应用都需要重新授权。\n` +
                `      选择"取消"将不使用本地存储（仍可正常使用）。`
            );

            if (shouldReconnect) {
                try {
                    await service.selectRootDirectory();

                    // 验证是否是同一目录
                    const currentConfig = service.getConfig();
                    if (currentConfig.rootPath === savedConfig.rootPath) {
                        console.log('[App] ✅ 成功重连到工作文件夹');
                        toast.success('已连接到工作文件夹，可以加载缓存文件');
                    } else {
                        console.warn('[App] ⚠️ 选择的目录与之前不同');
                        toast.warning('选择的目录与之前不同，可能无法加载之前的缓存');
                    }
                } catch (error: any) {
                    console.error('[App] 重连失败:', error);
                    toast.error('连接文件夹失败: ' + error.message);
                }
            } else {
                console.log('[App] 用户取消连接文件夹');
            }
        }
    };

    initStorage();
}, []);
```

#### 3.2.2 添加"记住我的选择"说明

在设置面板添加说明：

```typescript
// components/StorageSettingsPanel.tsx

<div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
    <h4 className="font-semibold mb-2">💡 关于本地存储</h4>
    <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
        <li>• 文件保存在您选择的文件夹中，永久保存</li>
        <li>• 下次打开需要重新选择同一文件夹（浏览器安全要求）</li>
        <li>• 可以在 Finder/文件管理器中直接查看和管理文件</li>
        <li>• 关闭本地存储后，仍可正常使用（但不加载缓存）</li>
    </ul>
</div>
```

**影响分析：**

| 影响类型 | 说明 | 风险等级 |
|---------|------|---------|
| **用户体验** | 更清晰的提示，减少困惑 | ✅ 正面 |
| **技术** | 只是 UI 改进，无逻辑变化 | 🟢 无风险 |
| **浏览器限制** | 无法绕过重新授权要求 | ⚠️ 限制仍在 |

---

### 阶段 3：优化节点数据存储（可选，渐进式）

**目标：** 逐步减少节点数据中的 Base64 占用

**注意：** 这是可选的优化，阶段 1 和 2 已能解决主要问题

#### 3.3.1 添加文件引用字段

```typescript
// types/node.ts

interface NodeData {
    // 保留现有字段（向后兼容）
    images?: string[];      // Base64 数据
    videoUrl?: string;      // 视频 URL
    audioUri?: string;      // 音频 Base64

    // ✅ 新增：文件引用字段
    assets?: Array<{
        id: string;
        type: 'image' | 'video' | 'audio';
        relativePath: string;  // 文件系统中的相对路径
        size: number;
        createdAt: string;
    }>;

    // 缓存信息
    cacheInfo?: {
        isCached: boolean;
        cacheLocation: 'filesystem';
        lastRefreshed: string;
    };
}
```

#### 3.3.2 修改保存逻辑

```typescript
// utils/storageHelper.ts

export async function saveImageNodeOutput(
    nodeId: string,
    images: string[],
    nodeType: string = 'IMAGE_GENERATOR'
): Promise<SaveNodeOutputResult> {
    const result = await saveNodeOutput({
        nodeId,
        nodeType,
        fileData: images,
        fileType: 'image',
    });

    // ✅ 新增：返回文件引用信息
    if (result.success && result.savedPaths) {
        return {
            ...result,
            assets: result.savedPaths.map((path, index) => ({
                id: `asset-${nodeId}-${index}`,
                type: 'image' as const,
                relativePath: path,
                createdAt: new Date().toISOString()
            }))
        };
    }

    return result;
}
```

#### 3.3.3 在节点中保存引用而非 Base64

```typescript
// App.tsx - 保存成功后更新节点数据

const saveResult = await saveImageNodeOutput(id, res, 'IMAGE_GENERATOR');

if (saveResult.success && saveResult.assets) {
    // ✅ 同时保存文件引用
    handleNodeUpdate(id, {
        images: res,  // 保留 Base64（向后兼容）
        assets: saveResult.assets,  // 新增：文件引用
        cacheInfo: {
            isCached: true,
            cacheLocation: 'filesystem',
            lastRefreshed: new Date().toISOString()
        }
    });
}
```

**影响分析：**

| 影响类型 | 说明 | 风险等级 |
|---------|------|---------|
| **内存** | 同时保存 Base64 和引用，内存反而增加 | ⚠️ 负面 |
| **兼容性** | 保留 Base64，向后兼容 | 🟢 低风险 |
| **清理** | 需要额外的清理逻辑移除旧 Base64 | 🟡 中等 |

**建议：**
- ⚠️ **暂不实施**：会增加内存占用
- 未来方案：后台渐进式迁移，移除 Base64

---

### 阶段 4：数据迁移工具（未来可选）

**目标：** 清理节点数据中的 Base64，节省空间

```typescript
// utils/dataMigration.ts

export async function migrateNodeData(nodeId: string): Promise<void> {
    const service = getFileStorageService();

    if (!service.isEnabled()) {
        console.log('[Migration] 存储未启用，跳过迁移');
        return;
    }

    // 检查是否已迁移
    const node = nodes.find(n => n.id === nodeId);
    if (node?.data.assets && node.data.assets.length > 0) {
        console.log('[Migration] 节点已迁移，跳过');
        return;
    }

    console.log('[Migration] 开始迁移节点:', nodeId);

    // 检查文件系统是否有文件
    const files = (service as any).metadataManager?.getFilesByNode(nodeId);

    if (files && files.length > 0) {
        console.log('[Migration] 找到文件，清理 Base64');

        // 清理 Base64，保留文件引用
        handleNodeUpdate(nodeId, {
            images: [],  // 清空 Base64
            assets: files.map(f => ({
                id: f.id,
                type: 'image',
                relativePath: f.relativePath,
                size: f.size,
                createdAt: f.createdAt
            }))
        });

        console.log('[Migration] ✅ 迁移完成');
    } else {
        console.log('[Migration] ⚠️ 文件系统无文件，保留 Base64');
    }
}
```

**影响分析：**

| 影响类型 | 说明 | 风险等级 |
|---------|------|---------|
| **数据安全** | 清理前需确认文件存在 | 🔴 高风险 |
| **用户体验** | 清理后需要从文件加载 | 🟡 中等 |
| **时间** | 大量数据迁移耗时 | ⚠️ 需后台处理 |

**建议：**
- 提供手动迁移工具，由用户主动触发
- 保留备份，防止数据丢失

---

## 四、对系统的影响分析

### 4.1 正面影响 ✅

#### 1. 性能提升显著

| 指标 | 优化前 | 优化后（缓存命中） | 提升 |
|-----|--------|-------------------|------|
| 图片加载时间 | 5-15秒（API 调用） | 0.1-0.5秒 | **10-30倍** |
| 视频加载时间 | 10-30秒（API+下载） | 0.5-1秒 | **20-60倍** |
| API 调用次数 | 每次刷新都调用 | 缓存命中时不调用 | **减少80%+** |
| 成本 | 高（重复调用） | 低 | **节省80%+** |

#### 2. 用户体验改善

- ✅ 刷新页面后数据保留
- ✅ 重新生成几乎即时完成
- ✅ 节省 API 调用成本
- ✅ 数据永久保存在用户硬盘

#### 3. 兼容性好

- ✅ 不破坏现有功能
- ✅ 向后兼容
- ✅ 渐进式增强
- ✅ 可以随时禁用

### 4.2 潜在风险 ⚠️

#### 风险 1：文件系统权限问题

**问题：**
- 文件被外部删除/修改
- 权限丢失
- 元数据与实际文件不一致

**缓解措施：**
```typescript
// 添加文件验证
async function validateFile(relativePath: string): Promise<boolean> {
    try {
        const service = getFileStorageService();
        await service.readFile(relativePath);  // 尝试读取
        return true;
    } catch (error) {
        console.warn('[Validate] 文件无效:', relativePath);
        return false;
    }
}

// 使用缓存前验证
const isValid = await validateFile(file.relativePath);
if (!isValid) {
    // 文件损坏，重新生成
    return await callAPI();
}
```

**风险等级：** 🟡 中等（有降级方案）

#### 风险 2：跨浏览器问题

**问题：**
- File System Access API 仅支持 Chromium 系
- Firefox/Safari 用户无法使用

**缓解措施：**
```typescript
// 检测浏览器支持
if (!supportsFileSystemAccessAPI()) {
    // 显示提示，建议使用 Chrome
    toast.warning(
        '本地存储功能需要 Chrome/Edge 浏览器。\n' +
        '您仍可正常使用，但无法加载本地缓存。'
    );
    // 禁用存储相关 UI
    return;
}
```

**风险等级：** 🟡 中等（功能降级，不影响核心功能）

#### 风险 3：元数据膨胀

**问题：**
- 长期使用后元数据文件变大
- `.aiyou-metadata.json` 可能包含大量记录

**缓解措施：**
```typescript
// 定期清理
async function cleanupOldMetadata(daysToKeep: number = 30) {
    const service = getFileStorageService();
    const metadataManager = (service as any).metadataManager;

    // 获取所有元数据
    const allFiles = metadataManager.getAllFiles();

    // 过滤出旧的
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const oldFiles = allFiles.filter(f =>
        new Date(f.createdAt) < cutoffDate
    );

    console.log(`[Cleanup] 发现 ${oldFiles.length} 个旧记录`);

    // 询问用户是否清理
    const shouldCleanup = window.confirm(
        `发现 ${oldFiles.length} 个 30 天前的文件记录。\n` +
        `是否清理元数据（不会删除实际文件）？`
    );

    if (shouldCleanup) {
        for (const file of oldFiles) {
            metadataManager.removeFileByPath(file.relativePath);
        }
        console.log('[Cleanup] ✅ 清理完成');
    }
}
```

**风险等级：** 🟢 低（有清理机制）

#### 风险 4：用户误操作

**问题：**
- 用户在文件管理器中删除文件
- 用户选择了错误的文件夹
- 用户移动了工作文件夹

**缓解措施：**
```typescript
// 添加文件夹验证
async function validateWorkspace(expectedPath: string): Promise<boolean> {
    const service = getFileStorageService();
    const stats = service.getStorageStats();

    // 检查是否有预期的文件
    if (stats.totalFiles === 0) {
        toast.warning('该文件夹中没有找到缓存文件，可能不是正确的工作文件夹');
        return false;
    }

    return true;
}

// 在用户选择文件夹后验证
const handle = await window.showDirectoryPicker(...);
await service.initialize({ rootDirectoryHandle: handle });

const isValid = await validateWorkspace(savedConfig.rootPath);
if (!isValid) {
    toast.error('请选择正确的工作文件夹');
}
```

**风险等级：** 🟡 中等（提示和验证）

### 4.3 对现有代码的影响

#### 影响范围评估

| 文件/模块 | 影响程度 | 修改内容 | 风险 |
|----------|---------|---------|------|
| `App.tsx` | 🟡 中等 | 添加缓存检查逻辑 | 需仔细测试 |
| `utils/cacheChecker.ts` | 🟢 新增 | 创建新文件 | 无风险 |
| `components/StorageSettingsPanel.tsx` | 🟢 较小 | 添加说明文字 | 无风险 |
| `services/storage/` | 🟢 不变 | 无需修改 | 无影响 |
| `components/Node.tsx` | 🟢 较小 | 添加缓存指示器 | 可选 |
| 其他节点服务 | 🟢 不变 | 无需修改 | 无影响 |

#### 兼容性保证

```typescript
// 向后兼容策略

// 1. 保留所有现有字段
interface NodeData {
    images?: string[];      // 保留
    videoUrl?: string;      // 保留
    audioUri?: string;      // 保留

    // 新增字段（可选）
    isCached?: boolean;
    cacheLocation?: string;
    cacheInfo?: CacheInfo;
}

// 2. 渐进式增强
if (node.data.isCached) {
    // 使用缓存
} else {
    // 原有逻辑
}

// 3. 降级处理
try {
    const cached = await checkCache(nodeId);
    if (cached) {
        return cached;
    }
} catch (error) {
    console.warn('缓存加载失败，使用原有方式');
    // 降级到 API 调用
}
```

---

## 五、实施时间表

### 第 1 周：核心功能（阶段 1）

**目标：** 实现缓存检查，立即可用

| 任务 | 时间 | 负责人 | 验收标准 |
|-----|------|--------|---------|
| 创建 cacheChecker.ts | 2小时 | | 文件检查功能正常 |
| 修改 App.tsx 添加缓存逻辑 | 3小时 | | 图片/视频/音频缓存命中 |
| 测试缓存功能 | 2小时 | | 刷新页面后加载缓存 |
| 修复 Bug | 3小时 | | 无明显 bug |

**预计收益：**
- ✅ 减少 API 调用 50%+
- ✅ 用户体验显著提升

### 第 2 周：体验优化（阶段 2）

**目标：** 改进授权流程和用户提示

| 任务 | 时间 | 验收标准 |
|-----|------|---------|
| 改进重连提示 | 2小时 | 提示清晰友好 |
| 添加设置面板说明 | 1小时 | 用户理解存储机制 |
| 添加缓存指示器 | 2小时 | UI 显示缓存状态 |
| 测试和优化 | 3小时 | 流程顺畅 |

### 第 3 周+：高级优化（阶段 3-4）

**目标：** 数据迁移和深度优化（可选）

- 根据实际使用情况决定是否实施
- 需要用户反馈后评估价值

---

## 六、测试计划

### 6.1 功能测试

#### 测试用例 1：图片缓存检查

```
步骤：
1. 创建图片生成节点，生成图片
2. 确认图片保存到文件系统
3. 刷新页面
4. 再次点击生成

预期：
- 控制台显示 "使用缓存的图片"
- 图片立即显示（<1秒）
- 没有 API 调用
```

#### 测试用例 2：视频缓存检查

```
步骤：
1. 创建视频生成节点，生成视频
2. 刷新页面
3. 再次点击生成

预期：
- 控制台显示 "使用缓存的视频"
- 视频立即加载播放
```

#### 测试用例 3：缓存失效处理

```
步骤：
1. 生成图片
2. 在文件管理器中删除图片文件
3. 刷新页面
4. 再次点击生成

预期：
- 检测到文件不存在
- 自动调用 API 重新生成
- 控制台显示错误日志
```

### 6.2 性能测试

```
测试场景：
- 100 个节点，每个包含 5MB 图片数据
- 对比优化前后的加载时间和内存占用

预期结果：
| 指标 | 优化前 | 优化后 |
|-----|--------|--------|
| 首次加载 | 30秒 | 30秒 |
| 刷新后加载 | 30秒 | 2秒 |
| 内存占用 | 500MB+ | 100MB |
| API 调用 | 100次 | 0次 |
```

### 6.3 兼容性测试

```
测试浏览器：
- ✅ Chrome 90+
- ✅ Edge 90+
- ❌ Firefox（显示友好提示）
- ❌ Safari（显示友好提示）

测试操作系统：
- ✅ macOS 11+
- ✅ Windows 10+
- ✅ Linux（Chrome）
```

---

## 七、关键注意事项

### ⚠️ 必须注意的问题

#### 1. 不要破坏现有功能

**错误示例：**
```typescript
// ❌ 不要直接覆盖现有逻辑
if (cached) {
    return cached;
}
// 原有逻辑被跳过，可能导致问题
```

**正确示例：**
```typescript
// ✅ 添加缓存检查，保留原有逻辑
try {
    const cached = await checkCache(nodeId);
    if (cached && cached.length > 0) {
        console.log('使用缓存');
        return cached;
    }
} catch (error) {
    console.warn('缓存检查失败，继续 API 调用');
}

// 原有逻辑保持不变
const result = await callAPI(...);
```

#### 2. 处理文件系统错误

**错误示例：**
```typescript
// ❌ 未处理错误
const cached = await checkCache(nodeId);
if (cached) {
    return cached;  // 可能返回损坏的数据
}
```

**正确示例：**
```typescript
// ✅ 完整的错误处理
try {
    const cached = await checkCache(nodeId);

    if (cached) {
        // 验证数据完整性
        const isValid = await validateData(cached);
        if (!isValid) {
            console.warn('缓存数据损坏，重新生成');
            throw new Error('Invalid cache');
        }

        return cached;
    }
} catch (error) {
    console.error('缓存加载失败:', error);
    // 降级到 API 调用
}
```

#### 3. 保留降级方案

```typescript
// ✅ 始终提供降级方案
async function loadNodeData(nodeId: string) {
    // 优先尝试：文件系统缓存
    try {
        const cached = await checkCache(nodeId);
        if (cached) {
            return { data: cached, source: 'cache' };
        }
    } catch (error) {
        console.warn('缓存加载失败');
    }

    // 降级方案 1：节点数据中的 Base64
    const node = getNodeFromStore(nodeId);
    if (node.data.images && node.data.images.length > 0) {
        console.log('从节点数据加载（向后兼容）');
        return { data: node.data.images, source: 'node-data' };
    }

    // 降级方案 2：调用 API
    console.log('调用 API 生成');
    const result = await callAPI(...);
    return { data: result, source: 'api' };
}
```

#### 4. 避免阻塞主线程

```typescript
// ❌ 大文件操作可能阻塞
const largeImages = await loadAllImages();  // 可能 5-10 秒

// ✅ 分批加载，显示进度
async function loadImagesWithProgress(nodeId: string) {
    const files = await getFileList(nodeId);

    const results = [];
    for (let i = 0; i < files.length; i++) {
        // 显示进度
        updateProgress(i + 1, files.length);

        // 加载单个文件
        const data = await loadFile(files[i]);
        results.push(data);

        // 让出主线程
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    return results;
}
```

#### 5. 用户数据安全

```typescript
// ❌ 不要自动删除文件
if (node.data.assets) {
    await deleteAllFiles();  // 危险！
}

// ✅ 让用户确认
const shouldDelete = await confirm(
    `是否删除节点的 ${fileCount} 个文件？\n` +
    `此操作不可恢复。`
);

if (shouldDelete) {
    await deleteAllFiles();
}
```

---

## 八、成功标准

### 技术指标

- ✅ 缓存命中率 > 70%（频繁使用的节点）
- ✅ 缓存加载时间 < 1 秒
- ✅ API 调用减少 > 50%
- ✅ 不破坏现有功能
- ✅ 向后兼容 100%

### 用户体验指标

- ✅ 用户感知的加载速度提升 > 10 倍
- ✅ 刷新页面后数据不丢失
- ✅ 错误处理友好，有清晰的提示
- ✅ 可以随时禁用本地存储

### 稳定性指标

- ✅ 无数据丢失 bug
- ✅ 缓存失效时正确降级
- ✅ 跨浏览器兼容性处理正确
- ✅ 文件系统错误不影响核心功能

---

## 九、总结

### 核心优势

1. **渐进式实施**
   - 不创建新架构
   - 基于现有 FileStorageService
   - 向后兼容，可随时禁用

2. **风险可控**
   - 每个阶段独立测试
   - 保留降级方案
   - 不破坏现有功能

3. **立即见效**
   - 阶段 1 完成后即可使用
   - 性能提升显著（10-100倍）
   - 减少 API 成本

### 与桌面应用方案的对比

| 对比项 | Web 优化 | Tauri 桌面应用 |
|--------|---------|---------------|
| 实施难度 | 🟢 低（1周） | 🔴 高（2-3周） |
| 风险 | 🟢 低 | 🟡 中 |
| 兼容性 | 🟢 所有浏览器 | 🔴 仅桌面系统 |
| 分发 | ✅ 即时更新 | ❌ 需下载安装 |
| 协作 | ✅ 易于实现 | ❌ 难以实现 |
| 性能 | 🟡 受浏览器限制 | ✅ 原生性能 |
| 维护成本 | 🟢 低 | 🔴 高 |

### 建议

**优先实施 Web 优化方案：**
- 风险低，收益高
- 1-2 周即可完成
- 立即改善用户体验

**保留桌面应用作为未来选项：**
- Web 方案验证成功后
- 有明确的商业化需求
- 用户反馈支持桌面版本

---

**文档版本：** v1.0
**创建时间：** 2025-01-26
**预计实施周期：** 1-2 周
