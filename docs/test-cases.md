# 测试用例集

> 蜂巢映画 v0.2.0 测试矩阵
> 框架：Vitest 4 | 断言：vitest expect | Mock：vi.fn / vi.mock

## 目录

1. [单元测试：节点服务层](#1-单元测试节点服务层)
2. [单元测试：Provider 层](#2-单元测试provider-层)
3. [单元测试：工具函数](#3-单元测试工具函数)
4. [集成测试：Pipeline E2E](#4-集成测试pipeline-e2e)
5. [冒烟测试：真实 API](#5-冒烟测试真实-api)
6. [回归测试：现有用例基线](#6-回归测试现有用例基线)
7. [测试约定](#7-测试约定)

---

## 1. 单元测试：节点服务层

> 策略：mock `geminiService` / `llmProviderManager` 的 API 层，验证 service 层的数据转换、错误处理、端口输出格式。

### 1.1 ScriptParser（A1）

**文件**: `tests/nodes/scriptParser.test.ts`（新建）

| # | 用例名 | 输入 | Mock 返回 | 期望输出 | 验证点 |
|---|--------|------|-----------|----------|--------|
| 1 | 标准剧本解析成功 | 含场景/对白的剧本文本 | 合法 JSON string | `structured-script` 对象 | 字段完整：title/genre/episodes/characters |
| 2 | LLM 返回非 JSON | 剧本文本 | `"这是一段分析..."` | 错误结果 | `extractJSON()` 失败 → error message 含原始文本片段 |
| 3 | LLM 返回空字符串 | 剧本文本 | `""` | 错误结果 | error message 明确提示"LLM返回为空" |
| 4 | 输入为空 | `null` | 不调用 | 错误结果 | 不触发 API 调用，直接返回输入校验错误 |
| 5 | JSON 缺少必填字段 | 剧本文本 | `{"title":"test"}` | 降级处理 | 缺失字段填 null，不崩溃 |
| 6 | context 透传 | 剧本文本 | 合法 JSON | 成功 | API 调用参数含 `nodeId` + `nodeType: 'SCRIPT_PARSER'` |

### 1.2 ScriptPlanner（A2）

**文件**: `tests/nodes/scriptPlanner.test.ts`（新建）

| # | 用例名 | 输入 | Mock 返回 | 期望输出 | 验证点 |
|---|--------|------|-----------|----------|--------|
| 1 | 大纲生成成功 | config 含 theme/genre/setting | 纯文本大纲 | `outline` 端口输出 | 非空文本，含章节结构 |
| 2 | refinedInfo 透传 | config + refined 端口数据 | 纯文本 | 成功 | API 调用参数含 refinedInfo |
| 3 | LLM 超时 | config | reject(timeout) | 错误结果 | error message 含"超时" |
| 4 | LLM 返回空文本 | config | `""` | 错误结果 | 明确提示"大纲生成为空" |

### 1.3 ScriptEpisode（A2）

**文件**: `tests/nodes/scriptEpisode.test.ts`（新建）

| # | 用例名 | 输入 | Mock 返回 | 期望输出 | 验证点 |
|---|--------|------|-----------|----------|--------|
| 1 | 分集生成成功 | outline + splitCount=3 | 3元素 JSON 数组 | `episodes` 端口输出 | 数组长度 = splitCount |
| 2 | JSON 解析失败 | outline | 非 JSON 文本 | 错误结果 | error 含原始文本片段 |
| 3 | 返回空数组 | outline | `[]` | 错误结果 | 明确提示"未生成任何分集" |
| 4 | 前序集透传 | outline + previousEpisodes | JSON 数组 | 成功 | API 参数含 previousEpisodes |

### 1.4 StoryboardGenerator（A3）

**文件**: `tests/nodes/storyboardGenerator.test.ts`（新建）

| # | 用例名 | 输入 | Mock 返回 | 期望输出 | 验证点 |
|---|--------|------|-----------|----------|--------|
| 1 | 分镜生成成功 | episodeTitle + content + 60s | 20个 shot 的 JSON 数组 | `storyboard` 端口输出 | shots 时长总和 ≈ 60s（±5%） |
| 2 | shots 为空数组 | episode 数据 | `[]` | 错误结果 | 明确提示"未生成任何镜头" |
| 3 | 时长超出容差 | episode 数据 | shots 总和 = 80s（目标60s） | 警告但不失败 | 结果含 warning 字段 |
| 4 | context 透传 | episode 数据 | shots 数组 | 成功 | API 参数含 `nodeType: 'STORYBOARD_GENERATOR'` |

### 1.5 CharacterNode（A4）

**文件**: `tests/nodes/characterNode.test.ts`（新建）

| # | 用例名 | 输入 | Mock 返回 | 期望输出 | 验证点 |
|---|--------|------|-----------|----------|--------|
| 1 | 角色提取成功 | 剧本文本 | `["张三","李四"]` | 2个角色名 | 数组长度 = 2 |
| 2 | 角色档案生成 | 角色名 + 剧本 | CharacterProfile JSON | 含 appearancePrompt | appearancePrompt 为英文 |
| 3 | 角色生图成功 | appearancePrompt | base64 string | CharacterAsset 含图片 | base64 非空 |
| 4 | 单角色生图失败不阻塞 | 2个角色 | 第1个成功，第2个 reject | 1成功+1错误 | 总结果仍为 success，失败角色标记 ERROR |
| 5 | 提取返回空数组 | 剧本文本 | `[]` | 错误结果 | 明确提示"未找到角色" |

### 1.6 DramaAnalyzer（A5）

**文件**: `tests/nodes/dramaAnalyzer.test.ts`（新建）

| # | 用例名 | 输入 | Mock 返回 | 期望输出 | 验证点 |
|---|--------|------|-----------|----------|--------|
| 1 | 8维度分析成功 | 剧目名称 | DramaAnalysisResult JSON | `analysis` 端口输出 | 8个维度字段均非空 |
| 2 | 未知剧目 | "不存在的剧" | 含"未知"提示的 JSON | 降级结果 | 不报错，返回提示信息 |
| 3 | refinedTags 提取 | 分析结果 | 标签数组 | refined 端口输出 | 标签数组非空 |
| 4 | LLM 返回非 JSON | 剧目名称 | 纯文本 | 错误结果 | error 含原始文本片段 |

### 1.7 StoryboardImage（A6）

**文件**: `tests/nodes/storyboardImage.test.ts`（新建）

| # | 用例名 | 输入 | Mock 返回 | 期望输出 | 验证点 |
|---|--------|------|-----------|----------|--------|
| 1 | 批量生图成功 | 5个 shots | 5个 base64 | images 数组 | 长度 = 5，每项非空 |
| 2 | 单张失败不阻塞 | 3个 shots | 第2张 reject | 2成功+1失败 | 总结果 success，失败项标记 |
| 3 | styleSuffix 拼接 | shots + style-config | base64 | 成功 | prompt 含 styleSuffix |
| 4 | 空 shots 输入 | `[]` | 不调用 | 错误结果 | 明确提示"无分镜数据" |

### 1.8 SceneAsset（A6）

**文件**: `tests/nodes/sceneAsset.test.ts`（新建）

| # | 用例名 | 输入 | Mock 返回 | 期望输出 | 验证点 |
|---|--------|------|-----------|----------|--------|
| 1 | 场景去重+生图 | 3集含5个场景（2个重复） | 3个 base64 | 3个 SceneAssetData | `extractUniqueScenes` 去重正确 |
| 2 | 单场景生图失败 | 2个场景 | 第2个 reject | 1成功+1 ERROR | 失败场景 status='ERROR'，不阻塞 |
| 3 | style-config 可选 | 无 style 端口 | base64 | 成功 | prompt 不含 styleSuffix |
| 4 | 无场景数据 | episodes 为空数组 | 不调用 | 错误结果 | 明确提示"未找到场景" |

### 1.9 PropAsset（A6）

**文件**: `tests/nodes/propAsset.test.ts`（新建）

| # | 用例名 | 输入 | Mock 返回 | 期望输出 | 验证点 |
|---|--------|------|-----------|----------|--------|
| 1 | 道具去重+生图 | 场景含 ["剑","盾","剑"] | 2个 base64 | 2个 PropAssetData | `extractUniqueProps` trim+去重 |
| 2 | 道具描述拼接 | 道具名出现在2个场景 | base64 | 成功 | `findPropDescription` 拼接2段描述 |
| 3 | 单道具生图失败 | 2个道具 | 第1个 reject | 1 ERROR+1成功 | 失败道具 status='ERROR' |
| 4 | 无道具数据 | 场景 props 全为空 | 不调用 | 错误结果 | 明确提示"未找到道具" |

---

## 2. 单元测试：Provider 层

### 2.1 JimengProvider（A7）

**文件**: `tests/providers/jimeng.test.ts`（新建）

| # | 用例名 | 操作 | Mock 行为 | 期望 | 验证点 |
|---|--------|------|-----------|------|--------|
| 1 | checkAvailability 成功 | 发送 PING | 收到 PONG | `true` | postMessage 被调用 |
| 2 | checkAvailability 超时 | 发送 PING | 30s 无响应 | `false` | 超时后返回 false，不抛异常 |
| 3 | submit 成功 | 提交视频任务 | 返回 taskId | taskId 字符串 | payload 含 prompt/imageUrl/duration |
| 4 | submit 扩展未安装 | 提交任务 | 无 message 监听 | 错误 | error 含"扩展未安装" |
| 5 | getStatus 成功 | 查询 taskId | 返回 COMPLETED + videoUrl | status + url | videoUrl 非空 |
| 6 | getStatus 任务失败 | 查询 taskId | 返回 FAILED | 错误状态 | error 含失败原因 |

---

## 3. 单元测试：工具函数

> 现有 79 个用例已覆盖 `nodeHelpers` 和 `nodeValidation`，此处仅列 v0.2.0 新增。

### 3.1 extractJSON（ScriptParser 内部）

| # | 用例名 | 输入 | 期望 |
|---|--------|------|------|
| 1 | 纯 JSON | `'{"a":1}'` | 解析成功 |
| 2 | markdown 包裹 | `` ```json\n{"a":1}\n``` `` | 剥离 fence 后解析 |
| 3 | 前后有解释文字 | `"分析如下：\n{\"a\":1}\n以上"` | 提取中间 JSON |
| 4 | 无 JSON | `"纯文本"` | 返回 null |

### 3.2 IndexedDB 模板持久化（A8）

| # | 用例名 | 操作 | 期望 |
|---|--------|------|------|
| 1 | 保存模板 | `saveWorkflow(record)` | IndexedDB 写入成功 |
| 2 | 读取模板列表 | `getWorkflows()` | 返回已保存的记录 |
| 3 | 删除模板 | `deleteWorkflow(id)` | 记录不再存在 |
| 4 | IndexedDB 不可用 | 模拟 `indexedDB = undefined` | fallback 到内存，不崩溃 |

---

## 4. 集成测试：Pipeline E2E

**文件**: `tests/pipeline-e2e.test.ts`（新建）
**策略**: mock `geminiService` 全部导出函数，不 mock 节点服务层，验证数据在节点间的完整流转。

### 4.1 Template C 最短路径

```
PROMPT_INPUT → SCRIPT_PARSER → STORYBOARD_GENERATOR → VIDEO_PROMPT_GENERATOR → PLATFORM_SUBMIT
```

| # | 用例名 | 验证点 |
|---|--------|--------|
| 1 | 全链路成功 | 每个节点 status 依次变为 RUNNING → SUCCESS |
| 2 | SCRIPT_PARSER 输出格式 | 符合 `structured-script` 契约（data-contracts.md） |
| 3 | 数据透传完整性 | STORYBOARD 收到的 input = PARSER 的 output |
| 4 | VIDEO_PROMPT 质检 | Q1-Q8 全部通过 |
| 5 | PLATFORM_SUBMIT 调用 | provider.submit() 被调用，参数含 prompt + imageUrl |

### 4.2 Template A 完整路径（含并行分支）

```
PROMPT → PARSER → SCENE_ASSET ──┐
                → PROP_ASSET  ──┤→ STORYBOARD → STORYBOARD_IMAGE → VIDEO_PROMPT → SUBMIT
                → CHARACTER   ──┘
```

| # | 用例名 | 验证点 |
|---|--------|--------|
| 1 | 并行分支同时执行 | SCENE/PROP/CHARACTER 三个节点并行启动 |
| 2 | 并行结果汇聚 | STORYBOARD 等待三个分支全部完成后才启动 |
| 3 | 单分支失败 | CHARACTER 失败 → STORYBOARD 仍执行（CHARACTER 为可选输入） |

### 4.3 异常场景

| # | 用例名 | 操作 | 期望 |
|---|--------|------|------|
| 1 | 中间节点失败 | PARSER 返回 error | 下游全部不执行，engine 状态 = FAILED |
| 2 | 暂停/恢复 | 执行中调用 pause() | 当前节点完成后暂停，resume() 后继续 |
| 3 | 环检测 | A→B→C→A 连线 | engine.run() 抛出环检测错误 |
| 4 | 未注册节点类型 | 含 UNKNOWN 类型节点 | 跳过该节点，记录警告 |

---

## 5. 冒烟测试：真实 API

> 手动执行，每个 Agent 完成后跑一次。需配置有效的 API Key。
> 标记 `@smoke` 标签，CI 中默认跳过。

| # | 场景 | 操作 | 验收标准 |
|---|------|------|----------|
| 1 | ScriptParser 真实调用 | 粘贴200字剧本片段 | 返回合法 structured-script JSON，≤30s |
| 2 | ScriptPlanner 真实调用 | 输入主题+题材 | 返回含章节结构的大纲文本，≤20s |
| 3 | ScriptEpisode 真实调用 | 输入大纲 + splitCount=2 | 返回2集 JSON 数组 |
| 4 | StoryboardGenerator 真实调用 | 输入一集剧本 | 返回 ≥15 个 shots，时长总和 ±5% |
| 5 | CharacterNode 真实调用 | 输入含3角色的剧本 | 提取3个角色名 + 生成档案 |
| 6 | DramaAnalyzer 真实调用 | 输入"甄嬛传" | 返回8维度分析，每维度非空 |
| 7 | 图片生成真实调用 | 输入场景描述 | 返回 base64 图片，可解码为 PNG/JPEG |
| 8 | 即梦 Provider 真实调用 | 安装扩展 + 打开即梦 | submit 返回 taskId，getStatus 可查询 |

---

## 6. 回归测试：现有用例基线

> v0.1.x 已有 79 个通过用例，v0.2.0 迁移过程中必须保持全绿。

| 文件 | 用例数 | 覆盖范围 |
|------|--------|----------|
| `utils/nodeHelpers.test.ts` | ~25 | 节点尺寸、高度计算、布局辅助 |
| `utils/nodeValidation.test.ts` | ~25 | 连线校验、执行前校验、类型兼容 |
| `tests/pipeline-edge-cases.test.ts` | ~10 | 拓扑排序、空图、断连节点 |
| `tests/failure-recovery.test.ts` | ~8 | 失败恢复、环检测、未注册类型 |
| `tests/workflow-stress.test.ts` | ~11 | 10节点压测、并行执行、深链路 |

**回归规则**：
- 每个 Agent 完成后执行 `pnpm test`，79 个基线用例 + 新增用例全部通过
- 若基线用例因接口变更失败，修复用例使其适配新接口（不删除用例）
- 新增用例不得与基线用例重复覆盖同一逻辑

---

## 7. 测试约定

### 文件组织

```
tests/
├── nodes/                    # 节点服务单元测试（v0.2.0 新增）
│   ├── scriptParser.test.ts
│   ├── scriptPlanner.test.ts
│   ├── scriptEpisode.test.ts
│   ├── storyboardGenerator.test.ts
│   ├── characterNode.test.ts
│   ├── dramaAnalyzer.test.ts
│   ├── storyboardImage.test.ts
│   ├── sceneAsset.test.ts
│   └── propAsset.test.ts
├── providers/                # Provider 单元测试（v0.2.0 新增）
│   └── jimeng.test.ts
├── pipeline-e2e.test.ts      # E2E 集成测试（v0.2.0 新增）
├── pipeline-edge-cases.test.ts   # 已有
├── failure-recovery.test.ts      # 已有
└── workflow-stress.test.ts       # 已有
```

### Mock 模式

```typescript
// 1. mock geminiService（节点单元测试标准写法）
vi.mock('../services/geminiService', () => ({
  generateScriptPlanner: vi.fn(),
  generateDetailedStoryboard: vi.fn(),
  generateImageFromText: vi.fn(),
  // ...按需 mock
}));

// 2. mock llmProviderManager（ScriptParser 专用）
vi.mock('../services/llmProviders', () => ({
  llmProviderManager: {
    generateContent: vi.fn(),
  },
}));

// 3. mock window.postMessage（JimengProvider 专用）
const mockPostMessage = vi.fn();
Object.defineProperty(window, 'postMessage', { value: mockPostMessage });
```

### 命名规范

| 层级 | 格式 | 示例 |
|------|------|------|
| describe | 服务类名 | `describe('ScriptParserService', ...)` |
| 嵌套 describe | 方法名 | `describe('execute', ...)` |
| it | 行为描述（中文） | `it('标准剧本解析成功', ...)` |
| 冒烟用例 | `@smoke` 前缀 | `it('@smoke 真实API调用', ...)` |

### 运行命令

```bash
# 全量测试（CI 必跑）
pnpm test

# 单文件测试
pnpm vitest run tests/nodes/scriptParser.test.ts

# 冒烟测试（需 API Key）
GEMINI_API_KEY=xxx pnpm vitest run --grep "@smoke"

# 覆盖率报告
pnpm vitest run --coverage
```

### 质量门禁

| 指标 | v0.1.x 基线 | v0.2.0 目标 |
|------|-------------|-------------|
| 用例总数 | 79 | ≥ 120 |
| 通过率 | 100% | 100% |
| 节点服务覆盖 | 0/12 mock | 12/12 真实逻辑 |
| Provider 覆盖 | 0/4 | ≥ 1/4（即梦） |

---

> 文档版本：v0.2.0-draft | 创建日期：2026-02-27 | 依赖：data-contracts.md, migration-checklist.md, prompt-templates.md
