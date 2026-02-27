/**
 * 节点服务注册入口
 * 在应用启动时导入此文件以注册所有节点服务
 */

import { NodeServiceRegistry } from './index';
import { ImageGeneratorNodeService } from './imageGenerator.service';
import { VideoGeneratorNodeService } from './videoGenerator.service';
import { AudioGeneratorNodeService } from './audioGenerator.service';
import { StoryboardSplitterNodeService } from './storyboardSplitter.service';
import { PromptInputNodeService } from './promptInput.service';
import { StoryboardVideoGeneratorNodeService } from './storyboardVideoGenerator.service';
// Phase 2 新节点
import { ScriptParserService } from './scriptParser.service';
import { SceneAssetService } from './sceneAsset.service';
import { PropAssetService } from './propAsset.service';
import { VideoPromptGeneratorService } from './videoPromptGenerator.service';
import { StylePresetNodeService } from './stylePreset.service';
// Phase 2 Line C 迁移节点
import { ScriptPlannerService } from './scriptPlanner.service';
import { ScriptEpisodeService } from './scriptEpisode.service';
import { CharacterNodeService } from './characterNode.service';
import { StoryboardGeneratorService } from './storyboardGenerator.service';
import { StoryboardImageService } from './storyboardImage.service';
import { DramaAnalyzerService } from './dramaAnalyzer.service';
import { DramaRefinedService } from './dramaRefined.service';
import { ImageEditorService } from './imageEditor.service';
import { VideoAnalyzerService } from './videoAnalyzer.service';
// Phase 3
import { PlatformSubmitService } from './platformSubmit.service';
import { PlatformProvider, PlatformShotRequest } from '../../types';
import { yunwuapiPlatform } from '../videoPlatforms/yunwuapiProvider';

/**
 * 云雾API平台适配器
 * 将 VideoPlatformProvider 适配为 PlatformProvider 接口
 */
const yunwuapiPlatformProvider: PlatformProvider = {
  name: 'yunwuapi',
  label: '云雾API',
  async submit(request: PlatformShotRequest) {
    const model = (request.model ?? 'veo') as any;
    return yunwuapiPlatform.submitTask(model, {
      prompt: request.prompt,
      referenceImageUrl: request.referenceImage,
      config: {
        aspect_ratio: (request.aspectRatio as '16:9' | '9:16') || '16:9',
        duration: String(request.duration || 5) as any,
        quality: (request.quality as any) || 'standard',
      },
    }, '');  // apiKey injected at runtime via context
  },
  async getStatus(taskId: string) {
    const result = await yunwuapiPlatform.checkStatus('veo' as any, taskId, '');
    return { status: result.status, videoUrl: result.videoUrl };
  },
  async checkAvailability() {
    return true; // yunwuapi is always available if configured
  },
};

/**
 * 注册所有节点服务
 */
export function registerAllNodeServices(): void {
  // 注册核心节点服务
  NodeServiceRegistry.register('PROMPT_INPUT', PromptInputNodeService);
  NodeServiceRegistry.register('IMAGE_GENERATOR', ImageGeneratorNodeService);
  NodeServiceRegistry.register('VIDEO_GENERATOR', VideoGeneratorNodeService);
  NodeServiceRegistry.register('AUDIO_GENERATOR', AudioGeneratorNodeService);
  NodeServiceRegistry.register('STORYBOARD_SPLITTER', StoryboardSplitterNodeService);
  NodeServiceRegistry.register('STORYBOARD_VIDEO_GENERATOR', StoryboardVideoGeneratorNodeService);
  // Phase 2 Line C 迁移节点（替换旧注释占位）
  NodeServiceRegistry.register('SCRIPT_PLANNER', ScriptPlannerService);
  NodeServiceRegistry.register('SCRIPT_EPISODE', ScriptEpisodeService);
  NodeServiceRegistry.register('CHARACTER_NODE', CharacterNodeService);
  NodeServiceRegistry.register('STORYBOARD_GENERATOR', StoryboardGeneratorService);
  NodeServiceRegistry.register('STORYBOARD_IMAGE', StoryboardImageService);
  NodeServiceRegistry.register('IMAGE_EDITOR', ImageEditorService);
  NodeServiceRegistry.register('VIDEO_ANALYZER', VideoAnalyzerService);
  NodeServiceRegistry.register('DRAMA_ANALYZER', DramaAnalyzerService);
  NodeServiceRegistry.register('DRAMA_REFINED', DramaRefinedService);

  // Phase 2 新节点
  NodeServiceRegistry.register('SCRIPT_PARSER', ScriptParserService);
  NodeServiceRegistry.register('SCENE_ASSET', SceneAssetService);
  NodeServiceRegistry.register('PROP_ASSET', PropAssetService);
  NodeServiceRegistry.register('VIDEO_PROMPT_GENERATOR', VideoPromptGeneratorService);
  NodeServiceRegistry.register('STYLE_PRESET', StylePresetNodeService);
  // Phase 3
  NodeServiceRegistry.register('PLATFORM_SUBMIT', PlatformSubmitService);

  // 注册平台提交 Provider（填充 PlatformSubmitService.providers Map）
  PlatformSubmitService.registerProvider(yunwuapiPlatformProvider);
}

/**
 * 导出服务注册表供外部使用
 */
export { NodeServiceRegistry } from './index';
export * from './baseNode.service';
export { ImageGeneratorNodeService } from './imageGenerator.service';
export { VideoGeneratorNodeService } from './videoGenerator.service';
export { AudioGeneratorNodeService } from './audioGenerator.service';
export { StoryboardSplitterNodeService } from './storyboardSplitter.service';
export { PromptInputNodeService } from './promptInput.service';
export { StoryboardVideoGeneratorNodeService } from './storyboardVideoGenerator.service';
// Phase 2 新节点导出
export { ScriptParserService } from './scriptParser.service';
export { SceneAssetService } from './sceneAsset.service';
export { PropAssetService } from './propAsset.service';
export { VideoPromptGeneratorService } from './videoPromptGenerator.service';
export { StylePresetNodeService } from './stylePreset.service';
export { BUILT_IN_TEMPLATES } from './stylePreset.service';
// Phase 2 Line C 迁移节点导出
export { ScriptPlannerService } from './scriptPlanner.service';
export { ScriptEpisodeService } from './scriptEpisode.service';
export { CharacterNodeService } from './characterNode.service';
export { StoryboardGeneratorService } from './storyboardGenerator.service';
export { StoryboardImageService } from './storyboardImage.service';
export { DramaAnalyzerService } from './dramaAnalyzer.service';
export { DramaRefinedService } from './dramaRefined.service';
export { ImageEditorService } from './imageEditor.service';
export { VideoAnalyzerService } from './videoAnalyzer.service';
// Phase 3
export { PlatformSubmitService } from './platformSubmit.service';
