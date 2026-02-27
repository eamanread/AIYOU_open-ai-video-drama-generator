# 发现与摘要

> 子Agent分析结果汇总于此

## 现有代码结构扫描

### 技术栈
React 19 + TS 5.8 + Vite 6 + Zustand 5 + Tailwind 4 + Tauri 2 + @google/genai

### 改造影响评估
| 改造项 | 现状 | 改造难度 |
|--------|------|----------|
| Connection 升级 | `{id?, from, to}` 极简 | 中 — 需改 types + editor.store + ConnectionLayer |
| Project 层 | 不存在 | 中 — 新增 project.store + 改 app.store 的 workflows 挂载 |
| BaseNodeService | 有基类，缺 schema/retry/pause | 低 — 扩展即可 |
| 画布多端口 | 自研画布，无第三方库 | 高 — 需改 CanvasBoard + ConnectionLayer + Node 组件 |
| PipelineEngine | 无，现有 executeNodesInOrder | 高 — 全新状态机 |
| 节点迁移 | 6个已有service，10个在handlers | 中 — 批量但模式化 |

### 关键文件路径
- 类型定义: `types.ts`（根目录）
- Store: `stores/app.store.ts`, `stores/editor.store.ts`, `stores/ui.store.ts`
- 节点基类: `services/nodes/baseNode.service.ts`
- 节点注册: `services/nodes/index.ts`, `services/nodes/registry.ts`
- 画布: `components/CanvasBoard.tsx`, `components/ConnectionLayer.tsx`, `components/Node.tsx`
- 已有6个service: promptInput, imageGenerator, videoGenerator, audioGenerator, storyboardSplitter, storyboardVideoGenerator

## architecture-plan.md 摘要

### 核心架构变更（8项）
1. 组织层级：Workflow → **Project → Workflow → Node**，新增 Project 层
2. 连接模型：Connection 新增 fromPort/toPort 端口概念 + schema 兼容性检查
3. 执行引擎：executeNodesInOrder → **PipelineEngine 状态机**（暂停/恢复/跳过/重试/人工卡点）
4. 提示词系统：硬编码 → **PromptTemplate 可更换模板**（`{{variable}}` 占位）
5. 画风体系：STYLE_PRESET 升级为简单模式 + 四段式模式可切换
6. 容错机制：节点级重试（3次指数退避）+ 工作流级跳过继续
7. 资产类型：角色 → 角色 + 场景 + 道具，项目级共享资产池
8. 输出端：AIYOU 内生成 → 通用平台提交 Provider 模式

### 新增节点（5个）
- SCRIPT_PARSER — 剧本解析，输出 structured-script JSON
- SCENE_ASSET — 六格场景参考图生成
- PROP_ASSET — 道具三视图生成
- VIDEO_PROMPT_GENERATOR — 分镜→视频指令翻译 + Q1-Q8 质检
- PLATFORM_SUBMIT — 通用平台对接（即梦/可灵/Sora）

### 升级节点（2个）
- STYLE_PRESET — 双模式 + 多模板
- BaseNodeService — inputSchema/outputSchema 自声明 + 内置重试

### 待迁移节点（10个）
DRAMA_ANALYZER、DRAMA_REFINED、SCRIPT_PLANNER、SCRIPT_EPISODE、CHARACTER_NODE、STORYBOARD_GENERATOR、STORYBOARD_IMAGE、IMAGE_EDITOR、VIDEO_ANALYZER、STYLE_PRESET

### 新增数据结构（14个 interface）
Project, AssetLibrary, PortSchema, PromptTemplate, TemplateVariable, StyleConfig, RetryConfig, PipelineState, PipelineStatus, NodeRunStatus, FixedWorkflow, FixedNodeSnapshot, PlatformProvider, Connection(升级)

### 实施阶段
- Phase 1（2周）：地基 — types.ts + BaseNodeService + PipelineEngine + project.store
- Phase 2（3周）：新节点 + 迁移 — 三线并行
- Phase 3（2周）：工作流串联 + 平台对接
- Phase 4（1周）：打磨 + 扩展
- 总计约 57 人日

## implementation-playbook.md 摘要

### 实施前准备
- 方案评审会（半天）：架构师/前端/节点开发/Prompt工程师四角色审查
- 技术 Spike（2-3天）：S1 IndexedDB存储、S2 画布多端口、S3 即梦桥接、S4 同层并行
- 风险登记表：6项已识别风险（R1-R6）

### 需补充文档（5份）
- P0: data-contracts.md（节点间数据 JSON Schema）— 开工前必须有
- P0: prompt-templates.md（提示词模板手册）— Phase 2 前必须有
- P1: migration-checklist.md（10节点迁移清单）— Phase 2 启动时
- P1: test-cases.md（四层测试用例）— 与开发同步
- P2: CHANGELOG.md — 持续维护

### Phase 1 任务拆分（2周）
- Sprint 1: T1.1 types.ts重构 → T1.2 BaseNodeService升级 → T1.3 连线兼容性检查
- Sprint 2: T1.4 PipelineEngine核心 → T1.5 PromptTemplate系统 → T1.6 project.store.ts

### Phase 2 任务拆分（3周，三线并行）
- 线路A: SCRIPT_PARSER + VIDEO_PROMPT_GENERATOR
- 线路B: SCENE_ASSET + PROP_ASSET + STYLE_PRESET升级
- 线路C: 10个节点迁移（14.5人天）

### 依赖关系
T1.1 → T1.2 → T1.4（串行）；T1.1 → T1.3, T1.6（并行）；T1.5 无强依赖
Phase 1 全部合入 → Phase 2 才能开工；Phase 2 三线互不依赖

### 验收标准
- 代码四道关卡：本地测试 → PR提交 → CI自动化 → 人工Review
- Phase端到端验收：P1现有节点跑通 → P2节点独立执行 → P3全链路 → P4压测恢复
- Prompt质量：5组测试数据，人工评分 ≥ 3.5/5 才能入库

## 2026-02-27 测试重写与代码审查发现

### 测试层发现
- `utils/nodeHelpers.test.ts` 存在旧断言（历史高度逻辑），已与现实现对齐（`DEFAULT_FIXED_HEIGHT=360`，`STORYBOARD_GENERATOR=500`，`CHARACTER_NODE=600`）。
- 新增/升级节点后，`utils/nodeValidation.test.ts` 原覆盖不足，缺少 `SCRIPT_PARSER` 执行前校验和未知类型防御场景。

### 代码层发现（根因）
- `canExecuteNode()` 未覆盖 `SCRIPT_PARSER` 的最小可执行条件，导致“无输入且无 prompt”可通过预检，但运行时失败。
- `validateConnection()` / `canExecuteNode()` 对未知节点类型缺少防御，存在运行时 `TypeError` 风险（读取 `undefined.allowedOutputs/minInputs`）。

### 已落地修复
- 在 `utils/nodeValidation.ts` 增加未知类型保护分支，返回结构化校验错误而非抛异常。
- 为 `SCRIPT_PARSER` 增加执行前校验：必须具备 `prompt` 或至少一个上游输入。
- 在 `utils/nodeValidation.test.ts` 新增 4 个回归用例覆盖上述行为。

### 验证结果
- `npx vitest run utils/nodeValidation.test.ts`：25/25 通过。
- `npm test`：5 个测试文件、79 个测试全部通过。

## 2026-02-27 新技能构建发现（aiyou-workflow-builder）

- 采用 `skill-creator` 初始化流程时，`short_description` 需满足 25-64 字符，否则 `agents/openai.yaml` 生成失败。
- 将技能放置在项目路径 `AIYOU_open-ai-video-drama-generator/.agents/skills` 可避免外层目录写权限限制。
- 新增节点审计脚本可显著降低“选定工作流后才发现节点不齐”的返工概率。
- 技能已具备完整闭环：需求锁定 → 三方案选择 → 节点缺口方案选择 → 构建 → 自动验证与代码审查 → 询问是否合并上线。

## v0.3.0 代码审计 (2026-02-27)

### 风险矩阵

| 风险 | Agent | 任务 | 原因 |
|------|-------|------|------|
| 🔴高 | B1 | CanvasBoard | 1行空壳，从零构建完整画布 |
| 🔴高 | B7 | 存储层迁移 | LocalStorage→IndexedDB，影响全局数据流 |
| 🟡中 | B2 | FFmpeg拼接 | UI已有，WASM在Tauri中兼容性未验证 |
| 🟡中 | B10 | CI+E2E | Playwright未安装，需从零搭建 |
| 🟢低 | B3 | Sentry | 4处取消注释 + devDeps→deps |
| 🟢低 | B4 | Kling | 3个mock→REST API |
| 🟢低 | B5 | ImageEditor | mock→real |
| 🟢低 | B6 | VideoAnalyzer | mock→real |
| ⚪无 | B8 | 新手引导 | 组件已完整(86+158行) |
| ⚪无 | B9 | 执行日志 | apiLogger已完整(437行) |

### 关键发现

1. B8/B9 实际已完成，无需开发
2. B3 只需4处取消注释 + 移动依赖位置
3. B1 是唯一从零构建项，ConnectionLayer(259行)+portLayout(129行)可复用
4. B7 三层存储骨架已就绪(IndexedDB 572行/FileStorage 514行/Metadata 376行)，只需接入store
5. Playwright 完全缺失，package.json 无此依赖
6. @sentry/react 在 devDependencies，生产环境不会打包
