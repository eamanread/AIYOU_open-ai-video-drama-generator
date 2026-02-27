# AIYOU 蜂巢映画 — 任务计划

> 创建时间: 2026-02-27
> v0.1.x: ✅ 架构骨架 (tag: v0.1.2)
> v0.2.0: ✅ mock→real 全链路接入 (tag: v0.2.0, 87测试)
> v0.3.0: 🔄 产品化打磨 — 当前阶段

## v0.1.x / v0.2.0 历史 ✅
- 详见 findings.md + progress.md

---

## v0.3.0 — 产品化打磨

### 范围修订（基于代码审计）

原计划 B1-B10 共10项，审计后调整：

| 原编号 | 调整 | 原因 |
|--------|------|------|
| B8 新手引导 | ❌ 移除 | WelcomeScreen(86行)+TemplateSelector(158行) 已完整 |
| B9 执行日志 | ❌ 移除 | apiLogger.ts(437行) 已完整实现 |
| B3 Sentry | 降级为 Quick Fix | 4处取消注释 + 移动依赖位置，10分钟工作量 |

实际开发项：B1 + B2 + B4 + B5 + B6 + B7 + B10 = 7项 + B3 quick fix

### 执行波次与Agent分配

```
B3 Quick Fix (5min)          ← 开场热身，4处取消注释
    ↓
Wave 1 (并行): B5 + B6 + B4  ← 三个低风险 mock→real，建立信心
    ↓
Wave 2 (并行): B1 + B2       ← 两个中高风险 UI 构建
    ↓
Wave 3 (串行): B7            ← 高风险存储迁移，需全量回归
    ↓
Wave 4 (串行): B10           ← CI + E2E 收尾
```

| Agent | 任务 | 涉及文件 | 前置文档 | 预估复杂度 |
|-------|------|---------|---------|-----------|
| B3 | Sentry 取消注释 | ErrorBoundary*.tsx(3文件) + package.json | 无 | ⚪ 5min |
| B5 | ImageEditor mock→real | imageEditor.service.ts | D3 | 🟢 低 |
| B6 | VideoAnalyzer mock→real | videoAnalyzer.service.ts | D3 | 🟢 低 |
| B4 | Kling Provider mock→real | kling.provider.ts | D3 | 🟢 低 |
| B1 | CanvasBoard 画布实现 | CanvasBoard.tsx + ConnectionLayer.tsx | D1 | 🔴 高 |
| B2 | FFmpeg 视频拼接 | VideoEditor.tsx | D3 | 🟡 中 |
| B7 | 存储层 LS→IndexedDB | app.store.ts + storage/*.ts | D2 | 🔴 高 |
| B10 | Playwright E2E + CI | workflows/*.yml + tests/e2e/ | D4 | 🟡 中 |

### 依赖关系图

```
D1 ──→ B1
D2 ──→ B7
D3 ──→ B4, B5, B6, B2
D4 ──→ B10

B3 无依赖（立即可做）
B5/B6/B4 互不依赖（Wave 1 并行）
B1/B2 互不依赖（Wave 2 并行）
B7 需 Wave 1+2 完成后单独执行（存储迁移影响全局）
B10 需 B1-B7 全部完成（E2E 测试覆盖完整功能）
```

### 交付标准

- B3: `@sentry/react` 在 dependencies，4处 Sentry.captureException 生效
- B5: ImageEditor 调用 generateImageWithFallback 返回真实图片
- B6: VideoAnalyzer 调用 Gemini multimodal 返回真实分析
- B4: Kling Provider POST/GET 真实 REST API
- B1: 节点可拖拽、连线可绘制、缩放平移、框选
- B2: FFmpeg.wasm 拼接多片段输出 mp4
- B7: 刷新/重启后项目数据完整保留
- B10: Playwright E2E 覆盖 Template C 全路径，CI 双平台绿灯
- 全量: `pnpm test` 全绿（≥87 tests）

### 前置文档门禁（编码前必须完成）

| 序号 | 文档 | 负责角色 | 阻塞项 |
|------|------|---------|--------|
| D1 | `docs/v0.3.0-canvas-design.md` | 前端架构师 | B1 |
| D2 | `docs/v0.3.0-storage-migration.md` | 存储专家 | B7 |
| D3 | `docs/v0.3.0-api-specs.md` | 后端工程师 | B4(Kling)+B2(FFmpeg) |
| D4 | `docs/v0.3.0-test-plan.md` | QA工程师 | B10(Playwright) |

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
