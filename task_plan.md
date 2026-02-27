# AIYOU 架构升级 — 任务计划

> 创建时间: 2026-02-27
> 状态: ✅ 需求分析完成，待确认执行方案

## 阶段 0: 需求理解 ✅
- [x] 读取 architecture-plan.md，提取核心架构变更
- [x] 读取 implementation-playbook.md，提取实施步骤
- [x] 整合为可执行任务清单
- 详见 findings.md

## 阶段 0.5: 前置准备（技术Spike + 文档）
- [ ] S1: 验证 IndexedDB 存储方案（Dexie.js）
- [ ] S2: 验证画布多端口渲染能力
- [ ] S3: 验证即梦浏览器扩展桥接
- [ ] S4: 验证同层节点并行执行
- [ ] 编写 data-contracts.md（P0，开工前必须）
- [ ] 编写 prompt-templates.md（P0，Phase 2 前必须）

## Phase 1: 地基层（2周）

### Sprint 1（Week 1）— 类型系统 + 基类
- [x] T1.1 types.ts 重构：新增 Project/AssetLibrary/PortSchema/StyleConfig 等 14 个 interface，Connection 升级 + 旧格式兼容适配
- [x] T1.2 BaseNodeService 升级：新增 inputSchema/outputSchema 自声明、RetryConfig、waitIfPaused 钩子
- [x] T1.3 连线兼容性检查：connectionValidator.ts 核心逻辑（UI集成待做）

### Sprint 2（Week 2）— 引擎 + 存储
- [x] T1.4 PipelineEngine 核心：拓扑排序 + 同层并行、状态机、暂停/恢复/失败跳过/人工卡点
- [x] T1.5 PromptTemplate 系统：模板加载器 + {{variable}} 变量填充引擎
- [x] T1.6 project.store.ts：Project CRUD、共享资产池读写

### 依赖关系
T1.1 → T1.2 → T1.4（串行）；T1.1 → T1.3, T1.6（可并行）；T1.5 无强依赖

## Phase 2: 新节点 + 迁移（3周，三线并行）

### 线路 A — 核心新节点
- [ ] T2.1 SCRIPT_PARSER：剧本解析，输出 structured-script JSON
- [ ] T2.2 VIDEO_PROMPT_GENERATOR：分镜→视频指令翻译 + Q1-Q8 质检

### 线路 B — 资产节点
- [ ] T2.3 SCENE_ASSET：六格场景参考图生成
- [ ] T2.4 PROP_ASSET：道具三视图生成
- [ ] T2.5 STYLE_PRESET 升级：双模式（简单+四段式）+ 多模板

### 线路 C — 10 节点迁移（按依赖顺序）
- [ ] T2.6 SCRIPT_PLANNER → T2.7 SCRIPT_EPISODE → T2.8 CHARACTER_NODE
- [ ] T2.9 STORYBOARD_GENERATOR → T2.10 STORYBOARD_IMAGE
- [ ] T2.11 DRAMA_ANALYZER → T2.12 DRAMA_REFINED
- [ ] T2.13 IMAGE_EDITOR → T2.14 VIDEO_ANALYZER
- [ ] T2.15 STYLE_PRESET 基础迁移（与 T2.5 合并）

### 前置条件
Phase 1 全部合入 main 后才能开工；三条线路互不依赖，可独立合入

## Phase 3: 工作流串联 + 平台对接（2周）
- [ ] T3.1 三套预设工作流模板（剧本→分镜→视频提示词→提交）
- [ ] T3.2 工作流固化功能（快照 + one_click/step_by_step 执行模式）
- [ ] T3.3 PLATFORM_SUBMIT + JimengProvider 实现
- [ ] T3.4 项目管理 UI（项目选择器/切换器）
- [ ] T3.5 模板选择器 UI + 管线状态面板

## Phase 4: 打磨 + 扩展（1周）
- [ ] T4.1 更多 Provider（Kling/Sora）
- [ ] T4.2 模板库扩充 + 用户自建模板导入导出
- [ ] T4.3 边界场景测试 + 10场景长剧本压测
- [ ] T4.4 性能优化 + 失败恢复测试

---

## Windows EXE 打包（独立任务线）

> 目标：纯小白一键安装 exe，Win10+ x64
> 决策：砍 Node sidecar、GitHub Actions CI、NSIS 安装器、无签名

### WP1: 移除 Node sidecar [done]
- [x] tauri.conf.json: 删 externalBin/resources/shell.scope
- [x] lib.rs: 移除 sidecar 启动逻辑，纯 Tauri 壳
- [x] Cargo.toml: 移除 reqwest/tokio/tauri-plugin-shell，重命名 fcyh
- [x] main.rs: fcyh_lib::run()
- [x] Cargo.lock: 更新包名
- [x] package.json: tauri:build 不再调 build-server
- [x] 前端 graceful degradation — 后端调用全有 try/catch，核心 AI 走前端直连

### WP2: Tauri 打包配置 [done]
- [x] bundle.targets = ["nsis"]
- [x] NSIS: installMode=both, 中文语言包, displayLanguageSelector=false
- [x] WebView2: embedBootstrapper（安装包内嵌，离线可用）

### WP3: GitHub Actions CI [done]
- [x] build-desktop.yml 更新：砍掉 sidecar 构建步骤
- [x] workflow_dispatch 手动触发已有
- [x] 产物上传 artifact + tag 时 draft release

### WP4: 验证 [done]
- [x] vite build 通过 (18.83s)
- [x] 本地无 Rust，cargo check 由 CI 执行
- [x] CI workflow 语法正确

---

## 临时任务线：测试重写 + 代码审查修复（2026-02-27）

- [x] R1: 重跑全量测试，确认失败基线与影响范围
- [x] R2: 修正并重写 nodeHelpers 高度断言（与当前渲染逻辑一致）
- [x] R3: 补充 nodeValidation 回归用例（SCRIPT_PARSER 与未知类型防御）
- [x] R4: 修复 nodeValidation 执行前校验与防御分支
- [x] R5: 全量测试回归通过（79/79）

## 临时任务线：Workflow Builder Skill（2026-02-27）

- [x] S-W1: 使用 skill-creator 初始化技能骨架
- [x] S-W2: 编写 8 阶段闭环执行流程（含 3 套工作流方案 + 3 套补节点方案）
- [x] S-W3: 增加节点覆盖审计脚本（types/registry/validation 三维核对）
- [x] S-W4: 生成 agents/openai.yaml 并通过 quick_validate
- [x] S-W5: 脚本正反例运行验证
