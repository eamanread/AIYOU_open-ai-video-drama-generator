# AIYOU 架构升级方案 — 融合 Storyboard Edge Extension 全业务流

> 基于 11 轮苏格拉底式需求确认，2026-02-27

---

## 〇、需求确认结论

| # | 问题 | 结论 |
|---|------|------|
| 1 | 产品范式 | C：节点自由组合 + 工作流可固化，两种模式共存 |
| 2 | 即梦提交 | C：通用「平台提交」节点，可对接即梦/可灵/Sora 等 |
| 3 | 画风体系 | C：升级 STYLE_PRESET，简单模式 + 四段式模式可切换，支持多模板 |
| 4 | 资产节点 | A：新增独立的 SCENE_ASSET 和 PROP_ASSET 节点 |
| 5 | 剧本入口 | C：创作和解析两条路径，创作输出也过解析节点做格式标准化 |
| 6 | 工作流固化 | 固化时的配置决定执行行为（一键/逐节点确认） |
| 7 | 视频提示词 | A：独立新节点，插在分镜和视频生成/平台提交之间 |
| 8 | 容错机制 | C：节点级重试 + 工作流级跳过继续，两层都要 |
| 9 | 分镜解耦 | 同一目标可有不同节点实现，提示词通过可更换模板驱动 |
| 10 | 项目概念 | A：引入 Project 作为工作流之上的组织层 |
| 11 | 模板定义 | A：模板 = 仅提示词文本，其他参数用户自调 |
| 12 | 接口契约 | B：节点自声明输入输出 schema，连线时做兼容性检查 |

---

## 一、架构调整（3 层改造）

### 1.1 新增 Project 层

当前结构：`Workflow[] → Node[] + Connection[]`
目标结构：`Project → Workflow[] + SharedAssets + SharedStyle + PipelineConfig`

```typescript
interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  // 项目级共享资源
  sharedStyle: StyleConfig | null;       // 画风配置，一次生成全项目复用
  sharedAssets: AssetLibrary;            // 角色/场景/道具资产池
  // 工作流集合
  workflows: Workflow[];
  // 全局设置
  settings: {
    defaultModel: string;
    retryConfig: RetryConfig;
    apiConfig: ApiConfig;
  };
}

interface AssetLibrary {
  characters: CharacterAsset[];   // 角色资产（含六格图/表情图/三视图）
  scenes: SceneAsset[];           // 场景资产（含六格环境图）
  props: PropAsset[];             // 道具资产（含三视图）
}
```

影响范围：
- `app.store.ts` 新增 `projects: Project[]`，现有 `workflows` 挂到 project 下
- 新增 `project.store.ts` 管理当前活跃项目
- UI 顶部新增项目选择器/切换器
- 删除项目时级联清理所有子数据

### 1.2 节点 Schema 自声明 + 连线兼容性检查

当前问题：`Connection { from, to }` 只有节点 ID，没有端口概念，无法校验数据是否兼容。

改造方案：每个节点服务类声明自己的输入输出 schema：

```typescript
interface PortSchema {
  key: string;              // 端口标识，如 'script', 'style', 'image'
  type: string;             // 数据类型标识，如 'structured-script', 'style-config', 'base64-image'
  label: string;            // 显示名称
  required: boolean;
  description?: string;
}

// BaseNodeService 新增
abstract class BaseNodeService {
  abstract readonly nodeType: string;
  abstract readonly inputSchema: PortSchema[];
  abstract readonly outputSchema: PortSchema[];
  // ... 原有方法
}
```

Connection 升级：

```typescript
interface Connection {
  id: string;
  from: string;
  fromPort: string;         // 输出端口 key
  to: string;
  toPort: string;           // 输入端口 key
}
```

连线时校验逻辑：
- 用户拖线时，检查 `fromPort.type` 与 `toPort.type` 是否兼容
- 兼容规则：完全匹配 > 类型继承（如 `base64-image` 兼容 `any-image`）> 用户强制连接（警告但允许）
- UI 上不兼容的端口灰显，兼容的高亮

### 1.3 提示词模板系统

模板 = 纯提示词文本，带变量占位符，节点运行时填充。

```typescript
interface PromptTemplate {
  id: string;
  name: string;                    // 如 "四段式电影画风"、"简洁风格"
  nodeType: string;                // 适用的节点类型
  category: string;                // 分类标签，如 'style', 'storyboard', 'character'
  promptText: string;              // 模板正文，支持 {{variable}} 占位
  variables: TemplateVariable[];   // 声明模板需要的变量
  isBuiltIn: boolean;              // 内置 vs 用户自建
  version: string;
}

interface TemplateVariable {
  key: string;           // 如 'genre', 'scene_description'
  label: string;         // 显示名
  source: 'input' | 'config' | 'upstream';  // 变量来源
  fallback?: string;     // 缺省值
}
```

存储与管理：
- 内置模板随代码发布，存 `services/templates/` 目录
- 用户自建模板存 localStorage（后续可扩展到云端）
- 节点 UI 底部面板新增「模板选择」下拉，切换后实时预览填充结果

---

## 二、节点体系设计

### 2.1 新增节点（5 个）

#### SCRIPT_PARSER — 剧本解析

定位：所有下游节点的「数据标准化网关」，不管剧本从哪来，都过这个节点统一格式。

```
输入端口:
  - raw_text (string): 原始剧本文本（来自 PROMPT_INPUT 或 SCRIPT_EPISODE 输出）

输出端口:
  - parsed_script (structured-script): 标准化 JSON
    {
      title, genre, mood,
      characters: [{ name, identity, description }],
      scenes: [{ index, name, description, characters[], props[], scriptText }],
      props: [{ name, description, owner }]
    }
```

模板示例：
- 「短剧解析-标准版」— 提取角色/场景/道具/情绪
- 「长剧解析-详细版」— 额外提取时间线/伏笔/冲突点
- 「改编解析」— 侧重 IP 元素提取

#### SCENE_ASSET — 场景资产

定位：从解析后的场景描述 + 画风配置，生成 2×3 六格场景参考图。

```
输入端口:
  - parsed_script (structured-script): 场景列表
  - style_config (style-config): 画风配置（可选，来自 STYLE_PRESET）

输出端口:
  - scene_assets (scene-asset[]): 每个场景一组六格图
    { sceneName, gridImage(base64), shots: {
        establishing(全景), medium(中景), aerial(俯瞰),
        lowAngle(仰角), detailClose(特写), atmosphere(氛围光影)
    }}
```

模板示例：
- 「六格标准版」— 全景/中景/俯瞰/仰角/特写/氛围，对标文档规范
- 「四格快速版」— 全景/中景/特写/氛围，省时出图
- 「写实场景」「CG场景」「国漫场景」— 按影片类型切换风格关键词

#### PROP_ASSET — 道具资产

定位：从解析后的道具描述 + 画风配置，生成三视图参考。

```
输入端口:
  - parsed_script (structured-script): 道具列表
  - style_config (style-config): 画风配置（可选）

输出端口:
  - prop_assets (prop-asset[]): 每个道具一组三视图
    { propName, owner, gridImage(base64), views: {
        front(正面), threeQuarter(四分之三侧), back(背面)
    }}
```

模板示例：
- 「三视图标准版」— 正面/侧面/背面，白底产品图风格
- 「场景内道具」— 道具在使用场景中的效果图

#### VIDEO_PROMPT_GENERATOR — 视频提示词生成

定位：分镜和视频生成/平台提交之间的「翻译层」，把视觉分镜转化为精确的视频生成指令。用户可审阅编辑后再往下走。

```
输入端口:
  - storyboard_shots (storyboard-shots): 分镜数据（含图片）
  - raw_script (string): 剧本原文（用于反推台词/音效）
  - style_config (style-config): 画风配置（可选）

输出端口:
  - video_prompts (video-prompt[]): 逐镜头视频提示词
    { shotIndex, duration, aspectRatio, style,
      camera: { shotSize, angle, composition, focalLength, depthOfField },
      movement: { type, speed, startFrame, endFrame },
      description,    // 视觉化描述（动作/眼神/手部/道具/走位/光影）
      audio,          // 环境音/动作音/特效音
      dialogue,       // 台词或"无"
      transition      // 转场方式
    }
```

内置质检（对标文档 Q1-Q8）：
- Q1: 是否完整输出所有镜头
- Q2: 有无站桩镜头（角色静止不动）
- Q3: 有无跳轴（180度规则违反）
- Q4: 景别是否≥4种混用
- Q5: 运镜节奏是否符合模板节拍
- Q6: 光位是否前后一致
- Q7: 台词是否与剧本匹配
- Q8: 转场是否连贯

模板示例：
- 「九镜标准节拍」— 稳→进→定→停→破→收（对标文档 D 规则）
- 「快节奏动作」— 密集剪辑，短时长，多运镜
- 「文艺慢节奏」— 长镜头，缓推拉，留白多

#### PLATFORM_SUBMIT — 平台提交

定位：通用的视频生成平台对接节点，Provider 模式支持多平台扩展。

```
输入端口:
  - video_prompts (video-prompt[]): 视频提示词
  - reference_images (base64-image[]): 参考图（可选）

输出端口:
  - submit_results (submit-result[]): 提交状态
    { shotIndex, platform, status: 'pending'|'submitted'|'error', taskId?, error? }
```

Provider 架构：

```typescript
interface PlatformProvider {
  readonly name: string;           // 'jimeng' | 'kling' | 'sora' | ...
  readonly label: string;          // 显示名
  checkAvailability(): Promise<boolean>;  // 检查平台是否可用
  submit(prompt: VideoPrompt, images?: string[]): Promise<SubmitResult>;
  getStatus(taskId: string): Promise<TaskStatus>;  // 查询生成进度
}

// 即梦：需要浏览器扩展桥接（WebSocket/postMessage）
class JimengProvider implements PlatformProvider { ... }
// 可灵：API 直连
class KlingProvider implements PlatformProvider { ... }
// Sora：API 直连
class SoraProvider implements PlatformProvider { ... }
```

节点 UI：平台选择下拉 + 批量/逐条提交切换 + 状态面板（成功/失败/排队中）

### 2.2 升级节点（2 个）

#### STYLE_PRESET 升级 — 双模式 + 多模板

当前：生成 `stylePrompt + negativePrompt`，单一模式。

升级后：

```typescript
interface StyleConfig {
  mode: 'simple' | 'fourPart';
  // 简单模式（保留现有）
  stylePrompt?: string;
  negativePrompt?: string;
  // 四段式模式（新增，对标文档）
  fourParts?: {
    prefix: string;      // 前置锁定（影片类型 + 美学基底）
    lens: string;        // 焦距和电影感质感锁定
    scene: string;       // 画面描述模板
    lighting: string;    // 光影和调色和质感锁定
  };
  suffix?: string;       // 统一画风后缀
  negative?: string;     // 统一 Negative
  keywords?: Record<string, string>;  // 分类关键词
  // 通用
  visualStyle: 'REAL' | 'ANIME' | '3D' | 'CG';
}
```

输出端口升级：
- `style_config (style-config)`: 完整画风配置对象
- 下游节点根据 `mode` 字段决定如何消费（简单模式拼 stylePrompt，四段式拼 fourParts）

模板示例：
- 「简洁风格」— 一句话 stylePrompt
- 「四段式-真人写实」— 胶片颗粒/自然皮肤/真实面料
- 「四段式-游戏CG」— UE5/次表面散射/PBR材质
- 「四段式-3D国漫」— 东方美学/丝绸光泽/水墨意境

#### BaseNodeService 升级 — 节点级重试

在基类中内置重试能力，所有节点自动继承：

```typescript
interface RetryConfig {
  maxRetries: number;        // 默认 3
  backoffMs: number;         // 初始退避，默认 2000
  backoffMultiplier: number; // 退避倍数，默认 2
  pauseAware: boolean;       // 重试前检查工作流是否暂停
}

abstract class BaseNodeService {
  // 新增：节点默认重试配置（子类可覆盖）
  protected retryConfig: RetryConfig = {
    maxRetries: 3, backoffMs: 2000, backoffMultiplier: 2, pauseAware: true
  };

  // 改造 executeNode：包裹重试逻辑
  async executeNode(node, context): Promise<NodeExecutionResult> {
    const validated = this.validateInputs(node, context);
    if (!validated.success) return validated;

    context.updateNodeStatus(node.id, 'WORKING');

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      if (attempt > 0) {
        // 退避等待
        const delay = this.retryConfig.backoffMs * (this.retryConfig.backoffMultiplier ** (attempt - 1));
        await this.sleep(delay);
        // 暂停感知
        if (this.retryConfig.pauseAware) {
          await context.waitIfPaused?.();
        }
        context.updateNodeStatus(node.id, 'WORKING'); // 重试中
      }

      const result = await this.execute(node, context);
      if (result.success) {
        context.updateNodeStatus(node.id, 'SUCCESS');
        return result;
      }

      // 最后一次重试也失败
      if (attempt === this.retryConfig.maxRetries) {
        context.updateNodeStatus(node.id, 'ERROR');
        return result;
      }
    }
  }
}
```

用户可在节点 UI 中覆盖默认重试次数。

---

## 三、工作流引擎设计

### 3.1 从「拓扑排序执行」升级为「管线引擎」

当前 `executeNodesInOrder()` 是一次性跑完，没有暂停/恢复/跳过能力。需要替换为状态机驱动的管线引擎。

```typescript
type PipelineStatus = 'idle' | 'running' | 'paused' | 'waiting_user' | 'completed' | 'error';
type NodeRunStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped' | 'waiting';

interface PipelineState {
  workflowId: string;
  status: PipelineStatus;
  executionOrder: string[];          // 拓扑排序后的节点 ID 序列
  nodeStatuses: Record<string, NodeRunStatus>;
  currentIndex: number;              // 当前执行到哪个节点
  failures: FailureRecord[];         // 失败记录
  startedAt: number;
  pausedAt?: number;
}

class PipelineEngine {
  private state: PipelineState;

  async run(workflow: Workflow): Promise<void> {
    this.state.executionOrder = topologicalSort(workflow.nodes, workflow.connections);
    this.state.status = 'running';

    for (let i = this.state.currentIndex; i < this.state.executionOrder.length; i++) {
      // 暂停检查
      if (this.state.status === 'paused') {
        await this.waitForResume();
      }

      const nodeId = this.state.executionOrder[i];
      const node = workflow.nodes.find(n => n.id === nodeId);
      this.state.currentIndex = i;

      // 等待确认检查（固化配置决定）
      if (this.shouldWaitForConfirmation(node)) {
        this.state.status = 'waiting_user';
        await this.waitForUserConfirmation(nodeId);
      }

      // 执行节点（内含重试逻辑）
      this.state.nodeStatuses[nodeId] = 'running';
      const result = await NodeServiceRegistry.executeNode(node, ...);

      if (result.success) {
        this.state.nodeStatuses[nodeId] = 'success';
      } else {
        this.state.nodeStatuses[nodeId] = 'error';
        this.state.failures.push({ nodeId, error: result.error, timestamp: Date.now() });
        // 工作流级跳过：记录失败，继续下一个
        continue;
      }
    }

    this.state.status = this.state.failures.length > 0 ? 'completed' : 'completed';
    // 完成后汇总失败项，通知 UI
  }

  pause()  { this.state.status = 'paused'; this.state.pausedAt = Date.now(); }
  resume() { this.state.status = 'running'; /* resolve waitForResume promise */ }
}
```

### 3.2 工作流固化

固化 = 把当前画布上的节点拓扑 + 每个节点的配置快照 + 执行模式，打包成一个可复用的模板。

```typescript
interface FixedWorkflow {
  id: string;
  name: string;
  description: string;
  // 拓扑快照
  nodeSnapshots: FixedNodeSnapshot[];
  connectionSnapshots: Connection[];
  // 执行模式（固化时决定）
  executionMode: 'one_click' | 'step_by_step';
  // 逐节点模式下，哪些节点需要等待确认
  waitPoints: string[];   // 节点 ID 列表
  // 元信息
  createdAt: number;
  projectId: string;
}

interface FixedNodeSnapshot {
  nodeType: string;
  position: { x: number; y: number };
  // 节点配置快照（模板选择、参数预设等）
  config: {
    selectedTemplate?: string;
    retryConfig?: Partial<RetryConfig>;
    customParams?: Record<string, any>;
  };
  // 哪些字段是「运行时填入」的（如剧本文本）
  runtimeInputs: string[];
}
```

固化工作流的使用流程：

```
1. 用户在画布上搭好节点 → 调试通过
2. 点击「固化为模板」→ 弹窗选择执行模式：
   - 一键执行：所有节点自动跑完
   - 逐节点确认：每个节点执行前暂停等用户点「继续」
   - 自定义：勾选哪些节点需要等待确认（如只在画风节点暂停）
3. 保存为 FixedWorkflow
4. 下次使用：从模板列表选择 → 填入运行时输入（如剧本文本）→ 点击「执行」
5. 引擎按固化时的配置自动运行，该暂停的暂停，该跳过的跳过
```

---

## 四、完整节点流程拓扑

### 4.1 两条入口路径汇合图

```
路径A：从零创作                          路径B：已有剧本
─────────────                          ─────────────

DRAMA_ANALYZER                         PROMPT_INPUT
      │                                (粘贴剧本原文)
      ▼                                     │
DRAMA_REFINED                               │
      │                                     │
      ▼                                     │
SCRIPT_PLANNER ──→ SCRIPT_EPISODE           │
                        │                   │
                        ▼                   ▼
                   ┌─────────────────────────┐
                   │     SCRIPT_PARSER       │
                   │  (数据标准化网关)        │
                   │  输出: structured-script │
                   └────────┬────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        STYLE_PRESET   CHARACTER_NODE   (下游)
        (画风配置)      (角色资产)
```

### 4.2 SCRIPT_PARSER 之后的全链路

```
                    SCRIPT_PARSER
                         │
                         │ structured-script
                         │
         ┌───────────────┼───────────────┬──────────────┐
         ▼               ▼               ▼              ▼
   STYLE_PRESET    CHARACTER_NODE   SCENE_ASSET    PROP_ASSET
   (画风配置)       (角色六格图)    (场景六格图)   (道具三视图)
         │               │               │              │
         │  style-config  │  char-assets  │ scene-assets │ prop-assets
         │               │               │              │
         └───────┬───────┴───────┬───────┴──────┬───────┘
                 │               │              │
                 ▼               ▼              ▼
         ┌──────────────────────────────────────────┐
         │        STORYBOARD_GENERATOR              │
         │  或 STORYBOARD_IMAGE（用户选择哪个节点）   │
         │  输入: scenes + style + 角色/场景参考图    │
         │  输出: storyboard-shots (含九宫格+切片)   │
         └─────────────────┬────────────────────────┘
                           │
                           ▼
         ┌──────────────────────────────────────────┐
         │      VIDEO_PROMPT_GENERATOR (新)          │
         │  输入: storyboard-shots + 剧本原文        │
         │  输出: video-prompt[] (逐镜头提示词)      │
         │  内置 Q1-Q8 质检                          │
         └─────────────────┬────────────────────────┘
                           │
                     ┌─────┴─────┐
                     ▼           ▼
              VIDEO_GENERATOR  PLATFORM_SUBMIT (新)
              (AIYOU自有生成)  (即梦/可灵/Sora)
```

### 4.3 三套预设工作流模板

用户开箱即用，也可以基于这些模板自行修改。

**模板 A：一键全自动（对标文档流程）**

```
PROMPT_INPUT → SCRIPT_PARSER → STYLE_PRESET(等待确认) →
  ┌→ CHARACTER_NODE ─┐
  ├→ SCENE_ASSET ────┤
  └→ PROP_ASSET ─────┘
         ↓
  STORYBOARD_GENERATOR → VIDEO_PROMPT_GENERATOR → PLATFORM_SUBMIT
```
执行模式：一键，仅在 STYLE_PRESET 暂停等待用户确认画风。

**模板 B：创作全流程**

```
DRAMA_ANALYZER → DRAMA_REFINED → SCRIPT_PLANNER → SCRIPT_EPISODE →
  SCRIPT_PARSER → (同模板A下游)
```
执行模式：逐节点确认，每步可审阅调整。

**模板 C：分镜快出（已有角色资产）**

```
PROMPT_INPUT → SCRIPT_PARSER → STORYBOARD_GENERATOR →
  VIDEO_PROMPT_GENERATOR → PLATFORM_SUBMIT
```
执行模式：一键，跳过资产生成，直接用项目共享资产池。

### 4.4 节点总表（改造后）

| 节点 | 状态 | 类别 | 输入类型 | 输出类型 |
|------|------|------|----------|----------|
| PROMPT_INPUT | 已有 | 入口 | 用户文本 | string |
| DRAMA_ANALYZER | 待迁移 | 分析 | 剧名 | drama-analysis |
| DRAMA_REFINED | 待迁移 | 分析 | drama-analysis | refined-tags |
| SCRIPT_PLANNER | 待迁移 | 编剧 | string + refined-tags | script-outline |
| SCRIPT_EPISODE | 待迁移 | 编剧 | script-outline | episode-scripts |
| **SCRIPT_PARSER** | **新增** | **标准化** | **string** | **structured-script** |
| STYLE_PRESET | 升级 | 画风 | upstream-context | style-config |
| CHARACTER_NODE | 待迁移 | 资产 | structured-script + style-config | char-assets |
| **SCENE_ASSET** | **新增** | **资产** | **structured-script + style-config** | **scene-assets** |
| **PROP_ASSET** | **新增** | **资产** | **structured-script + style-config** | **prop-assets** |
| STORYBOARD_GENERATOR | 待迁移 | 分镜 | scenes + assets + style | storyboard-shots |
| STORYBOARD_IMAGE | 待迁移 | 分镜 | storyboard-shots + assets | grid-images |
| STORYBOARD_SPLITTER | 已迁移 | 分镜 | grid-images | shot-images |
| **VIDEO_PROMPT_GENERATOR** | **新增** | **提示词** | **storyboard-shots + string** | **video-prompts** |
| IMAGE_GENERATOR | 已迁移 | 生成 | string + style-config | base64-image |
| VIDEO_GENERATOR | 已迁移 | 生成 | string + base64-image | video-uri |
| AUDIO_GENERATOR | 已迁移 | 生成 | string | audio-uri |
| IMAGE_EDITOR | 待迁移 | 工具 | base64-image + string | base64-image |
| VIDEO_ANALYZER | 待迁移 | 工具 | video-uri + string | string |
| **PLATFORM_SUBMIT** | **新增** | **输出** | **video-prompts + images** | **submit-results** |

---

## 五、团队分工与实施节奏

### 5.1 角色划分（假设 4-5 人）

| 角色 | 职责 | 核心交付物 |
|------|------|-----------|
| 架构师 | Project 层、Schema 系统、管线引擎、模板系统 | types.ts 重构、PipelineEngine、PromptTemplate 体系 |
| 节点开发 A | SCRIPT_PARSER、VIDEO_PROMPT_GENERATOR、PLATFORM_SUBMIT | 3 个新节点的 service + component |
| 节点开发 B | SCENE_ASSET、PROP_ASSET、STYLE_PRESET 升级 | 2 个新节点 + 1 个升级节点 |
| 节点迁移 | 10 个待迁移节点的 service 层迁移 | 从 handler 逻辑抽到 service 类 |
| 前端/UX | 项目管理 UI、模板选择器、固化工作流 UI、管线状态面板 | 新增 UI 组件 |

### 5.2 四阶段实施节奏

**Phase 1：地基（2 周）— 架构师主导，全员参与**

```
Week 1:
  - types.ts 重构：Project 类型、PortSchema、Connection 升级（fromPort/toPort）
  - BaseNodeService 升级：inputSchema/outputSchema 声明、重试逻辑
  - PromptTemplate 接口 + 内置模板目录结构

Week 2:
  - PipelineEngine 核心：拓扑排序 + 暂停/恢复 + 跳过失败
  - project.store.ts：项目 CRUD、共享资产池
  - 连线兼容性检查逻辑
```

验收标准：现有 6 个已迁移节点能在新引擎下正常跑通，带重试。

**Phase 2：新节点 + 迁移（3 周）— 并行开发**

```
节点开发 A（并行）:
  - SCRIPT_PARSER service + component + 3套模板
  - VIDEO_PROMPT_GENERATOR service + component + Q1-Q8质检 + 3套节拍模板

节点开发 B（并行）:
  - SCENE_ASSET service + component + 六格图生成逻辑
  - PROP_ASSET service + component + 三视图生成逻辑
  - STYLE_PRESET 升级：双模式切换 + 四段式模板

节点迁移（并行）:
  - 按优先级迁移：SCRIPT_PLANNER → SCRIPT_EPISODE → CHARACTER_NODE →
    STORYBOARD_GENERATOR → STORYBOARD_IMAGE → DRAMA_ANALYZER →
    DRAMA_REFINED → IMAGE_EDITOR → VIDEO_ANALYZER → STYLE_PRESET(基础迁移)
```

验收标准：所有节点都有 service 类，声明了 inputSchema/outputSchema，能独立执行。

**Phase 3：工作流串联 + 平台对接（2 周）**

```
Week 1:
  - 三套预设工作流模板搭建（模板A/B/C）
  - 工作流固化功能：快照保存 + 执行模式配置
  - PLATFORM_SUBMIT 节点 + JimengProvider（浏览器扩展桥接方案）

Week 2:
  - 项目管理 UI：项目切换器、共享资产池面板
  - 模板选择器 UI：节点底部面板集成
  - 管线状态面板：实时进度、失败汇总、暂停/恢复控制
```

验收标准：用户能从模板创建工作流，一键跑通「剧本→分镜→视频提示词→提交即梦」全链路。

**Phase 4：打磨 + 扩展（1 周）**

```
  - 更多平台 Provider：KlingProvider、SoraProvider
  - 提示词模板库扩充：每个节点至少 3 套内置模板
  - 边界场景测试：长剧本、多场景、资产生成失败后的恢复
  - 性能优化：资产并行生成、分镜并行生成
  - 用户自建模板的保存/导入/导出
```

验收标准：端到端稳定运行，失败率 < 5%，用户能自建并固化工作流。

---

## 六、质量最大可控的三道防线

### 防线 1：节点内质检（自动）

每个节点的 `execute()` 方法内置校验逻辑，在返回结果前自检：

| 节点 | 质检项 |
|------|--------|
| SCRIPT_PARSER | JSON 格式完整性、必填字段非空、角色/场景数量合理 |
| STYLE_PRESET | 四段式四个字段都非空、negative 存在、keywords 有分类 |
| CHARACTER_NODE | 角色数与剧本一致、六格图分辨率达标、三视图角度正确 |
| SCENE_ASSET | 六格图六个视角齐全、风格与 STYLE_PRESET 一致 |
| PROP_ASSET | 三视图三个角度齐全 |
| STORYBOARD_GENERATOR | 镜头数量匹配、景别≥4种、无站桩镜头 |
| VIDEO_PROMPT_GENERATOR | Q1-Q8 全部通过（见上文） |
| PLATFORM_SUBMIT | 提交状态确认、失败自动标记 |

质检失败 → 触发节点级重试（自动用 LLM 修复后重新生成）。

### 防线 2：工作流级容错（半自动）

管线引擎层面的保障：

```
节点执行失败（重试耗尽）
    │
    ▼
记录到 state.failures[]
    │
    ▼
跳过该节点，标记下游依赖节点为 skipped
    │
    ▼
继续执行不受影响的分支
    │
    ▼
全部跑完后，汇总失败报告：
  - 哪些节点失败了
  - 失败原因
  - 哪些下游被跳过
  - 「重试失败项」按钮：只重跑失败的节点及其下游
```

用户看到失败汇总后，可以：
- 修改失败节点的输入/模板，点「重试」
- 手动跳过，接受部分结果
- 整条工作流从头重跑

### 防线 3：人工卡点（手动）

固化工作流时设置的 `waitPoints` 就是人工质量关卡：

```
典型卡点设置：

SCRIPT_PARSER 之后 ──→ 用户审阅解析结果，确认角色/场景/道具是否准确
STYLE_PRESET 之后  ──→ 用户确认画风是否符合预期
资产生成之后       ──→ 用户审阅角色/场景/道具图，不满意可重新生成
分镜生成之后       ──→ 用户审阅九宫格，调整镜头描述
视频提示词之后     ──→ 用户逐条审阅/编辑提示词，确认后再提交平台
```

一键模式下只保留 STYLE_PRESET 一个卡点（对标文档的「两次手动操作」）。
逐节点模式下每个节点都是卡点。
自定义模式下用户自己勾选。

---

## 七、改造量评估（决策矩阵）

| 改造项 | 复杂度 | 影响面 | 优先级 | 预估工时 |
|--------|--------|--------|--------|----------|
| types.ts 重构（Project + PortSchema） | 中 | 全局 | P0 | 3d |
| BaseNodeService 升级（schema声明 + 重试） | 中 | 全局 | P0 | 2d |
| PipelineEngine（替换 executeNodesInOrder） | 高 | 全局 | P0 | 5d |
| Connection 升级（fromPort/toPort + 兼容性检查） | 中 | 画布交互 | P0 | 3d |
| PromptTemplate 系统 | 低 | 节点层 | P1 | 2d |
| Project 层 + project.store.ts | 中 | 数据层 | P1 | 3d |
| SCRIPT_PARSER 节点 | 中 | 新节点 | P1 | 3d |
| SCENE_ASSET 节点 | 中 | 新节点 | P1 | 3d |
| PROP_ASSET 节点 | 低 | 新节点 | P1 | 2d |
| VIDEO_PROMPT_GENERATOR 节点 | 高 | 新节点 | P1 | 5d |
| PLATFORM_SUBMIT 节点 | 高 | 新节点 | P2 | 5d |
| STYLE_PRESET 升级（双模式） | 中 | 升级 | P1 | 3d |
| 10个待迁移节点 service 化 | 中 | 迁移 | P1 | 10d |
| 工作流固化 UI | 中 | 前端 | P2 | 3d |
| 管线状态面板 UI | 中 | 前端 | P2 | 3d |
| 预设工作流模板（3套） | 低 | 配置 | P2 | 2d |

总计约 **57 人日**，4-5 人团队约 **8 周**完成。

---

## 八、核心架构变更一句话总结

| 维度 | 现状 | 目标 |
|------|------|------|
| 组织层级 | Workflow → Node | Project → Workflow → Node |
| 连接模型 | `{ from, to }` 无端口 | `{ from, fromPort, to, toPort }` + schema 兼容检查 |
| 执行引擎 | 一次性拓扑排序跑完 | 状态机管线：暂停/恢复/跳过/重试/人工卡点 |
| 节点能力 | 硬编码提示词 | 可更换提示词模板 |
| 画风体系 | 单一 stylePrompt | 简单模式 + 四段式模式可切换 |
| 容错 | 调一次成败 | 节点级重试（3次退避）+ 工作流级跳过继续 |
| 资产类型 | 仅角色 | 角色 + 场景 + 道具，项目级共享池 |
| 输出端 | 仅 AIYOU 内生成 | 通用平台提交（即梦/可灵/Sora） |
```
```
