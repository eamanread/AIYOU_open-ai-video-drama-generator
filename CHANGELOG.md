# 蜂巢映画 更新日志

## v0.2.0 — QA 体系建设 + 节点规则补全 (2026-02-27)

### 问题修复

| 文件 | 问题 | 修复 |
|------|------|------|
| `utils/nodeHelpers.test.ts` | 3 个高度断言与实现不符（320→360, 动态加高已移除） | 更新为实际值：PROMPT_INPUT=360, STORYBOARD=500, CHARACTER=600 |
| `utils/nodeValidation.ts` | Phase 1 新增的 5 个 NodeType 缺少 `NODE_DEPENDENCY_RULES` 条目，导致连线校验崩溃 | 补全 SCRIPT_PARSER / SCENE_ASSET / PROP_ASSET / VIDEO_PROMPT_GENERATOR / PLATFORM_SUBMIT 规则 |
| `utils/nodeValidation.ts` | `validateConnection` 和 `canExecuteNode` 遇到未知类型时直接 crash | 增加 null guard，返回 `{valid:false}` 而非抛异常 |
| `utils/nodeValidation.ts` | SCRIPT_PARSER 节点缺少执行前校验 | 新增：无 prompt 且无上游输入时拒绝执行 |

### CI/CD 改进

| 变更 | 文件 | 说明 |
|------|------|------|
| 测试门禁 | `.github/workflows/ci.yml` | 拆分为 `test` → `build` 两个 job，`build` 依赖 `test` 通过；pnpm 8→10 |
| 构建前测试 | `.github/workflows/build-desktop.yml` | Windows 构建前先跑 `pnpm test` |
| 安装包冒烟测试 | `.github/workflows/build-desktop.yml` | PowerShell 脚本验证 .exe 存在且 >1MB，替换旧的 `dir` 调试步骤 |

### 测试覆盖

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 测试总数 | 75 (4 failing) | 75 (0 failing) |
| CI 是否跑测试 | 否 | 是（test job 前置） |
| 桌面构建是否跑测试 | 否 | 是 |
| 安装包验证 | 无 | PowerShell 冒烟测试 |
| 未知节点类型防御 | 无（crash） | 有（graceful error） |

### 变更文件清单

```
.github/workflows/ci.yml              — 新增 test job，pnpm 升级，移除 --no-strict-peer-dependencies
.github/workflows/build-desktop.yml   — 新增 pnpm test + PowerShell 冒烟测试
utils/nodeValidation.ts               — 5 个 Phase 1 节点规则 + null guard + SCRIPT_PARSER 校验
utils/nodeValidation.test.ts          — 4 个新测试（SCRIPT_PARSER 校验 + 防御性测试）
utils/nodeHelpers.test.ts             — 3 个高度断言修正
```

### 测试流水线

```
push/PR → ci.yml:  test (75 单元测试) → build (vite)
tag/手动 → build-desktop.yml:  test → tauri build → 冒烟测试 → 上传产物
```

---

## v0.1.0 — 架构升级 + 品牌重塑 + Windows 打包 (2026-02-27)

### 品牌重塑 AIYOU → 蜂巢映画/FCYH
- SVG Logo 组件（`components/Logo.tsx`），三档尺寸 + 渐变 + 辉光
- 全局替换：WelcomeScreen、App.tsx、Cargo.toml、tauri.conf.json 等 20+ 文件

### 架构升级 Phase 1-3
- types.ts 重构：14 个新 interface + NodeStatus enum 修复
- PipelineEngine：拓扑排序 + 同层并行 + 暂停/恢复/跳过
- PromptTemplate 系统 + 工作流模板（5 套预设）
- 10 个旧节点迁移至 BaseNodeService 架构
- connectionValidator + workflowSolidifier

### Windows EXE 打包
- 砍掉 Node sidecar，纯前端桌面壳（lib.rs 125→5 行）
- NSIS 安装器 + WebView2 embedBootstrapper + 中文语言包
- GitHub Actions CI 自动构建，产物 3.1MB
