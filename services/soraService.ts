/**
 * Sora 2 API 服务
 * 封装 Sora 2 文/图生视频 API 调用
 */

import { SoraTaskGroup, SplitStoryboardShot, Sora2UserConfig } from '../types';
import { getSoraApiKey, getSoraModelById, getOSSConfig, DEFAULT_SORA2_CONFIG } from './soraConfigService';
import { getUserDefaultModel } from './modelConfig';
import { logAPICall } from './apiLogger';
import { uploadFileToOSS } from './ossService';

export interface SoraSubmitResult {
  id: string;
  task_id?: string;  // 支持新 API 的字段名
  object: string;
  model: string;
  status: string;
  progress: number;
  createdAt: number;
  size: string;
}

export interface SoraVideoResult {
  taskId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  videoUrl?: string; // 无水印视频
  videoUrlWatermarked?: string; // 有水印视频
  duration?: string;
  quality: string;
  isCompliant: boolean;
  violationReason?: string;
}

/**
 * 构建 Sora 2 分镜模式提示词
 */
export function buildSoraStoryPrompt(shots: SplitStoryboardShot[]): string {
  return shots.map((shot, index) => {
    const duration = shot.duration || 5;
    const scene = shot.visualDescription || '';

    return `Shot ${index + 1}:
duration: ${duration.toFixed(1)}sec
Scene: ${scene}`;
  }).join('\n\n');
}

/**
 * 使用 AI 生成增强的 Sora 2 提示词
 * 包含镜头、运镜、拍摄视角等专业影视术语
 */

/**
 * 从 API 响应中提取任务 ID（兼容多种格式）
 */
function extractTaskId(result: any): string {
  // 直接的 id 字段
  if (result.id) return result.id;
  // task_id 字段
  if (result.task_id) return result.task_id;
  // 嵌套在 data 中
  if (result.data?.id) return result.data.id;
  if (result.data?.task_id) return result.data.task_id;
  // 嵌套在 result 中
  if (result.result?.id) return result.result.id;
  if (result.result?.task_id) return result.result.task_id;

  throw new Error('无法从 API 响应中提取任务 ID: ' + JSON.stringify(result));
}

/**
 * 提交 Sora 2 视频生成任务
 * 使用新的 /v2/videos/generations 接口
 */
export async function submitSoraTask(
  soraPrompt: string,
  referenceImageUrl?: string,
  sora2Config?: { aspect_ratio: '16:9' | '9:16'; duration: '10' | '15' | '25'; hd: boolean },
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraSubmitResult> {
  const apiKey = getSoraApiKey();
  if (!apiKey) {
    throw new Error('请先在设置中配置 Sora 2 API Key');
  }

  // 使用 Sora2 配置或默认值
  const config = sora2Config || DEFAULT_SORA2_CONFIG;

  const requestBody = {
    prompt: soraPrompt,
    model: 'sora-2',
    images: referenceImageUrl ? [referenceImageUrl] : [],
    aspect_ratio: config.aspect_ratio,
    duration: config.duration,
    hd: config.hd,
    watermark: true,
    private: true
  };

  return logAPICall(
    'submitSoraTask',
    async () => {
      // 使用本地代理服务器绕过 CORS
      const apiUrl = 'http://localhost:3001/api/sora/generations';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sora API 错误: ${response.status} - ${errorText}`);
      }

      const result: SoraSubmitResult = await response.json();

      // 验证并提取任务 ID
      const taskId = extractTaskId(result);
      console.log('[Sora Service] 提交成功，任务 ID:', taskId);

      // 确保 id 字段存在
      if (!result.id) {
        result.id = taskId;
      }

      return result;
    },
    {
      aspectRatio: config.aspect_ratio,
      duration: config.duration,
      hd: config.hd,
      hasReferenceImage: !!referenceImageUrl,
      promptLength: soraPrompt.length,
      promptPreview: soraPrompt.substring(0, 200) + (soraPrompt.length > 200 ? '...' : '')
    },
    context
  );
}

/**
 * 查询 Sora 任务进度
 * 使用新的 /v2/videos/generations/{task_id} 接口
 */
export async function checkSoraTaskStatus(
  taskId: string,
  onProgress?: (progress: number) => void,
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraVideoResult> {
  const apiKey = getSoraApiKey();
  if (!apiKey) {
    throw new Error('请先在设置中配置 Sora 2 API Key');
  }

  return logAPICall(
    'checkSoraTaskStatus',
    async () => {
      // 使用本地代理服务器绕过 CORS
      const apiUrl = `http://localhost:3001/api/sora/generations/${taskId}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sora API 错误: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();

      // 添加详细日志
      const progressNum = parseInt(String(data.progress)) || 0;
      console.log('[Sora Service] API Response:', {
        taskId,
        status: data.status,
        progress: data.progress,
        progressNum: progressNum,
        hasOutput: !!data.output,
        hasUrl: !!data.url,
        hasVideoUrl: !!data.video_url,
        // 打印所有可能的视频 URL 字段
        allFields: Object.keys(data),
        urlField: data.url,
        videoUrlField: data.video_url,
        outputUrl: data.output?.url,
        rawData: JSON.stringify(data).substring(0, 800)
      });

      // 更新进度
      if (onProgress && data.progress !== undefined) {
        onProgress(data.progress);
      }

      // 检查是否违规（quality 字段：standard=正常，其他值=违规说明或错误原因）
      const isCompliant = data.quality === 'standard';
      const violationReason = isCompliant ? undefined : (data.quality || '内容审核未通过');

      // 处理错误状态（重试6次后仍失败，quality 包含具体错误原因）
      if (data.status === 'error') {
        return {
          taskId: data.id,
          status: 'error',
          progress: data.progress || 0,
          videoUrl: undefined,
          videoUrlWatermarked: undefined,
          duration: undefined,
          quality: data.quality || 'unknown',
          isCompliant: false,
          violationReason: violationReason || '视频生成失败，系统重试6次后仍未成功'
        };
      }

      // 正常状态处理 - 支持多种可能的响应格式
      return {
        taskId: data.id || data.task_id,
        status: data.status,
        progress: progressNum,
        // 新 API: data.output 包含视频 URL
        videoUrl: data.data?.output || data.output?.url || data.output || data.url || data.video_url || data.result?.url || data.video?.url,
        videoUrlWatermarked: data.data?.watermark_output || data.output?.watermark_url || data.watermark_url || data.watermarked_url || data.watermark?.url,
        duration: data.data?.duration || data.output?.duration || data.seconds || data.duration || data.video?.duration,
        quality: data.quality || 'standard',
        isCompliant: isCompliant,
        violationReason: violationReason,
        // 保存原始数据以便调试
        _rawData: data
      };
    },
    {
      taskId,
      hasProgressCallback: !!onProgress
    },
    context
  );
}

/**
 * 轮询 Sora 任务直到完成
 */
export async function pollSoraTaskUntilComplete(
  taskId: string,
  onProgress?: (progress: number) => void,
  pollingInterval: number = 5000,
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraVideoResult> {
  let attempts = 0;
  const maxAttempts = 240; // 增加到 240 次（20分钟）

  while (attempts < maxAttempts) {
    const result = await checkSoraTaskStatus(taskId, onProgress, context);

    console.log('[Sora Service] Polling result:', {
      attempt: attempts + 1,
      taskId,
      status: result.status,
      progress: result.progress,
      hasVideoUrl: !!result.videoUrl
    });

    // 支持多种完成状态
    const isCompleted = result.status === 'completed' ||
                       result.status === 'succeeded' ||
                       result.status === 'success' ||
                       result.status === 'SUCCESS' ||  // 支持大写
                       result.status === 'done' ||
                       result.status === 'finished';

    const isError = result.status === 'error' ||
                    result.status === 'failed' ||
                    result.status === 'failure' ||
                    result.status === 'FAILED';  // 支持大写

    // 将进度转换为数字进行比较
    const progressNum = parseInt(String(result.progress)) || 0;

    // 当进度达到 100% 或状态为完成时，返回结果
    if (isCompleted || progressNum >= 100) {
      console.log('[Sora Service] Task completed:', {
        taskId,
        status: result.status,
        videoUrl: result.videoUrl,
        isCompliant: result.isCompliant
      });

      // 如果没有 videoUrl，检查其他可能的字段
      if (!result.videoUrl) {
        console.warn('[Sora Service] No videoUrl found, raw result:', result);
        // 尝试从原始数据中查找
        if (result._rawData) {
          console.log('[Sora Service] Raw data keys:', Object.keys(result._rawData));
          console.log('[Sora Service] Raw data:', JSON.stringify(result._rawData, null, 2));
        }
      }

      return { ...result, status: 'completed' as const };
    }

    if (isError) {
      console.log('[Sora Service] Task error:', {
        taskId,
        status: result.status,
        violationReason: result.violationReason
      });
      return { ...result, status: 'error' as const };
    }

    attempts++;

    // 等待后重试
    await new Promise(resolve => setTimeout(resolve, pollingInterval));
  }

  // 超时前最后尝试一次查询
  console.log('[Sora Service] Max attempts reached, doing final check...');
  const finalResult = await checkSoraTaskStatus(taskId, undefined, context);
  console.log('[Sora Service] Final check result:', finalResult);

  if (finalResult.videoUrl || finalResult.status === 'completed') {
    return { ...finalResult, status: 'completed' as const };
  }

  throw new Error('任务超时，请稍后手动查看结果');
}

/**
 * 完整的 Sora 视频生成流程
 */
export async function generateSoraVideo(
  taskGroup: SoraTaskGroup,
  onProgress?: (message: string, progress: number) => void,
  context?: { nodeId?: string; nodeType?: string }
): Promise<SoraVideoResult> {
  try {
    // 1. 检查是否已提交过任务
    if (taskGroup.soraTaskId && taskGroup.generationStatus === 'generating') {
      onProgress?.(`继续轮询任务 ${taskGroup.soraTaskId}...`, taskGroup.progress || 0);
    } else {
      // 2. 准备参考图片 URL（如果是 base64 则上传到 OSS）
      let referenceImageUrl = taskGroup.referenceImage;

      if (referenceImageUrl && referenceImageUrl.startsWith('data:')) {
        // Base64 格式，需要上传到 OSS
        onProgress?.('正在上传参考图片到 OSS...', 5);

        const ossConfig = getOSSConfig();
        if (!ossConfig) {
          throw new Error('图生视频需要配置 OSS，请先在设置中配置阿里云 OSS');
        }

        try {
          const fileName = `sora-reference-${taskGroup.id}-${Date.now()}.png`;
          referenceImageUrl = await uploadFileToOSS(referenceImageUrl, fileName, ossConfig);
          console.log('[Sora Service] Reference image uploaded to OSS:', referenceImageUrl);

          // 更新任务组的 referenceImage 为 OSS URL
          taskGroup.referenceImage = referenceImageUrl;
        } catch (error: any) {
          console.error('[Sora Service] Failed to upload reference image:', error);
          throw new Error(`参考图片上传失败: ${error.message}`);
        }
      }

      // 3. 提交新任务
      onProgress?.('正在提交 Sora 2 任务...', 10);

      const submitResult = await submitSoraTask(
        taskGroup.soraPrompt,
        referenceImageUrl,
        taskGroup.sora2Config,
        context
      );

      console.log('[Sora Service] submitResult:', JSON.stringify(submitResult));

      taskGroup.soraTaskId = submitResult.id;

      if (!taskGroup.soraTaskId) {
        throw new Error('提交任务后未返回有效的任务 ID');
      }

      console.log('[Sora Service] 任务 ID 已设置:', taskGroup.soraTaskId);
      taskGroup.generationStatus = 'generating';
    }

    // 3. 轮询直到完成
    onProgress?.('正在生成视频，请耐心等待...', 10);

    const result = await pollSoraTaskUntilComplete(
      taskGroup.soraTaskId!,
      (progress) => {
        taskGroup.progress = progress;
        onProgress?.(`视频生成中... ${progress}%`, progress);
      },
      5000,
      context
    );

    // 4. 更新状态
    if (result.status === 'completed') {
      taskGroup.generationStatus = 'completed';
      taskGroup.progress = 100;
      taskGroup.videoMetadata = {
        duration: parseFloat(result.duration || '0'),
        resolution: '1080p',
        fileSize: 0,
        createdAt: new Date()
      };
    } else if (result.status === 'error') {
      taskGroup.generationStatus = 'failed';
      // 使用具体的错误原因
      const errorReason = result.violationReason || result.quality || '生成失败，请重试';
      taskGroup.error = `生成失败: ${errorReason}`;
    }

    return result;

  } catch (error: any) {
    console.error('[Sora Service] Generate video failed:', error);
    taskGroup.generationStatus = 'failed';
    taskGroup.error = error.message || '生成失败';
    throw error;
  }
}

/**
 * 批量生成多个任务组的视频
 */
export async function generateMultipleSoraVideos(
  taskGroups: SoraTaskGroup[],
  onProgress?: (taskIndex: number, message: string, progress: number) => void,
  context?: { nodeId?: string; nodeType?: string }
): Promise<Map<string, SoraVideoResult>> {
  const results = new Map<string, SoraVideoResult>();

  for (let i = 0; i < taskGroups.length; i++) {
    const taskGroup = taskGroups[i];

    try {
      onProgress?.(i, `正在生成任务组 ${taskGroup.taskNumber}...`, 0);

      const result = await generateSoraVideo(taskGroup, (msg, progress) => {
        onProgress?.(i, msg, progress);
      }, context);

      results.set(taskGroup.id, result);

      if (!result.isCompliant) {
        console.warn(`[Sora Service] Task ${taskGroup.taskNumber} violated content policy:`, result.violationReason);
      }

    } catch (error: any) {
      console.error(`[Sora Service] Task ${taskGroup.taskNumber} failed:`, error);
      results.set(taskGroup.id, {
        taskId: taskGroup.id,
        status: 'error',
        progress: 0,
        quality: 'error',
        isCompliant: false
      });
    }
  }

  return results;
}
