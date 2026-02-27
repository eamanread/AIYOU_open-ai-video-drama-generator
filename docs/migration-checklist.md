# Mock → Real 迁移检查清单

> 蜂巢映画 v0.2.0 节点服务迁移标准化流程
> 每个节点按此清单逐项完成，确保零遗漏

## 通用迁移步骤（9步）

每个 mock 节点服务迁移时，按以下顺序执行：

| # | 步骤 | 验证方式 |
|---|------|----------|
| 1 | 确认 `geminiService.ts` 中对应函数签名 | 函数存在 + 参数类型匹配 |
| 2 | 添加 import 语句 | TypeScript 编译通过 |
| 3 | 替换 mock 方法体为真实 API 调用 | 删除 console.log mock |
| 4 | 添加错误处理：API 超时 / 格式解析失败 / token 超限 | try-catch + 有意义的错误消息 |
| 5 | 添加 `context` 参数透传（nodeId + nodeType） | API 日志可追踪到节点 |
| 6 | 处理返回值类型转换（API 返回 → 端口输出格式） | 符合 data-contracts.md |
| 7 | 单元测试：mock API 层，验证 service 层逻辑 | `pnpm test` 对应用例通过 |
| 8 | 集成冒烟：真实 API 调用验证端到端 | 手动验证一次 |
| 9 | 更新 CHANGELOG.md | 记录变更 |

---

## A1. ScriptParser（Agent A1）

**文件**: `services/nodes/scriptParser.service.ts`
**Mock 位置**: L75 `callLLM()` 方法
**目标函数**: `llmProviderManager.generateContent()`

- [ ] 1. 确认 `llmProviderManager` 的 `generateContent()` 签名
- [ ] 2. `import { llmProviderManager } from '../llmProviders';`
- [ ] 3. 替换 `callLLM()` 方法体：`PARSE_SYSTEM_PROMPT`(L17) 作为 system，`script` 作为 user
- [ ] 4. 错误处理：JSON 解析失败时返回原始 LLM 文本片段辅助调试
- [ ] 5. 透传 `{ nodeId: node.id, nodeType: 'SCRIPT_PARSER' }` 到 API 调用
- [ ] 6. 返回值已是 JSON string → `extractJSON()` 已实现(L102)，无需额外转换
- [ ] 7. 单元测试：mock `llmProviderManager`，验证 JSON 校验逻辑
- [ ] 8. 集成冒烟：粘贴真实剧本，验证输出符合 `structured-script` 契约
- [ ] 9. CHANGELOG: "ScriptParser 接入 LLM，替换 mock 数据"

**注意**: 管线入口节点，接入模式成为其余 mock 的参考模板。

---

## A2. ScriptPlanner + ScriptEpisode（Agent A2）

**文件**: `services/nodes/scriptPlanner.service.ts` + `scriptEpisode.service.ts`

### ScriptPlanner
**Mock 位置**: L64 `callLLM()`
**目标函数**: `generateScriptPlanner()` (geminiService.ts L1169)

- [ ] 1. 确认签名：`generateScriptPlanner(prompt, config, refinedInfo?, model?, context?)`
- [ ] 2. `import { generateScriptPlanner } from '../geminiService';`
- [ ] 3. 替换 `callLLM()` → 调用 `generateScriptPlanner()`，传入 `config.scriptTheme/genre/setting` 等
- [ ] 4. 错误处理：LLM 返回空文本 / 超时
- [ ] 5. 透传 context `{ nodeId, nodeType: 'SCRIPT_PLANNER' }`
- [ ] 6. 返回值为纯文本大纲，直接作为 `outline` 端口输出
- [ ] 7-9. 测试 + 冒烟 + CHANGELOG

### ScriptEpisode
**Mock 位置**: L90 `callLLM()`
**目标函数**: `generateScriptEpisodes()` (geminiService.ts L1260)

- [ ] 1. 确认签名：`generateScriptEpisodes(outline, chapter, splitCount, duration, style?, ...)`
- [ ] 2. `import { generateScriptEpisodes } from '../geminiService';`（L89 已有注释提示）
- [ ] 3. 替换 `callLLM()` → 调用 `generateScriptEpisodes()`
- [ ] 4. 错误处理：返回数组为空 / JSON 解析失败
- [ ] 5. 透传 context
- [ ] 6. 返回 `GeneratedEpisode[]` → JSON.stringify 后作为 `episodes` 端口输出
- [ ] 7-9. 测试 + 冒烟 + CHANGELOG

---

## A3. StoryboardGenerator（Agent A3）

**文件**: `services/nodes/storyboardGenerator.service.ts`
**Mock 位置**: L68 `generateStoryboard()`
**目标函数**: `generateDetailedStoryboard()` (geminiService.ts L1370)

- [ ] 1. 确认签名：`generateDetailedStoryboard(episodeTitle, episodeContent, totalDuration, visualStyle, onShotGenerated?, model?, context?)`
- [ ] 2. `import { generateDetailedStoryboard } from '../geminiService';`（L65 已有注释）
- [ ] 3. 替换 `generateStoryboard()` → 调用 `generateDetailedStoryboard()`
- [ ] 4. 错误处理：返回 shots 数组为空 / 时长总和超出容差
- [ ] 5. 透传 context `{ nodeId, nodeType: 'STORYBOARD_GENERATOR' }`
- [ ] 6. 返回 `DetailedStoryboardShot[]` → 作为 `storyboard` 端口输出
- [ ] 7-9. 测试 + 冒烟 + CHANGELOG

---

## A4. CharacterNode（Agent A4）

**文件**: `services/nodes/characterNode.service.ts`
**Mock 位置**: L68 `extractCharacters()` + L79 `generateCharacterImages()`
**目标函数**: `extractCharactersFromText()` (L1859) + `generateCharacterProfile()` (L1893) + `generateImageFromText()` (L929)

- [ ] 1. 确认三个函数签名
- [ ] 2. `import { extractCharactersFromText, generateCharacterProfile, generateImageFromText } from '../geminiService';`
- [ ] 3a. 替换 `extractCharacters()` → `extractCharactersFromText(scriptText, model, context)`
- [ ] 3b. 替换 `generateCharacterImages()` → 先 `generateCharacterProfile()` 获取档案，再用 `appearancePrompt` 调用 `generateImageFromText()`
- [ ] 4. 错误处理：角色提取返回空数组 / 生图失败（单角色失败不阻塞其余）
- [ ] 5. 透传 context
- [ ] 6. 返回 `CharacterAsset[]` 含 `expressionSheet` + `threeViewSheet` base64
- [ ] 7-9. 测试 + 冒烟 + CHANGELOG

**注意**: 生图可能耗时较长，需利用 BaseNodeService 的 `waitIfPaused()` 支持暂停。

---

## A5. DramaAnalyzer（Agent A5）

**文件**: `services/nodes/dramaAnalyzer.service.ts`
**Mock 位置**: L77 `extractAnalysis()`
**目标函数**: `analyzeDrama()` (L2028) + `extractRefinedTags()` (L2186)

- [ ] 1. 确认签名：`analyzeDrama(dramaName, model?, context?)` → `DramaAnalysisResult`
- [ ] 2. `import { analyzeDrama, extractRefinedTags } from '../geminiService';`（L81 已有注释）
- [ ] 3. 替换 `extractAnalysis()` → 调用 `analyzeDrama()` 获取8维度分析
- [ ] 4. 错误处理：未知剧目返回提示信息而非报错
- [ ] 5. 透传 context
- [ ] 6. 返回 `DramaAnalysisResult` JSON → 作为 `analysis` 端口输出
- [ ] 7-9. 测试 + 冒烟 + CHANGELOG

---

## A6. 图片三合一：StoryboardImage + SceneAsset + PropAsset（Agent A6）

### StoryboardImage
**文件**: `services/nodes/storyboardImage.service.ts`
**Mock 位置**: L73 `generateShotImage()`
**目标函数**: `generateImageFromText()` (L929)

- [ ] 1. 确认签名：`generateImageFromText(prompt, model, inputImages?, options?, context?)`
- [ ] 2. `import { generateImageFromText } from '../geminiService';`
- [ ] 3. 替换 `generateShotImage()` → 拼接 shot 描述 + styleSuffix，调用 `generateImageFromText()`
- [ ] 4. 错误处理：单张生图失败不阻塞其余 shots
- [ ] 5-6. 透传 context + 返回 base64 图片数组
- [ ] 7-9. 测试 + 冒烟 + CHANGELOG

### SceneAsset
**文件**: `services/nodes/sceneAsset.service.ts`
**Mock 位置**: L112 `generateReferenceGrid()`
**目标函数**: `generateImageFromText()` (L929)

- [ ] 1. 确认签名（同上）
- [ ] 2. `import { generateImageFromText } from '../geminiService';`
- [ ] 3. 替换 `generateReferenceGrid()` → 用 `buildScenePrompt()` 已有的 prompt + 调用 `generateImageFromText()`
- [ ] 4. 错误处理：单场景生图失败标记 status='ERROR'，不阻塞其余
- [ ] 5-6. 透传 context + 返回 base64 → `asset.referenceGrid`
- [ ] 7-9. 测试 + 冒烟 + CHANGELOG

### PropAsset
**文件**: `services/nodes/propAsset.service.ts`
**Mock 位置**: L125 `generateThreeViewSheet()`
**目标函数**: `generateImageFromText()` (L929)

- [ ] 1. 确认签名（同上）
- [ ] 2. `import { generateImageFromText } from '../geminiService';`
- [ ] 3. 替换 `generateThreeViewSheet()` → 用 `buildPropPrompt()` 已有的 prompt + 调用 `generateImageFromText()`
- [ ] 4. 错误处理：单道具生图失败标记 status='ERROR'
- [ ] 5-6. 透传 context + 返回 base64 → `asset.threeViewSheet`
- [ ] 7-9. 测试 + 冒烟 + CHANGELOG

---

## A7. JimengProvider（Agent A7）

**文件**: `services/providers/jimeng.provider.ts`
**Mock 位置**: 全文（`checkAvailability` / `submit` / `getStatus` 三个方法均为 mock）
**目标**: `window.postMessage` 桥接 → `storyboard-edge-extension/content/jimeng-inject.js`

- [ ] 1. 确认 `PlatformProvider` 接口签名（types.ts）
- [ ] 2. 确认 `jimeng-inject.js` 的 `postMessage` 协议格式（action / payload / response）
- [ ] 3. 重写 `checkAvailability()`：发送 `{ action: 'PING' }` → 等待 `{ action: 'PONG' }` 响应
- [ ] 4. 重写 `submit()`：发送 `{ action: 'SUBMIT_VIDEO', payload: { prompt, imageUrl, duration } }` → 返回 taskId
- [ ] 5. 重写 `getStatus()`：发送 `{ action: 'QUERY_STATUS', payload: { taskId } }` → 返回 status + videoUrl
- [ ] 6. 错误处理：扩展未安装 / 页面未打开 / 超时无响应（30s timeout）
- [ ] 7. 添加 `MessageChannel` 双向通信，避免全局 message 冲突
- [ ] 8. 单元测试：mock `window.postMessage`，验证协议格式
- [ ] 9. 集成冒烟：安装扩展 → 打开即梦页面 → 提交一次真实任务
- [ ] 10. CHANGELOG: "即梦Provider接入postMessage桥接"

**注意**: 需配合 `storyboard-edge-extension` 的 content script 同步更新协议。

---

## A8. 用户工作流模板持久化（Agent A8）

**文件**: `services/workflowTemplates.ts` + `services/storage/IndexedDBService.ts`
**Mock 位置**: L215 `userTemplates` 内存数组
**目标**: IndexedDB 持久化，复用 `WorkflowMetadataRecord` 接口

- [ ] 1. 确认 `WorkflowMetadataRecord` 接口字段（IndexedDBService.ts）
- [ ] 2. 确认 `IndexedDBService` 的 CRUD 方法签名
- [ ] 3. 替换 `userTemplates` 内存数组 → `IndexedDBService.getWorkflows()` / `saveWorkflow()` / `deleteWorkflow()`
- [ ] 4. `saveUserTemplate()` → 序列化 `FixedWorkflow` 为 `WorkflowMetadataRecord` 写入 IndexedDB
- [ ] 5. `loadUserTemplates()` → 启动时从 IndexedDB 读取，填充内存缓存
- [ ] 6. `deleteUserTemplate()` → 同步删除 IndexedDB + 内存缓存
- [ ] 7. 错误处理：IndexedDB 不可用时 fallback 到内存（降级不崩溃）
- [ ] 8. 单元测试：mock IndexedDB，验证 CRUD 逻辑
- [ ] 9. 集成冒烟：创建模板 → 刷新页面 → 模板仍存在
- [ ] 10. CHANGELOG: "用户自建模板持久化到 IndexedDB"

---

## A9. Pipeline 端到端集成测试（Agent A9）

**文件**: `tests/pipeline-e2e.test.ts`（新建）
**前置**: A1-A6 全部完成
**目标**: 验证 Template C 最短路径数据流完整性

- [ ] 1. 新建 `tests/pipeline-e2e.test.ts`
- [ ] 2. mock API 层（`geminiService` 全部函数），不 mock 服务层
- [ ] 3. 测试用例 1：Template C 最短路径 `PROMPT→PARSER→STORYBOARD→VIDEO_PROMPT→SUBMIT`
- [ ] 4. 测试用例 2：Template A 完整路径含分支（SCENE_ASSET + PROP_ASSET 并行）
- [ ] 5. 测试用例 3：单节点失败 → 下游节点不执行 → 错误冒泡到 PipelineEngine
- [ ] 6. 测试用例 4：暂停/恢复 → 节点状态正确切换
- [ ] 7. 验证每个节点输出格式符合 `data-contracts.md` 契约
- [ ] 8. 验证连线类型兼容性（structured-script → storyboard-shots 等）
- [ ] 9. `pnpm test` 全绿（含新增 E2E 用例）
- [ ] 10. CHANGELOG: "新增 Pipeline E2E 集成测试"

---

## A10. 管线执行进度 UI + 错误气泡（Agent A10）

**文件**: `components/nodes/index.tsx` + `stores/app.store.ts`
**目标**: 节点卡片实时显示执行状态，失败节点弹出错误气泡

- [ ] 1. 确认 `NodeStatus` enum 定义（types.ts）：IDLE / RUNNING / SUCCESS / ERROR / PAUSED
- [ ] 2. `app.store.ts` 新增 `nodeStatusMap: Record<string, NodeStatus>` 状态字段
- [ ] 3. `PipelineEngine` 执行回调 → 更新 `nodeStatusMap`（onNodeStart / onNodeComplete / onNodeError）
- [ ] 4. 节点卡片组件读取 `nodeStatusMap[nodeId]`，渲染状态徽标（spinner / ✓ / ✗）
- [ ] 5. RUNNING 状态：节点边框脉冲动画 + 左上角 spinner
- [ ] 6. ERROR 状态：红色边框 + 错误气泡 tooltip（显示 `error.message` 前100字）
- [ ] 7. SUCCESS 状态：绿色对勾 + 2秒后淡出
- [ ] 8. 整体进度条：`completedNodes / totalNodes` 百分比，显示在画布顶部
- [ ] 9. 单元测试：验证状态切换逻辑
- [ ] 10. CHANGELOG: "管线执行进度UI + 错误气泡"

---

> 文档版本：v0.2.0-draft | 创建日期：2026-02-27 | 依赖：data-contracts.md, prompt-templates.md, architecture-plan.md
