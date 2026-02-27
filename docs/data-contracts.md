# 数据契约文档 — 节点间数据流转格式定义

> P0 文档，所有节点开发前必须对齐
> 创建时间: 2026-02-27
> 配合 architecture-plan.md 使用

## 约定

- 所有数据通过节点端口（Port）流转，端口类型标识即本文档中的 `type` 字段
- 下游节点通过 `context.getInputData(fromNodeId, portKey)` 获取上游输出
- 可选字段用 `?` 标注，缺省时下游节点应有合理降级逻辑
- Base64 图片统一前缀 `data:image/png;base64,`

---

## 1. structured-script

> SCRIPT_PARSER 输出 | 全链路最关键的数据格式
> 所有下游节点（角色提取、场景提取、分镜生成等）的数据源

```typescript
interface StructuredScript {
  title: string;                    // 剧名
  genre: string;                    // 题材类型：都市/古装/悬疑/科幻...
  totalEpisodes: number;            // 总集数
  episodeDuration: number;          // 单集时长（秒）
  visualStyle: 'REAL' | 'ANIME' | '3D';  // 视觉风格

  // 世界观与背景
  worldview: string;                // 世界观描述
  setting: string;                  // 时代/地点背景

  // 角色表
  characters: ScriptCharacter[];

  // 分集内容
  episodes: ScriptEpisode[];
}

interface ScriptCharacter {
  id: string;                       // 角色标识，如 "char_001"
  name: string;                     // 角色名
  role: 'protagonist' | 'antagonist' | 'supporting' | 'extra';
  age: string;                      // "26岁" 或 "中年"
  gender: string;
  appearance: string;               // 外貌描述（用于生图 prompt）
  personality: string;              // 性格特征
  motivation?: string;              // 核心动机
  relationships?: string;           // 与其他角色的关系
}

interface ScriptEpisode {
  episodeNumber: number;            // 集号，从 1 开始
  title: string;                    // 集标题
  synopsis: string;                 // 本集梗概（100-200字）
  scenes: ScriptScene[];
}

interface ScriptScene {
  sceneNumber: number;              // 场景序号
  location: string;                 // 地点
  timeOfDay: string;                // 时间：白天/夜晚/黄昏/清晨
  characters: string[];             // 出场角色 id 列表
  description: string;              // 场景描述
  dialogue: DialogueLine[];         // 对白
  props?: string[];                 // 关键道具
  mood: string;                     // 情绪氛围
}

interface DialogueLine {
  characterId: string;              // 说话角色 id
  line: string;                     // 台词内容
  direction?: string;               // 表演指示，如 "(愤怒地)"
}
```

**边界情况：**
- 无对白的场景：`dialogue` 为空数组，不省略字段
- 群演/路人：`role` 为 `'extra'`，`appearance` 写通用描述
- 用户粘贴的非标准剧本：SCRIPT_PARSER 需尽力解析，无法识别的部分放入 `synopsis`

---

## 2. style-config

> STYLE_PRESET 输出 | 项目级画风配置，一次生成全项目复用

```typescript
interface StyleConfig {
  mode: 'simple' | 'fourPart';

  // simple 模式 — 一句话风格描述
  stylePrompt?: string;             // "赛博朋克风格，霓虹灯光，暗色调"

  // fourPart 模式 — 四段式画风体系
  prefix?: string;                  // 前置锁定词，如 "masterpiece, best quality"
  lens?: string;                    // 焦距/景别，如 "85mm portrait lens, shallow DOF"
  scene?: string;                   // 画面描述基调，如 "cyberpunk city, neon lights"
  lighting?: string;                // 光影描述，如 "dramatic rim lighting, volumetric fog"

  // 通用字段
  visualStyle: 'REAL' | 'ANIME' | '3D';
  negativePrompt?: string;          // 全局反向提示词
  templateId?: string;              // 使用的模板 ID（可溯源）
}
```

**兼容现有：** 现有 `node.data.stylePrompt` 等价于 `mode: 'simple'` + `stylePrompt`

---

## 3. char-assets

> CHARACTER_NODE 输出 | 角色视觉资产，存入项目级 SharedAssets

```typescript
interface CharAssets {
  characters: CharacterAsset[];
}

interface CharacterAsset {
  id: string;                       // 对应 ScriptCharacter.id
  name: string;
  appearance: string;               // 外貌描述文本
  expressionSheet?: string;         // 表情九宫格图（Base64）
  threeViewSheet?: string;          // 三视图（Base64）
  referenceImages?: string[];       // 额外参考图（Base64 数组）
  promptZh?: string;                // 生成用中文 prompt（可复用）
  promptEn?: string;                // 生成用英文 prompt
  status: 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED';
}
```

**兼容现有：** 直接复用 `CharacterProfile` 的核心字段，去掉 UI 状态字段

---

## 4. scene-assets

> SCENE_ASSET 输出（新节点）| 场景视觉资产

```typescript
interface SceneAssets {
  scenes: SceneAsset[];
}

interface SceneAsset {
  id: string;                       // 场景标识，如 "scene_001"
  name: string;                     // 场景名，如 "林府大厅"
  location: string;                 // 地点描述
  timeVariants: SceneVariant[];     // 不同时间段的视觉变体
  referenceGrid?: string;           // 2x3 六格环境参考图（Base64）
  promptZh?: string;
  promptEn?: string;
  status: 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED';
}

interface SceneVariant {
  timeOfDay: string;                // 白天/夜晚/黄昏/清晨
  description: string;              // 该时段的视觉描述
  lightingNote?: string;            // 光影补充说明
}
```

---

## 5. prop-assets

> PROP_ASSET 输出（新节点）| 道具视觉资产

```typescript
interface PropAssets {
  props: PropAsset[];
}

interface PropAsset {
  id: string;                       // 道具标识，如 "prop_001"
  name: string;                     // 道具名，如 "玉佩"
  description: string;              // 外观描述
  threeViewSheet?: string;          // 三视图（Base64）
  referenceImages?: string[];       // 参考图
  promptZh?: string;
  promptEn?: string;
  status: 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED';
}
```

---

## 6. storyboard-shots

> STORYBOARD_GENERATOR 输出 | 分镜镜头列表
> 复用现有 DetailedStoryboardShot，新增与 structured-script 的关联

```typescript
interface StoryboardOutput {
  episodeNumber: number;
  totalDuration: number;            // 总时长（秒）
  visualStyle: string;              // 继承自 StyleConfig
  shots: EnhancedStoryboardShot[];
}

// 复用现有 DetailedStoryboardShot，补充关联字段
interface EnhancedStoryboardShot extends DetailedStoryboardShot {
  sceneRef?: string;                // 关联 ScriptScene.sceneNumber
  characterRefs?: string[];         // 关联 ScriptCharacter.id 列表
  propRefs?: string[];              // 关联 PropAsset.id 列表
}
```

**兼容现有：** DetailedStoryboardShot 字段全部保留，新增 ref 字段为可选

---

## 7. video-prompt

> VIDEO_PROMPT_GENERATOR 输出（新节点）| 逐镜头视频生成指令

```typescript
interface VideoPromptOutput {
  shots: VideoShotPrompt[];
}

interface VideoShotPrompt {
  shotId: string;                   // 关联 StoryboardShot.id
  shotNumber: number;
  prompt: string;                   // 最终视频生成提示词
  negativePrompt?: string;
  duration: number;                 // 建议时长（秒）
  aspectRatio: string;              // "16:9" | "9:16"
  referenceImageId?: string;        // 关联的分镜图 ID
  qualityCheck: QualityCheckResult; // Q1-Q8 质检结果
}

interface QualityCheckResult {
  passed: boolean;
  score: number;                    // 0-100
  checks: {
    q1_noStaticPose: boolean;       // 非站桩
    q2_noAxisCross: boolean;        // 无跳轴
    q3_shotSizeConsistent: boolean; // 景别合理
    q4_motionClear: boolean;        // 运动描述清晰
    q5_lightingMatch: boolean;      // 光影匹配
    q6_characterConsistent: boolean;// 角色一致
    q7_sceneConsistent: boolean;    // 场景一致
    q8_promptLength: boolean;       // 提示词长度合理
  };
  suggestions?: string[];           // 未通过项的修改建议
}
```

---

## 8. platform-submit-request

> PLATFORM_SUBMIT 输入（新节点）| 通用视频生成平台提交请求

```typescript
interface PlatformSubmitRequest {
  provider: string;                 // "jimeng" | "kling" | "sora"
  shots: PlatformShotRequest[];
  config: PlatformConfig;
}

interface PlatformShotRequest {
  shotId: string;
  prompt: string;                   // 来自 VideoShotPrompt.prompt
  referenceImage?: string;          // Base64，来自分镜图
  duration: number;
  aspectRatio: string;
}

interface PlatformConfig {
  model?: string;                   // 平台特定模型名
  quality?: string;                 // "standard" | "high"
  batchSize?: number;               // 并发提交数，默认 1
  retryOnFail?: boolean;
}
```

---

## 9. 端口类型兼容性矩阵

> 连线时校验用：输出端口 type → 可连接的输入端口 type

| 输出端口 type | 可连接的输入端口 type |
|---|---|
| `structured-script` | `script-input`（CHARACTER_NODE, SCENE_ASSET, PROP_ASSET, STORYBOARD_GENERATOR） |
| `style-config` | `style-input`（CHARACTER_NODE, SCENE_ASSET, PROP_ASSET, STORYBOARD_GENERATOR, STORYBOARD_IMAGE） |
| `char-assets` | `char-input`（STORYBOARD_GENERATOR, VIDEO_PROMPT_GENERATOR） |
| `scene-assets` | `scene-input`（STORYBOARD_GENERATOR, VIDEO_PROMPT_GENERATOR） |
| `prop-assets` | `prop-input`（STORYBOARD_GENERATOR） |
| `storyboard-shots` | `storyboard-input`（STORYBOARD_IMAGE, STORYBOARD_SPLITTER, VIDEO_PROMPT_GENERATOR） |
| `video-prompt` | `prompt-input`（PLATFORM_SUBMIT） |
| `text` | `text`（通用文本，向后兼容现有节点） |
| `base64-image` | `base64-image`（通用图片） |
| `video-url` | `video-url`（通用视频） |

**规则：**
- 同 type 可连，不同 type 灰显不可连
- `text` 类型是万能兼容类型，可连接任何接受文本的输入端口
- 未声明端口的旧节点默认 `fromPort: 'default', toPort: 'default'`，type 为 `text`
