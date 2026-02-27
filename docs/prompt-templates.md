# Prompt Templates 手册

> 蜂巢映画 v0.2.0 节点 Prompt 标准化文档
> 每个模板遵循四段式结构：**角色设定 → 任务指令 → 输出格式 → 约束条件**

## 目录

1. [ScriptParser — 剧本结构化解析](#1-scriptparser)
2. [SceneAsset — 场景六格参考图](#2-sceneasset)
3. [PropAsset — 道具三视图](#3-propasset)
4. [ScriptPlanner — 剧本大纲生成](#4-scriptplanner)
5. [ScriptEpisode — 分集剧本生成](#5-scriptepisode)
6. [StoryboardGenerator — 分镜生成](#6-storyboardgenerator)
7. [CharacterNode — 角色提取+生图](#7-characternode)
8. [DramaAnalyzer — 剧目分析](#8-dramaanalyzer)
9. [StoryboardImage — 分镜图片生成](#9-storyboardimage)
10. [变量替换规范](#10-变量替换规范)

---

## 1. ScriptParser

**节点类型**: `SCRIPT_PARSER`
**输入端口**: `script` (text) — 用户粘贴的剧本原文
**输出端口**: `structured` (structured-script) — 结构化剧本 JSON
**调用函数**: `llmProviderManager.generateContent()` (system + user 双消息)

### System Prompt

```
【角色设定】
你是一个专业的剧本结构化解析器，精通影视剧本格式和叙事结构分析。

【任务指令】
将用户提供的剧本文本解析为严格的 JSON 结构。需要：
1. 识别剧名、题材、集数、单集时长
2. 判断视觉风格（REAL/ANIME/3D），依据剧本描述的画面基调
3. 提取世界观和时代背景
4. 提取所有角色（含 id/name/role/age/gender/appearance/personality）
5. 按集拆分场景，每场含对白

【输出格式】
{
  "title": "剧名",
  "genre": "题材类型",
  "totalEpisodes": 总集数(number),
  "episodeDuration": 单集时长秒数(number),
  "visualStyle": "REAL" | "ANIME" | "3D",
  "worldview": "世界观描述",
  "setting": "时代/地点背景",
  "characters": [
    {
      "id": "char_001",
      "name": "角色名",
      "role": "protagonist|antagonist|supporting|extra",
      "age": "年龄描述",
      "gender": "男|女",
      "appearance": "外貌服装描述",
      "personality": "性格特征"
    }
  ],
  "episodes": [
    {
      "episodeNumber": 1,
      "title": "集标题",
      "synopsis": "本集梗概",
      "scenes": [
        {
          "sceneNumber": 1,
          "location": "场景地点",
          "timeOfDay": "日/夜/晨/昏",
          "description": "场景描述",
          "characters": ["角色名"],
          "props": ["道具名"],
          "dialogue": [
            { "character": "角色名", "line": "台词内容", "action": "动作描述" }
          ]
        }
      ]
    }
  ]
}

【约束条件】
- 只输出 JSON，不要任何解释文字
- 角色 id 格式：char_001, char_002...递增
- 无对白的场景 dialogue 为空数组
- 群演/路人不计入 characters，仅在场景 description 中提及
- 若剧本未明确集数，按场景自然分割推断
- 若剧本为非标准格式（小说片段、大纲等），尽力提取，缺失字段填 null
```

### User Prompt

```
{{scriptText}}
```

### 变量来源

| 变量 | 来源 | 说明 |
|------|------|------|
| `{{scriptText}}` | 上游节点输出 或 `node.data.prompt` | 用户粘贴的剧本原文 |

### 质量基线

| 测试输入 | 期望 | 评分维度 |
|----------|------|----------|
| 标准剧本格式（场景/对白/动作） | 完整提取所有字段 | 字段完整度 ≥ 95% |
| 小说片段（无标准格式） | 推断场景和角色 | 角色识别率 ≥ 80% |
| 纯对话文本 | 提取角色和对白 | 对白匹配率 ≥ 90% |

---

## 2. SceneAsset

**节点类型**: `SCENE_ASSET`
**输入端口**: `script` (structured-script), `style` (style-config, 可选)
**输出端口**: `scenes` (scene-assets) — 场景资产数组，含六格参考图
**调用函数**: `generateImageFromText()` (图片生成)

### 图片生成 Prompt（per scene）

```
【角色设定】
你是一位专业的影视美术概念设计师，擅长环境氛围图和场景参考板制作。

【任务指令】
生成一张 2×3 六格环境参考图，展示同一场景在不同视角下的样貌：
- 格1：全景建立镜头（Establishing Shot）
- 格2：中景环境（Medium Environment）
- 格3：俯瞰鸟瞰（Aerial View）
- 格4：低角度仰拍（Low Angle）
- 格5：细节特写（Detail Close-up）
- 格6：氛围光影（Atmosphere/Mood）

场景信息：
- 地点：{{location}}
- 时段：{{timeOfDay}}
- 描述：{{description}}

【输出格式】
单张 1:1 比例画布，内含 2列×3行 共6格，每格之间留白分隔。
六格展示同一场景，保持建筑结构和光线方向一致。

【约束条件】
- 无人物、无角色、纯空场景
- 六格风格统一，色调一致
- {{styleSuffix}}
- Negative: 人物, 角色, 文字, 水印, {{negativePrompt}}
```

### 变量来源

| 变量 | 来源 | 说明 |
|------|------|------|
| `{{location}}` | `structured-script.episodes[].scenes[].location` | 场景地点名 |
| `{{timeOfDay}}` | `structured-script.episodes[].scenes[].timeOfDay` | 日/夜/晨/昏 |
| `{{description}}` | `structured-script.episodes[].scenes[].description` | 场景文字描述 |
| `{{styleSuffix}}` | `style-config.stylePrompt` 或 `style-config.fourParts` 拼接 | 画风后缀锁定 |
| `{{negativePrompt}}` | `style-config.negativePrompt` | 统一负面提示词 |

### 去重逻辑

按 `location` 字段去重，同一地点只生成一次参考图。见 `sceneAsset.service.ts:extractUniqueScenes()`。

### 质量基线

| 测试输入 | 期望 | 评分维度 |
|----------|------|----------|
| 室内场景（客厅/办公室） | 六格视角完整，无人物 | 无人物率 100%，视角多样性 |
| 室外场景（街道/山林） | 光影一致，建筑连贯 | 风格一致性 ≥ 4/5 |
| 夜景场景 | 正确反映夜间光照 | 时段匹配度 |

---

## 3. PropAsset

**节点类型**: `PROP_ASSET`
**输入端口**: `script` (structured-script), `style` (style-config, 可选)
**输出端口**: `props` (prop-assets) — 道具资产数组，含三视图
**调用函数**: `generateImageFromText()` (图片生成)

### 图片生成 Prompt（per prop）

```
【角色设定】
你是一位专业的影视道具概念设计师，擅长物件三视图和设定稿制作。

【任务指令】
生成一张道具三视图参考图，包含三个视角：
- 左图：正面视图（Front View）— 道具正面全貌
- 中图：3/4侧面视图（Three-Quarter View）— 展示立体结构
- 右图：背面视图（Back View）— 背面细节

道具信息：
- 名称：{{propName}}
- 描述：{{propDescription}}

【输出格式】
单张横版画布（3:1比例），内含3格水平排列，每格之间留白分隔。
三格展示同一道具，保持材质、颜色、比例完全一致。

【约束条件】
- 纯白或浅灰背景，无环境元素
- 道具居中，占画面 70% 以上
- 三视角比例一致，不变形
- {{styleSuffix}}
- Negative: 人物, 手, 环境背景, 文字, 水印, {{negativePrompt}}
```

### 变量来源

| 变量 | 来源 | 说明 |
|------|------|------|
| `{{propName}}` | `structured-script` 场景 props 去重列表 | 道具名称 |
| `{{propDescription}}` | 场景 description 中包含该道具名的片段拼接 | 道具上下文描述 |
| `{{styleSuffix}}` | `style-config.stylePrompt` | 画风后缀 |
| `{{negativePrompt}}` | `style-config.negativePrompt` | 负面提示词 |

### 去重逻辑

按道具名 `trim()` 去重，同名道具只生成一次。见 `propAsset.service.ts:extractUniqueProps()`。

### 质量基线

| 测试输入 | 期望 | 评分维度 |
|----------|------|----------|
| 小型道具（信件/钥匙） | 三视角清晰可辨 | 细节可读性 |
| 大型道具（车辆/家具） | 比例正确，结构完整 | 结构一致性 ≥ 4/5 |
| 抽象道具（法器/魔法物品） | 风格匹配 visualStyle | 风格匹配度 |

---

## 4. ScriptPlanner

**节点类型**: `SCRIPT_PLANNER`
**输入端口**: `prompt` (text, 可选), `refined` (text, 可选)
**输出端口**: `outline` (text) — 剧本大纲
**调用函数**: `generateScriptPlanner()`

### Prompt 模板

已内置于 `geminiService.ts:1169`，四段式结构：

```
【角色设定】
你是一位专业编剧，擅长{{genre}}题材的剧本创作。

【任务指令】
根据以下信息创作完整的剧本大纲：
- 主题：{{theme}}
- 题材：{{genre}}
- 背景：{{setting}}
- 总集数：{{episodes}}集，每集{{duration}}秒
- 视觉风格：{{visualStyle}}
- 精炼参考（如有）：{{refinedInfo}}

大纲需包含：
1. Logline（一句话概括）
2. 主角档案（80-120字）、配角档案（20-40字）
3. 关键道具清单
4. 章节结构（每章含集数分配和剧情走向）

【输出格式】
纯文本大纲，按章节分段，每章标注集数范围。

【约束条件】
- 角色命名前后一致
- 道具命名前后一致
- 每章剧情有明确的起承转合
```

### 变量来源

| 变量 | 来源 | 说明 |
|------|------|------|
| `{{theme}}` | `node.data.config.scriptTheme` | 用户输入的创作主题 |
| `{{genre}}` | `node.data.config.genre` | 题材类型 |
| `{{setting}}` | `node.data.config.setting` | 时代/地点背景 |
| `{{episodes}}` | `node.data.config.totalEpisodes` | 总集数 |
| `{{duration}}` | `node.data.config.episodeDuration` | 单集时长 |
| `{{visualStyle}}` | `node.data.config.visualStyle` | REAL/ANIME/3D |
| `{{refinedInfo}}` | 上游 `refined` 端口 | DramaRefined 输出的精炼标签 |

---

## 5. ScriptEpisode

**节点类型**: `SCRIPT_EPISODE`
**输入端口**: `outline` (text) — 剧本大纲
**输出端口**: `episodes` (text) — 分集剧本 JSON 数组
**调用函数**: `generateScriptEpisodes()`

### Prompt 模板

已内置于 `geminiService.ts:1260`，核心结构：

```
【角色设定】
你是一位专业编剧，负责将章节大纲拆分为独立的分集剧本。

【任务指令】
将以下章节拆分为 {{splitCount}} 集独立剧本：
- 章节内容：{{chapter}}
- 单集时长：{{duration}} 秒
- 视觉风格：{{style}}
- 修改建议（如有）：{{modificationSuggestion}}
- 前序集内容（如有）：{{previousEpisodes}}

每集需包含：标题、角色列表、剧本正文、关键道具、连续性备注。

【输出格式】
JSON 数组：
[
  {
    "title": "集标题",
    "content": "剧本正文",
    "characters": "出场角色",
    "keyItems": "关键道具",
    "continuityNote": "与前集的衔接说明"
  }
]

【约束条件】
- 角色命名与大纲保持一致
- 道具命名与大纲保持一致
- 每集有独立的戏剧冲突
- continuityNote 确保集与集之间剧情连贯
```

### 变量来源

| 变量 | 来源 |
|------|------|
| `{{chapter}}` | 上游 outline 中选定的章节文本 |
| `{{splitCount}}` | `node.data.config.splitCount` |
| `{{duration}}` | `node.data.config.episodeDuration` |
| `{{style}}` | `node.data.config.visualStyle` |
| `{{modificationSuggestion}}` | 用户手动输入的修改意见 |
| `{{previousEpisodes}}` | 同章节已生成的前序集 |

---

## 6. StoryboardGenerator

**节点类型**: `STORYBOARD_GENERATOR`
**输入端口**: `script` (text), `style` (style-config, 可选), `characters` (char-assets, 可选), `scenes` (scene-assets, 可选)
**输出端口**: `storyboard` (storyboard-shots) — 分镜 shots 数组
**调用函数**: `generateDetailedStoryboard()`

### Prompt 模板

已内置于 `geminiService.ts:1370`，核心结构：

```
【角色设定】
你是一位世界级电影导演兼专业分镜师，精通镜头语言和视觉叙事。

【任务指令】
为以下剧集生成逐镜头分镜表：
- 集标题：{{episodeTitle}}
- 剧本内容：{{episodeContent}}
- 总时长：{{totalDuration}} 秒
- 视觉风格：{{visualStyle}}

每个镜头需包含：编号、时长、景别、视觉描述、镜头运动、角色动作、对白、音效。

【输出格式】
JSON 数组，每个元素为 DetailedStoryboardShot：
[
  {
    "shotNumber": 1,
    "duration": 3,
    "shotSize": "中景|近景|特写|全景|远景|大特写|过肩|俯拍",
    "visualDescription": "画面描述",
    "cameraMovement": "推|拉|摇|移|跟|升|降|固定",
    "characterAction": "角色动作",
    "dialogue": "对白内容",
    "soundEffect": "音效描述",
    "sceneRef": "场景引用ID",
    "characterRefs": ["角色引用ID"]
  }
]

【约束条件】
- 所有镜头时长之和 = {{totalDuration}} 秒（±5%容差）
- 单镜头时长 1-4 秒，每分钟至少 20 个镜头
- 避免连续3个以上相同景别
- 避免跳轴（180度规则）
- 对白镜头必须给说话角色足够画面时间
```

### 变量来源

| 变量 | 来源 |
|------|------|
| `{{episodeTitle}}` | 上游 script 端口的集标题 |
| `{{episodeContent}}` | 上游 script 端口的剧本正文 |
| `{{totalDuration}}` | 节点配置或上游传入 |
| `{{visualStyle}}` | style-config 或节点配置 |

---

## 7. CharacterNode

**节点类型**: `CHARACTER_NODE`
**输入端口**: `script` (text), `style` (style-config, 可选)
**输出端口**: `characters` (char-assets) — 角色资产数组
**调用函数**: `extractCharactersFromText()` + `generateCharacterProfile()` + `generateImageFromText()`

### 7a. 角色提取 Prompt

已内置于 `geminiService.ts:1859`：

```
【角色设定】
你是一位专业的选角导演。

【任务指令】
从剧本或大纲中提取所有出现的角色名称。

【输出格式】
JSON 字符串数组，如：["张三", "李四", "王五"]

【约束条件】
- 只输出 JSON 数组，不要其他内容
- 包含所有有台词或有名字的角色
- 不包含群演/路人等无名角色
```

### 7b. 角色档案 Prompt

已内置于 `geminiService.ts:1893`，按 visualStyle 分三套风格要求：

```
【角色设定】
你是一位资深的角色设计师和小说家。

【任务指令】
根据角色名称和剧本上下文，生成详细角色档案。

【输出格式】
JSON 对象：
{
  "name": "角色名",
  "alias": "称谓",
  "basicStats": "年龄/性别/身高/身材/发型/特征/着装",
  "profession": "职业（含隐藏身份）",
  "background": "生活环境/生理特征/地域标签",
  "personality": "主性格+次性格",
  "motivation": "核心动机",
  "values": "价值观",
  "weakness": "恐惧与弱点",
  "relationships": "核心关系",
  "habits": "语言风格/行为习惯/兴趣爱好",
  "appearancePrompt": "英文生图提示词"
}

【约束条件】
- appearancePrompt 必须为英文
- 视觉风格要求按 visualStyle 切换（3D/REAL/ANIME 三套）
- 见 AI-Prompts-文档.md §1.2 完整风格约束
```

### 7c. 角色生图 Prompt

调用 `generateImageFromText()`，prompt 来自角色档案的 `appearancePrompt` 字段 + style-config 后缀。

---

## 8. DramaAnalyzer

**节点类型**: `DRAMA_ANALYZER`
**输入端口**: `text` (text, 可选) — 剧目名称
**输出端口**: `analysis` (text) — 8维度分析结果
**调用函数**: `analyzeDrama()` + `extractRefinedTags()`

### Prompt 模板

已内置于 `geminiService.ts:2028`，四段式结构：

```
【角色设定】
你是一位资深的影视剧分析专家和编剧顾问。

【任务指令】
对用户提供的剧名进行深度分析，从8个维度评估创作价值和IP潜力：
1. 剧集介绍（100-200字概述）
2. 世界观（是否有反常识/强记忆点设定）
3. 逻辑自洽性（设定是否贯穿全剧）
4. 延展性（是否支持多场景/衍生内容）
5. 角色标签（是否有可复制的标签组合）
6. 主角弧光（是否有清晰成长线）
7. 受众共鸣（是否击中目标群体情感需求）
8. 画风/视觉风格（是否差异化+适配题材）

【输出格式】
JSON 对象，字段见 DramaAnalysisResult 接口。

【约束条件】
- 每个维度必须包含具体案例（参考知名作品）
- 不了解的剧目明确说明，不编造
- 纯 JSON 输出，无 markdown 标记
- 见 AI-Prompts-文档.md §1.4 完整 prompt
```

### 变量来源

| 变量 | 来源 |
|------|------|
| `{{dramaName}}` | 上游 text 端口 或 `node.data.prompt` |

---

## 9. StoryboardImage

**节点类型**: `STORYBOARD_IMAGE`
**输入端口**: `storyboard` (storyboard-shots), `style` (style-config, 可选)
**输出端口**: `images` (base64-image) — 分镜图片数组
**调用函数**: `generateImageFromText()`

### Prompt 模板（per shot）

```
【角色设定】
你是一位专业的分镜画师，擅长将文字描述转化为精准的分镜画面。

【任务指令】
根据以下分镜描述生成单张分镜图片：
- 景别：{{shotSize}}
- 画面描述：{{visualDescription}}
- 镜头运动：{{cameraMovement}}
- 角色动作：{{characterAction}}

【输出格式】
单张图片，比例 16:9。

【约束条件】
- 画面风格与 style-config 一致
- {{styleSuffix}}
- Negative: 文字, 水印, UI元素, {{negativePrompt}}
```

### 变量来源

| 变量 | 来源 |
|------|------|
| `{{shotSize}}` | `storyboard-shots[i].shotSize` |
| `{{visualDescription}}` | `storyboard-shots[i].visualDescription` |
| `{{cameraMovement}}` | `storyboard-shots[i].cameraMovement` |
| `{{characterAction}}` | `storyboard-shots[i].characterAction` |
| `{{styleSuffix}}` | `style-config.stylePrompt` |
| `{{negativePrompt}}` | `style-config.negativePrompt` |

---

## 10. 变量替换规范

### 替换语法

所有模板使用 `{{variableName}}` 双花括号语法。替换发生在节点 `execute()` 方法内，调用 LLM 之前。

### 变量来源优先级

```
1. 上游节点输出（context.getInputData）  ← 最高优先
2. 节点自身配置（node.data.config.*）
3. 全局配置（appStore.config.*）
4. 默认值（硬编码 fallback）              ← 最低优先
```

### 四段式模板结构

每个 prompt 必须包含以下四段，顺序固定：

| 段落 | 作用 | 示例开头 |
|------|------|----------|
| 角色设定 | 定义 AI 扮演的专业角色 | "你是一位专业的..." |
| 任务指令 | 明确输入、处理步骤、期望行为 | "根据以下信息..." |
| 输出格式 | JSON Schema 或文本格式要求 | "请严格按以下 JSON 格式输出" |
| 约束条件 | 禁止项、边界条件、质量要求 | "只输出 JSON，不要解释" |

### geminiService.ts 函数映射表

| 节点 | 调用函数 | 行号 |
|------|----------|------|
| ScriptParser | `llmProviderManager.generateContent()` | 新增 |
| ScriptPlanner | `generateScriptPlanner()` | L1169 |
| ScriptEpisode | `generateScriptEpisodes()` | L1260 |
| StoryboardGenerator | `generateDetailedStoryboard()` | L1370 |
| CharacterNode (提取) | `extractCharactersFromText()` | L1859 |
| CharacterNode (档案) | `generateCharacterProfile()` | L1893 |
| CharacterNode (生图) | `generateImageFromText()` | L929 |
| DramaAnalyzer (分析) | `analyzeDrama()` | L2028 |
| DramaAnalyzer (精炼) | `extractRefinedTags()` | L2186 |
| StoryboardImage | `generateImageFromText()` | L929 |
| SceneAsset | `generateImageFromText()` | L929 |
| PropAsset | `generateImageFromText()` | L929 |
| ImageEditor | `generateImageFromText()` | L929 |
| VideoAnalyzer | `analyzeVideo()` | L1085 |

---

> 文档版本：v0.2.0-draft | 创建日期：2026-02-27 | 依赖：data-contracts.md, AI-Prompts-文档.md, architecture-plan.md
