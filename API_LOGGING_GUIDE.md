# API日志调试系统使用指南

## 概述

为了更好地定位和调试问题，我们实现了一个完整的API日志记录系统。该系统会自动记录所有API请求和响应，帮助开发者快速定位问题。

## 功能特性

### 1. 自动日志记录
- ✅ 自动记录每个API调用的请求参数
- ✅ 记录完整的API响应结构
- ✅ 记录请求耗时
- ✅ 记录错误信息
- ✅ 关联节点ID和类型，便于追踪

### 2. 可视化调试面板
- ✅ 实时显示所有API日志
- ✅ 按状态筛选（全部/成功/失败/进行中）
- ✅ 展开查看详细请求/响应信息
- ✅ 自动刷新（可选）
- ✅ 导出日志为JSON文件
- ✅ 统计信息展示

### 3. 持久化存储
- ✅ 日志自动保存到 localStorage
- ✅ 最多保留100条日志记录
- ✅ 自动清理过期日志

## 使用方法

### 1. 打开调试面板

点击左侧侧边栏的 🐛 (Bug) 图标即可打开API日志调试面板。

### 2. 查看日志

调试面板显示所有API调用的日志，包括：
- **状态图标**: ✅ 成功 / ❌ 失败 / ⏰ 进行中
- **API名称**: 调用的API函数名
- **节点类型**: 关联的节点类型（如果有）
- **时间戳**: 请求发起时间
- **耗时**: 请求完成所需时间

### 3. 查看详细信息

点击任意日志条目可展开查看详细信息：

#### 请求参数
```json
{
  "model": "gemini-2.5-flash-image",
  "prompt": "A beautiful sunset over mountains...",
  "options": {
    "aspectRatio": "16:9",
    "count": 1
  },
  "inputs": ["[Image Data]"]
}
```

#### 响应数据
```json
{
  "success": true,
  "data": {
    "uri": "data:image/png;base64,...",
    "metadata": { ... }
  }
}
```

#### 错误信息（如果失败）
```json
{
  "success": false,
  "error": "GEMINI_API_KEY_NOT_CONFIGURED"
}
```

### 4. 筛选日志

使用顶部的筛选按钮：
- **全部**: 显示所有日志
- **成功**: 仅显示成功的请求
- **错误**: 仅显示失败的请求
- **进行中**: 仅显示正在执行的请求

### 5. 导出日志

点击 📥 (Download) 图标可将所有日志导出为JSON文件，便于：
- 保存问题现场
- 分享给团队成员
- 提交bug报告时附加

### 6. 清除日志

点击 🗑️ (Trash) 图标可清除所有日志记录。

## 技术实现

### 架构

```
┌─────────────────┐
│   App.tsx       │  用户操作触发API调用
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ geminiService   │  包装的API函数
│  - logAPICall() │  自动记录日志
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  apiLogger.ts   │  日志管理服务
│  - startLog()   │  开始记录
│  - endLog()     │  记录成功
│  - errorLog()   │  记录失败
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ DebugPanel.tsx  │  可视化界面
└─────────────────┘
```

### 已集成的API函数

✅ **所有API函数均已集成日志记录**，包括：

#### 多模态生成类
1. **generateImageFromText** - 文字生图
2. **generateVideo** - 视频生成
3. **generateAudio** - 音频生成
4. **editImageWithText** - 图片编辑

#### 内容生成类
5. **sendChatMessage** - 聊天消息
6. **generateScriptPlanner** - 剧本大纲生成
7. **generateScriptEpisodes** - 剧本分集生成
8. **generateDetailedStoryboard** - 详细分镜生成
9. **generateCinematicStoryboard** - 电影分镜生成
10. **planStoryboard** - 分镜规划
11. **orchestrateVideoPrompt** - 视频提示词编排

#### 分析类
12. **analyzeVideo** - 视频分析
13. **analyzeDrama** - 剧目分析
14. **transcribeAudio** - 音频转录

#### 角色生成类
15. **extractCharactersFromText** - 角色提取
16. **generateCharacterProfile** - 角色档案生成

#### 辅助工具类
17. **extractRefinedTags** - 精炼标签提取
18. **generateStylePreset** - 风格预设生成

所有API调用都会自动记录到调试面板，无需额外配置。

### 如何为新API添加日志

在 `geminiService.ts` 中，使用 `logAPICall` 包装函数：

```typescript
import { logAPICall } from './apiLogger';

export const yourApiFunction = async (
    param1: string,
    param2: any,
    context?: { nodeId?: string; nodeType?: string }
): Promise<YourReturnType> => {
    return logAPICall(
        'yourApiFunction',           // API名称
        async () => {
            // 原有的API调用逻辑
            const result = await actualApiCall(param1, param2);
            return result;
        },
        {                            // 请求参数（用于日志）
            param1: param1.substring(0, 200),  // 截断长字符串
            param2
        },
        context                      // 节点上下文（可选）
    );
};
```

然后在调用时传递 context：

```typescript
await yourApiFunction(
    "some input",
    { option: "value" },
    { nodeId: node.id, nodeType: node.type }
);
```

## 调试技巧

### 1. 快速定位失败的API调用
- 筛选器选择"错误"
- 查看错误信息
- 检查请求参数是否正确

### 2. 性能分析
- 查看"耗时"列
- 找出响应慢的API调用
- 优化相关逻辑

### 3. 追踪节点问题
- 通过节点ID定位具体节点
- 查看该节点的所有API调用历史
- 分析请求和响应的变化

### 4. 导出日志用于Bug报告
- 复现问题
- 导出日志JSON文件
- 附加到GitHub Issue或内部工单

## 注意事项

### 数据隐私
- Base64图像/视频数据会被截断为类型标签（如 `[Base64 image/png]`）
- 超长文本会被截断（保留前200字符）
- 敏感信息不会被完整记录

### 性能影响
- 日志记录为异步操作，不影响主流程
- 最多保留100条日志，自动清理旧记录
- LocalStorage存储量有限，只保存最近50条

### 兼容性
- 支持所有现代浏览器
- localStorage API必须可用
- 控制台日志同步输出

## 故障排除

### 问题：日志面板没有显示日志
**解决方案**：
1. 确认已调用包装过的API函数
2. 检查浏览器控制台是否有错误
3. 清除浏览器缓存后重试

### 问题：日志数据丢失
**解决方案**：
1. 检查 localStorage 配额是否已满
2. 导出重要日志后清除旧记录
3. 使用导出功能备份关键日志

### 问题：日志内容不完整
**解决方案**：
1. 这是正常的，超大数据会被截断以节省空间
2. 使用浏览器开发者工具的 Network 标签查看完整数据
3. 在 `apiLogger.ts` 中调整 `sanitizeResponse` 逻辑

## 未来优化方向

- [ ] 支持按节点ID筛选
- [ ] 支持时间范围筛选
- [ ] 添加搜索功能
- [ ] 支持 IndexedDB 存储更多日志
- [ ] 添加日志回放功能
- [ ] 集成错误上报服务

## 反馈

如遇到任何问题或有改进建议，请联系开发团队。
