# 实施手册 — 从架构方案到代码落地

> 配合 architecture-plan.md 使用，2026-02-27

---

## 一、厉害的团队拿到架构方案后会先做什么

不是直接写代码。是先「拆弹」——找出方案里的模糊地带、风险点、依赖关系。

### 1.1 方案评审会（半天）

团队围着架构方案，每个人带着自己的专业视角挑刺：

**架构师会问：**
- Connection 升级为 fromPort/toPort 后，现有的 6 个已迁移节点怎么兼容？一刀切改还是做适配层？
- PipelineEngine 的状态要不要持久化？用户刷新页面后管线能恢复吗？
- localStorage 存 Project + 共享资产（含 base64 图片），容量够吗？什么时候该切 IndexedDB？

**前端会问：**
- 端口可视化怎么做？现有画布组件支持多端口连线吗？还是要换 React Flow 之类的库？
- 固化工作流的「运行时输入」怎么呈现？弹窗表单？还是在画布上高亮需要填的节点？
- 管线状态面板是浮层还是侧边栏？跟现有 UI 布局冲突吗？

**节点开发会问：**
- SCRIPT_PARSER 的输出格式 structured-script，下游所有节点都要适配。谁来定这个 JSON Schema 的最终版本？
- 资产生成（CHARACTER_NODE / SCENE_ASSET / PROP_ASSET）能并行跑吗？管线引擎的拓扑排序支持同层并行吗？
- 即梦 Provider 的浏览器扩展桥接方案，技术可行性验证了吗？

**Prompt 工程师会问：**
- 四段式画风体系的 prompt 模板，从文档直接搬还是要针对 AIYOU 的模型重新调？
- Q1-Q8 质检是让同一个 LLM 自检，还是用另一个模型交叉检？自检的可靠性有多高？
- 不同模板之间的输出格式差异，下游节点能无缝消费吗？

### 1.2 评审会产出：风险登记表

| # | 风险 | 影响 | 应对策略 | 负责人 |
|---|------|------|----------|--------|
| R1 | localStorage 存大量 base64 图片会爆 5MB 限制 | 项目数据丢失 | Phase 1 就切 IndexedDB，用 Dexie.js 封装 | 架构师 |
| R2 | Connection 升级破坏现有 6 个节点 | 回归 bug | 做适配层：旧格式自动补 `fromPort:'default', toPort:'default'` | 架构师 |
| R3 | 画布组件不支持多端口 | 前端重写量大 | 先调研现有画布能力，不行就引入 React Flow | 前端 |
| R4 | 即梦 DOM 自动化在 Web App 里不可行 | PLATFORM_SUBMIT 节点无法工作 | Phase 1 做技术 Spike，验证 WebSocket 桥接方案 | 节点开发 A |
| R5 | LLM 自检（Q1-Q8）不可靠 | 视频提示词质量不稳定 | 用结构化输出（JSON mode）+ 规则引擎双重校验 | Prompt 工程师 |
| R6 | 拓扑排序不支持同层并行 | 资产生成串行太慢 | PipelineEngine 支持「同层节点并发执行」 | 架构师 |

### 1.3 技术 Spike（评审后立即启动，2-3天）

在正式开发前，先用最小代码验证高风险项：

| Spike | 验证目标 | 产出 |
|-------|----------|------|
| S1: IndexedDB 存储 | base64 图片存取性能、容量上限 | 存储方案确认 + Dexie schema 草案 |
| S2: 画布多端口 | 现有组件能否支持多输入/输出端口渲染 | 可行/不可行结论 + 备选方案 |
| S3: 即梦桥接 | Web App ↔ Chrome Extension 通信可行性 | 通信协议草案 or 降级方案 |
| S4: 同层并行执行 | 拓扑排序后同层节点 Promise.all 执行 | PipelineEngine 并行执行 POC |

Spike 失败不丢人，失败了就调整方案。比写完才发现不行强一百倍。

---

## 二、还需要准备哪些文档

架构方案是「战略地图」，但团队动手还需要「战术手册」。按优先级排：

### 文档 1：数据契约文档（P0，开工前必须有）

定义所有节点间流转的数据格式。这是多人并行开发的基础——没有它，A 写的输出和 B 写的输入对不上。

```
文件：docs/data-contracts.md

内容：
├── structured-script    ← SCRIPT_PARSER 输出，最关键的一个
│   └── 完整 JSON Schema + 示例数据 + 边界情况说明
├── style-config         ← STYLE_PRESET 输出
│   └── simple 模式 schema + fourPart 模式 schema
├── char-assets          ← CHARACTER_NODE 输出
├── scene-assets         ← SCENE_ASSET 输出
├── prop-assets          ← PROP_ASSET 输出
├── storyboard-shots     ← STORYBOARD_GENERATOR 输出
├── video-prompts        ← VIDEO_PROMPT_GENERATOR 输出
└── submit-results       ← PLATFORM_SUBMIT 输出
```

每个契约包含：
- JSON Schema（机器可校验）
- 一份真实示例数据（人可读）
- 必填/可选字段说明
- 版本号（契约变更时通知下游）

### 文档 2：Prompt 模板手册（P0，Phase 2 前必须有）

每个节点的内置提示词模板，不是随便写的——需要经过测试、迭代、固化。

```
文件：docs/prompt-templates.md

每个模板包含：
├── 模板名称 + 适用节点
├── 完整 prompt 文本（含 {{变量}} 占位符）
├── 变量清单 + 来源说明
├── 测试记录：用了什么输入，得到什么输出，质量评分
├── 已知局限：什么场景下效果差
└── 迭代历史：v1 → v2 改了什么，为什么改
```

这份文档由 Prompt 工程师主笔，节点开发者消费。没有它，节点开发者只能瞎写 prompt，质量不可控。

### 文档 3：迁移检查清单（P1，Phase 2 启动时）

10 个待迁移节点，每个的迁移步骤是重复的，用检查清单标准化：

```
文件：docs/migration-checklist.md

每个节点的迁移清单：
□ 从 useNodeActions.ts 提取 handler 逻辑
□ 创建 services/nodes/xxx.service.ts，继承 BaseNodeService
□ 声明 inputSchema / outputSchema
□ 实现 execute() 方法
□ 在 index.ts 注册到 Registry
□ 原 handler 改为调用 Registry.executeNode()
□ 原 BottomPanel 逻辑不动（UI 层暂不改）
□ 跑通单节点执行测试
□ 跑通与上下游节点的连线执行测试
```

有了这个清单，迁移工作可以交给任何人，不需要理解全局架构。

### 文档 4：测试用例集（P1，与开发同步）

```
文件：docs/test-cases.md

按层级组织：
├── 单节点测试
│   ├── SCRIPT_PARSER：空文本 / 短剧本 / 长剧本 / 非中文 / 格式混乱
│   ├── STYLE_PRESET：简单模式 / 四段式 / 模板切换
│   └── ... 每个节点 5-10 个用例
├── 连线测试
│   ├── 兼容类型连线：正常传数据
│   ├── 不兼容类型连线：警告提示
│   └── 断开连线后重连：数据不残留
├── 工作流测试
│   ├── 模板 A 全链路：粘贴剧本 → 提交即梦
│   ├── 模板 B 全链路：创作 → 提交
│   ├── 中途暂停恢复
│   ├── 节点失败跳过 + 失败重试
│   └── 固化后重新执行
└── 边界测试
    ├── 10 个场景的长剧本
    ├── 资产生成全部失败
    └── 浏览器刷新后管线恢复
```

### 文档 5：变更日志模板（P2，持续维护）

```
文件：CHANGELOG.md

格式：
## [Phase X] - 日期
### 新增
- SCRIPT_PARSER 节点上线
### 变更
- Connection 接口升级为端口模式（兼容旧格式）
### 修复
- xxx
### 破坏性变更
- ⚠️ 数据契约 structured-script v2，下游节点需适配
```

破坏性变更必须提前一个 Sprint 通知所有相关开发者。

---

## 三、任务拆解方法

厉害的团队不会按「功能模块」拆任务，而是按「可独立交付的垂直切片」拆。

### 3.1 拆解原则

**错误示范（按层拆）：**
```
任务1: 写所有节点的 types
任务2: 写所有节点的 service
任务3: 写所有节点的 component
→ 问题：任务之间强依赖，一个卡住全卡住，无法独立验收
```

**正确示范（按垂直切片拆）：**
```
任务1: SCRIPT_PARSER 节点（type + service + component + 模板 + 测试）
任务2: SCENE_ASSET 节点（type + service + component + 模板 + 测试）
→ 每个任务独立交付、独立验收、独立合并
```

### 3.2 Phase 1 任务拆解（地基层，有依赖关系）

```
Sprint 1 (Week 1):

  T1.1 [架构师] types.ts 重构
    ├── 新增 Project / AssetLibrary 接口
    ├── 新增 PortSchema 接口
    ├── Connection 升级为 fromPort/toPort
    ├── 旧 Connection 兼容适配函数
    └── 验收：类型编译通过，现有代码不报错

  T1.2 [架构师] BaseNodeService 升级（依赖 T1.1）
    ├── 新增 abstract inputSchema / outputSchema
    ├── 内置 RetryConfig + 重试循环
    ├── 新增 waitIfPaused 钩子
    ├── 现有 6 个 service 补上 schema 声明
    └── 验收：6 个节点带重试跑通

  T1.3 [前端] 连线兼容性检查（依赖 T1.1）
    ├── 拖线时读取两端 PortSchema
    ├── 类型匹配逻辑
    ├── 不兼容端口灰显 + 兼容高亮
    └── 验收：画布上能看到端口，连线有校验反馈

```
Sprint 2 (Week 2):

  T1.4 [架构师] PipelineEngine 核心（依赖 T1.2）
    ├── 拓扑排序 + 同层并行检测
    ├── 状态机：idle → running → paused → waiting_user → completed
    ├── 暂停/恢复 Promise 机制
    ├── 失败跳过 + failures 收集
    ├── waitPoints 人工卡点支持
    └── 验收：用现有 6 个节点组成工作流，一键跑通 + 暂停恢复

  T1.5 [架构师] PromptTemplate 系统（无强依赖）
    ├── PromptTemplate / TemplateVariable 接口
    ├── 模板加载器（从 services/templates/ 读取）
    ├── 变量填充引擎（{{var}} 替换）
    └── 验收：能加载模板、填充变量、返回完整 prompt

  T1.6 [前端] project.store.ts（依赖 T1.1）
    ├── Project CRUD
    ├── 当前活跃项目切换
    ├── 共享资产池读写
    ├── UI：项目选择器组件
    └── 验收：能创建/切换/删除项目
```

### 3.3 Phase 2 任务拆解（并行开发，无互相依赖）

```
Sprint 3-5 (Week 3-5)，三条线并行：

线路 A [节点开发 A]:

  T2.1 SCRIPT_PARSER 节点
    ├── scriptParser.service.ts（继承 BaseNodeService）
    ├── inputSchema: [{ key:'raw_text', type:'string' }]
    ├── outputSchema: [{ key:'parsed_script', type:'structured-script' }]
    ├── 3 套 prompt 模板（短剧标准/长剧详细/改编）
    ├── 输出 JSON Schema 校验（质检防线 1）
    ├── ScriptParserNode 组件
    └── 验收：粘贴剧本 → 输出标准化 JSON，3 套模板都能跑通

  T2.2 VIDEO_PROMPT_GENERATOR 节点
    ├── videoPromptGenerator.service.ts
    ├── Q1-Q8 质检逻辑（结构化输出 + 规则引擎双校验）
    ├── 3 套节拍模板（标准/快节奏/文艺）
    ├── VideoPromptGeneratorNode 组件（含逐条编辑 UI）
    └── 验收：输入分镜 → 输出视频提示词，Q1-Q8 全过

```
线路 B [节点开发 B]:

  T2.3 SCENE_ASSET 节点
    ├── sceneAsset.service.ts
    ├── 六格图生成逻辑（全景/中景/俯瞰/仰角/特写/氛围）
    ├── 3 套模板（六格标准/四格快速/按影片类型）
    ├── 输出存入项目共享资产池
    └── 验收：输入场景描述 + 画风 → 输出六格图

  T2.4 PROP_ASSET 节点
    ├── propAsset.service.ts
    ├── 三视图生成逻辑
    ├── 输出存入项目共享资产池
    └── 验收：输入道具描述 → 输出三视图

  T2.5 STYLE_PRESET 升级
    ├── StyleConfig 接口扩展（fourParts 字段）
    ├── 模式切换 UI（简单 ↔ 四段式）
    ├── 4 套模板（简洁/真人写实/游戏CG/3D国漫）
    └── 验收：两种模式都能生成，下游节点能正确消费

```
线路 C [节点迁移]（按依赖顺序排列）:

  T2.6  SCRIPT_PLANNER 迁移    → 2d
  T2.7  SCRIPT_EPISODE 迁移    → 2d
  T2.8  CHARACTER_NODE 迁移    → 3d（最复杂，4种生成模式）
  T2.9  STORYBOARD_GENERATOR 迁移 → 2d
  T2.10 STORYBOARD_IMAGE 迁移  → 2d
  T2.11 DRAMA_ANALYZER 迁移    → 1d
  T2.12 DRAMA_REFINED 迁移     → 0.5d（被动节点，逻辑简单）
  T2.13 IMAGE_EDITOR 迁移      → 1d
  T2.14 VIDEO_ANALYZER 迁移    → 1d
  T2.15 STYLE_PRESET 基础迁移  → 0.5d（与 T2.5 升级合并）

  每个迁移任务统一按 migration-checklist.md 执行，验收标准一致。
```

---

## 四、质量管控体系

架构方案里已经定义了「三道防线」（节点内质检 / 工作流容错 / 人工卡点），那是产品运行时的质量保障。这里说的是开发过程中的质量管控——怎么保证写出来的代码本身是对的。

### 4.1 代码层面：四道关卡

```
开发者本地 → PR 提交 → CI 自动化 → 人工 Review
```

**关卡 1：本地开发规范**

```
每个节点 service 必须包含：
├── inputSchema / outputSchema 声明（编译期检查）
├── execute() 内的输入校验（运行时检查）
├── 至少 1 个 happy path 单元测试
├── 至少 1 个 error path 单元测试
└── 模板变量填充的快照测试（防止模板改动导致输出漂移）
```

工具链：TypeScript strict mode + ESLint + Prettier，提交前自动格式化。

**关卡 2：PR 提交规范**

每个 PR 必须包含：
- 关联的任务编号（T1.1 / T2.3 等）
- 变更说明：改了什么、为什么改
- 数据契约变更：如果修改了任何 Schema，必须同步更新 data-contracts.md
- 自测截图/录屏：节点能跑通的证据

PR 标题格式：`[Phase.Task] 简述`，如 `[P2.T2.1] feat: SCRIPT_PARSER 节点`

**关卡 3：CI 自动化检查**

PR 合并前自动跑：
- TypeScript 编译（零 error）
- 单元测试全过
- Schema 兼容性检查：新节点的 outputSchema 是否与已有下游节点的 inputSchema 兼容
- Bundle size 检查：防止引入过大依赖

**关卡 4：人工 Code Review 重点**

不同角色 review 不同侧面：

| 审查者 | 关注点 |
|--------|--------|
| 架构师 | Schema 声明是否合理、与数据契约一致、命名规范 |
| 同组开发者 | 逻辑正确性、边界处理、错误信息是否有用 |
| Prompt 工程师 | 模板变量是否完整、prompt 拼接逻辑是否正确 |
| 前端 | 组件是否复用现有模式、状态管理是否干净 |

规则：每个 PR 至少 1 个架构师 + 1 个同组开发者 approve 才能合并。

### 4.2 集成层面：每个 Phase 结束时的验收测试

不是等全做完再测，而是每个 Phase 交付时跑一轮端到端：

| Phase | 验收场景 | 通过标准 |
|-------|----------|----------|
| P1 | 现有 6 节点 + 新引擎 | 带重试跑通，暂停恢复正常，端口显示正确 |
| P2 | 单节点独立执行 | 每个节点输入标准数据 → 输出符合 Schema → 模板可切换 |
| P3 | 模板 A 全链路 | 粘贴剧本 → 一键跑到提交即梦，中间只在画风暂停 |
| P3 | 模板 B 全链路 | 从零创作 → 逐节点确认 → 全部跑通 |
| P4 | 压力测试 | 10 场景长剧本、资产全失败后恢复、刷新后管线恢复 |

### 4.3 Prompt 质量管控（最容易被忽视的一环）

代码写对了不代表产出质量高——prompt 模板的好坏直接决定最终生成物的质量。

**Prompt 迭代流程：**

```
v0 草稿 → 跑 5 组测试数据 → 人工评分（1-5分）→ 分析低分原因
    → v1 修改 → 再跑 5 组 → 评分 → 达标（平均≥3.5）才入库
```

**评分维度（每个节点不同）：**

| 节点 | 评分维度 |
|------|----------|
| SCRIPT_PARSER | 角色提取完整度、场景划分合理性、道具无遗漏 |
| STYLE_PRESET | 四段式各段是否具体可执行、风格一致性 |
| SCENE_ASSET | 六格视角是否正确、风格是否统一、细节丰富度 |
| STORYBOARD_GENERATOR | 镜头多样性、叙事节奏感、画面可执行性 |
| VIDEO_PROMPT_GENERATOR | 运镜描述精确度、音效合理性、转场连贯性 |

**模板版本管理：**
- 每个模板有版本号，修改必须升版本
- 旧版本不删除，用户可以回退
- 每次升版附带：改了什么、为什么改、测试评分对比

---

## 五、开发节奏与协作机制

### 5.1 每周节奏

```
周一 AM  — 周会（30min）
           各线路同步进度，暴露阻塞项，调整本周优先级

周三 PM  — 契约对齐会（15min，按需）
           有数据契约变更时召开，确认上下游都知晓

周五 PM  — Demo + 回顾（45min）
           本周完成的任务现场演示，收集反馈，更新风险登记表
```

### 5.2 分支策略

```
main ─────────────────────────────────────────────→
  │
  ├── phase1/foundation ──→ PR → main
  │
  ├── phase2/script-parser ──→ PR → main
  ├── phase2/scene-asset ──→ PR → main
  ├── phase2/video-prompt-gen ──→ PR → main
  ├── phase2/migrate-xxx ──→ PR → main（每个迁移节点一个分支）
  │
  └── phase3/workflow-templates ──→ PR → main
```

规则：
- Phase 1 合入 main 后，Phase 2 各分支才能开工
- Phase 2 各分支互不依赖，可以独立合入
- 每个分支生命周期不超过 1 周，避免长期分支合并冲突

### 5.3 阻塞处理协议

开发中最怕的不是 bug，是「等」——等别人的接口、等契约确认、等 review。

```
阻塞发生 → 15 分钟内在群里喊出来（不要闷头等）
    │
    ├── 等契约？→ 先用 mock 数据开发，契约确认后替换
    ├── 等上游节点？→ 写 fixture 文件模拟上游输出
    ├── 等 review？→ 找第二个人 review，不卡在一个人身上
    └── 技术卡点？→ 拉 15 分钟 huddle，三个人一起看
```

核心原则：**任何人被阻塞超过 2 小时必须升级**，不允许默默等。

### 5.4 契约变更流程

数据契约是多人并行的生命线，变更必须走流程：

```
1. 提出变更 → 在 data-contracts.md 中标注 [PROPOSED]
2. 通知下游 → 群里 @所有消费该契约的开发者
3. 15 分钟内确认 → 无异议则标注 [APPROVED]，有异议则开会讨论
4. 实施变更 → 修改 Schema + 更新所有下游适配代码
5. 升版本号 → v1 → v2，旧版本保留兼容期（1 个 Sprint）
```

---

## 六、总结：从方案到落地的完整链路

```
架构方案 (architecture-plan.md)
    │
    ▼
方案评审会（半天）→ 风险登记表 + 技术 Spike（2-3天）
    │
    ▼
补充文档准备（与 Spike 并行）
    ├── 数据契约文档 (P0)
    ├── Prompt 模板手册 (P0)
    ├── 迁移检查清单 (P1)
    ├── 测试用例集 (P1)
    └── 变更日志模板 (P2)
    │
    ▼
任务拆解 → 垂直切片，每个任务独立交付
    │
    ▼
四阶段开发（8周）
    ├── P1 地基（2周）：类型重构 + 引擎 + 模板系统
    ├── P2 节点（3周）：5新增 + 2升级 + 10迁移，三线并行
    ├── P3 串联（2周）：工作流模板 + 固化 + 平台对接
    └── P4 打磨（1周）：扩展 + 压测 + 模板库
    │
    ▼
质量管控贯穿全程
    ├── 代码层：本地规范 → PR → CI → Review
    ├── 集成层：每 Phase 端到端验收
    └── Prompt 层：迭代评分 → 达标入库
```
