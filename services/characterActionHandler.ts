/**
 * 角色操作处理服务
 * 使用新的角色生成管理器进行状态管理
 */

import { characterGenerationManager } from './characterGenerationManager';
import { generateCharacterProfile, detectTextInImage } from './geminiService';
import { generateImageWithFallback } from './geminiServiceWithFallback';
import { getUserDefaultModel, getUserPriority } from './modelConfig';
import { AppNode } from '../types';
import { NodeType } from '../types';
import { promptManager } from './promptManager';

/**
 * 处理角色操作
 * @param nodeId 节点ID
 * @param action 操作类型
 * @param charName 角色名称
 * @param node 当前节点
 * @param allNodes 所有节点
 * @param onNodeUpdate 节点更新回调
 * @param customPrompt 可选的自定义提示词（用于重新生成）
 */
export async function handleCharacterAction(
  nodeId: string,
  action: 'DELETE' | 'SAVE' | 'RETRY' | 'GENERATE_EXPRESSION' | 'GENERATE_THREE_VIEW' | 'GENERATE_SINGLE' | 'GENERATE_ALL',
  charName: string,
  node: AppNode,
  allNodes: AppNode[],
  onNodeUpdate: (nodeId: string, updates: any) => void,
  customPrompt?: { expressionPrompt?: string; threeViewPrompt?: string }
) {
  console.log('[CharacterAction] handleCharacterAction START:', { nodeId, action, charName });

  switch (action) {
    case 'DELETE':
      handleDelete(nodeId, charName, onNodeUpdate, allNodes);
      break;

    case 'SAVE':
      await handleSave(nodeId, charName, node, allNodes, onNodeUpdate);
      break;

    case 'RETRY':
      await handleRetry(nodeId, charName, node, allNodes, onNodeUpdate);
      break;

    case 'GENERATE_EXPRESSION':
      await handleGenerateExpression(nodeId, charName, node, allNodes, onNodeUpdate, customPrompt?.expressionPrompt);
      break;

    case 'GENERATE_THREE_VIEW':
      await handleGenerateThreeView(nodeId, charName, node, allNodes, onNodeUpdate, customPrompt?.threeViewPrompt);
      break;

    case 'GENERATE_SINGLE':
      await handleGenerateSingle(nodeId, charName, node, allNodes, onNodeUpdate);
      break;

    case 'GENERATE_ALL':
      await handleGenerateAll(nodeId, charName, node, allNodes, onNodeUpdate);
      break;
  }

  console.log('[CharacterAction] handleCharacterAction COMPLETE');
  // 注意：不再在此处调用 updateNodeUI，各 handler 内部已负责更新
}

/**
 * 删除角色
 * 关键：从manager和node.data中完全删除角色
 */
function handleDelete(nodeId: string, charName: string, onNodeUpdate: (nodeId: string, updates: any) => void, allNodes: AppNode[]) {
  console.log('[CharacterAction] handleDelete:', { nodeId, charName });

  // 1. 从manager中删除
  characterGenerationManager.deleteCharacter(nodeId, charName);

  // 2. 从node.data中删除
  const node = allNodes.find(n => n.id === nodeId);
  if (node?.data) {
    // 2.1 从generatedCharacters中删除
    const generatedCharacters = (node.data.generatedCharacters || [])
      .filter(c => c.name !== charName);

    // 2.2 从characterConfigs中删除
    const characterConfigs = { ...node.data.characterConfigs };
    delete characterConfigs[charName];

    // 2.3 从extractedCharacterNames中删除（如果存在）
    const extractedCharacterNames = (node.data.extractedCharacterNames || [])
      .filter((name: string) => name !== charName);

    console.log('[CharacterAction] Deleting from node.data:', {
      charName,
      beforeCount: node.data.generatedCharacters?.length || 0,
      afterCount: generatedCharacters.length,
      removedFromConfigs: !!node.data.characterConfigs?.[charName],
      removedFromExtracted: extractedCharacterNames.length < (node.data.extractedCharacterNames?.length || 0)
    });

    // 3. 一次性更新所有变更
    onNodeUpdate(nodeId, {
      generatedCharacters,
      characterConfigs,
      extractedCharacterNames
    });
  } else {
    console.warn('[CharacterAction] Node not found, only deleting from manager');
    // 如果找不到node，至少更新UI（从manager获取数据）
    updateNodeUI(nodeId, onNodeUpdate, allNodes);
  }

  console.log('[CharacterAction] Character deleted successfully:', charName);
}

/**
 * 保存角色
 */
async function handleSave(
  nodeId: string,
  charName: string,
  node: AppNode,
  allNodes: AppNode[],
  onNodeUpdate: (nodeId: string, updates: any) => void
) {
  console.log('[CharacterAction] handleSave:', { nodeId, charName });

  const state = characterGenerationManager.getCharacterState(nodeId, charName);
  if (!state) {
    console.error('[CharacterAction] Character not found:', charName);
    return;
  }

  // 如果没有三视图，先生成三视图
  if (!state.threeViewSheet) {
    await handleGenerateThreeView(nodeId, charName, node, allNodes, onNodeUpdate);
  }

  // 标记为已保存
  characterGenerationManager.saveCharacter(nodeId, charName);
  updateNodeUI(nodeId, onNodeUpdate, allNodes);

  // TODO: 保存到资产历史（如果需要）
}

/**
 * 重试生成角色档案（重新生成）
 */
async function handleRetry(
  nodeId: string,
  charName: string,
  node: AppNode,
  allNodes: AppNode[],
  onNodeUpdate: (nodeId: string, updates: any) => void
) {
  console.log('[CharacterAction] handleRetry (regenerate profile):', { nodeId, charName });

  // 立即更新 UI 为生成中状态
  const existingChars = node.data.generatedCharacters || [];
  const charExists = existingChars.some(c => c.name === charName);
  if (charExists) {
    onNodeUpdate(nodeId, {
      generatedCharacters: existingChars.map(c =>
        c.name === charName ? { ...c, status: 'GENERATING' } : c
      )
    });
  } else {
    onNodeUpdate(nodeId, {
      generatedCharacters: [...existingChars, { id: '', name: charName, status: 'GENERATING' } as any]
    });
  }

  // 获取角色配置
  const config = node.data.characterConfigs?.[charName] || { method: 'AI_AUTO' };
  console.log('[CharacterAction] Character config:', { charName, method: config.method });

  // 获取上游上下文
  const context = getUpstreamContext(node, allNodes);
  const stylePrompt = getStylePrompt(node, allNodes);

  try {
    let profile: any;

    if (config.method === 'SUPPORTING_ROLE') {
      // 配角：使用简化生成方法
      console.log('[CharacterAction] Using SUPPORTING_ROLE method for:', charName);
      const { generateSupportingCharacter } = await import('./geminiService');

      profile = await characterGenerationManager.generateProfile(
        nodeId,
        charName,
        async () => {
          console.log('[CharacterAction] Calling generateSupportingCharacter API for:', charName);
          const result = await generateSupportingCharacter(
            charName,
            context,
            stylePrompt,
            getUserDefaultModel('text'),
            { nodeId, nodeType: node.type }
          );
          console.log('[CharacterAction] generateSupportingCharacter returned for:', charName, 'hasBasicStats:', !!result?.basicStats);
          return result;
        }
      );
    } else {
      // 主角：使用完整生成方法
      console.log('[CharacterAction] Using AI_AUTO/MAIN method for:', charName);

      profile = await characterGenerationManager.generateProfile(
        nodeId,
        charName,
        async () => {
          console.log('[CharacterAction] Calling generateCharacterProfile API for:', charName);
          const result = await generateCharacterProfile(
            charName,
            context,
            stylePrompt,
            undefined,
            getUserDefaultModel('text'),
            { nodeId, nodeType: node.type }
          );
          console.log('[CharacterAction] generateCharacterProfile returned for:', charName, {
            hasBasicStats: !!result?.basicStats,
            basicStatsValue: result?.basicStats,
            hasProfession: !!result?.profession,
            professionValue: result?.profession,
            hasPersonality: !!result?.personality,
            personalityValue: result?.personality,
            hasAppearance: !!result?.appearance,
            appearanceValue: result?.appearance,
            allKeys: result ? Object.keys(result) : 'null result',
            fullResult: result
          });
          return result;
        }
      );
    }

    console.log('[CharacterAction] Profile regenerated successfully:', charName, 'hasBasicStats:', !!profile?.basicStats);
  } catch (error) {
    console.error('[CharacterAction] Profile regeneration failed:', charName, error);
  }

  console.log('[CharacterAction] Calling updateNodeUI after profile regeneration for:', charName);
  updateNodeUI(nodeId, onNodeUpdate, allNodes);
}

/**
 * 生成表情图
 */
async function handleGenerateExpression(
  nodeId: string,
  charName: string,
  node: AppNode,
  allNodes: AppNode[],
  onNodeUpdate: (nodeId: string, updates: any) => void,
  customPrompt?: string
) {
  console.log('[CharacterAction] handleGenerateExpression:', { nodeId, charName, hasCustomPrompt: !!customPrompt });

  let state = characterGenerationManager.getCharacterState(nodeId, charName);

  // 如果管理器中没有这个角色，先尝试从node.data恢复
  if (!state) {
    console.log('[CharacterAction] Character state not found in manager, checking node.data:', charName);

    // 从node.data中查找角色数据
    const existingCharacter = node.data.generatedCharacters?.find(c => c.name === charName);

    if (existingCharacter && (existingCharacter.basicStats || existingCharacter.profession)) {
      console.log('[CharacterAction] Found character in node.data, restoring to manager:', charName);
      // 初始化并恢复profile数据
      state = characterGenerationManager.initializeCharacter(nodeId, charName);
      if (existingCharacter.basicStats) {
        characterGenerationManager.updateCharacterState(nodeId, charName, {
          profile: existingCharacter,
          profileStatus: 'SUCCESS'
        });
        // 重新获取更新后的 state，避免直接 mutation
        state = characterGenerationManager.getCharacterState(nodeId, charName)!;
      }
    } else {
      console.log('[CharacterAction] Character not found in node.data, initializing empty state:', charName);
      state = characterGenerationManager.initializeCharacter(nodeId, charName);
    }
  } else {
    console.log('[CharacterAction] Character state exists:', charName, 'profileStatus:', state.profileStatus, 'hasProfile:', !!state.profile);
  }

  // 检查是否有 profile 数据
  if (!state?.profile) {
    alert('角色档案未生成，请先生成角色档案');
    return;
  }

  const stylePrompt = getStylePrompt(node, allNodes);
  const { style: styleType } = getUpstreamStyleContextFromNode(node, allNodes);

  // 立即更新node.data，让UI显示生成中状态
  const nodeCharacter = node.data.generatedCharacters?.find(c => c.name === charName);
  if (nodeCharacter) {
    onNodeUpdate(nodeId, {
      generatedCharacters: node.data.generatedCharacters.map(c =>
        c.name === charName ? { ...c, isGeneratingExpression: true } : c
      )
    });
  }

  try {
    // 添加超时保护（5分钟超时）
    const timeoutMs = 5 * 60 * 1000;
    let timeoutId: NodeJS.Timeout;
    
    const expressionSheet = await Promise.race([
      characterGenerationManager.generateExpression(
        nodeId,
        charName,
        async () => {
          // 使用自定义提示词或使用promptManager生成提示词
          let expressionPromptPair: { zh: string; en: string };

          if (customPrompt) {
            expressionPromptPair = {
              zh: customPrompt,
              en: customPrompt
            };
          } else {
            // 使用promptManager生成中英文提示词，传递风格类型
            expressionPromptPair = promptManager.buildExpressionPrompt(stylePrompt, state.profile, undefined, styleType);
          }

          // 存储提示词到state（通过 updateCharacterState 避免直接 mutation）
          characterGenerationManager.updateCharacterState(nodeId, charName, {
            expressionPromptZh: expressionPromptPair.zh,
            expressionPromptEn: expressionPromptPair.en
          } as any);

          const userPriority = getUserPriority('image');
          const initialModel = userPriority[0] || 'gemini-3-pro-image-preview';

          console.log('[CharacterAction] Generating expression with model:', initialModel);

          // 添加文字检测和重试逻辑
          let exprImages: string[] = [];
          let hasText = true;
          let attempt = 0;
          const MAX_ATTEMPTS = 3;

          console.log('[CharacterAction] Starting expression generation with text detection, attempts:', MAX_ATTEMPTS);

          while (hasText && attempt < MAX_ATTEMPTS) {
            let currentPrompt = expressionPromptPair.zh;

            if (attempt > 0) {
              // 重试时加强负面提示词
              currentPrompt = currentPrompt + " NO TEXT. NO LABELS. NO LETTERS. NO CHINESE CHARACTERS. NO ENGLISH TEXT. NO WATERMARKS. CLEAN IMAGE ONLY.";
              console.log(`[CharacterAction] Retrying expression generation (Attempt ${attempt + 1}/${MAX_ATTEMPTS}) with enhanced negative prompt`);
            }

            console.log(`[CharacterAction] 🔧 Calling generateImageWithFallback with options:`, {
              aspectRatio: '1:1',
              count: 1,
              promptPreview: currentPrompt.substring(0, 50)
            });

            exprImages = await generateImageWithFallback(
              currentPrompt,
              initialModel,
              [],
              { aspectRatio: '1:1', count: 1 },
              { nodeId, nodeType: node.type }
            );

            if (exprImages.length > 0) {
              hasText = await detectTextInImage(exprImages[0]);
              if (hasText) {
                console.log(`[CharacterAction] Text detected in expression sheet (Attempt ${attempt + 1}/${MAX_ATTEMPTS}). Retrying...`);
              } else {
                console.log(`[CharacterAction] No text detected in expression sheet (Attempt ${attempt + 1}/${MAX_ATTEMPTS}). Success!`);
              }
            }
            attempt++;
          }

          if (!exprImages || exprImages.length === 0) {
            throw new Error('表情图生成失败：API未返回图片数据');
          }

          // 如果最终还是有文字，警告用户但仍然返回图片
          if (hasText) {
            console.warn('[CharacterAction] Expression sheet still has text after all retries. Returning anyway.');
          }

          return exprImages[0];
        }
      ),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('表情图生成超时，请检查网络连接或API配置'));
        }, timeoutMs);
      })
    ]).finally(() => {
      clearTimeout(timeoutId);
    }) as string;

    console.log('[CharacterAction] Expression sheet generated successfully:', charName);
    // 添加成功反馈
    alert(`✅ 九宫格表情生成成功：${charName}`);
  } catch (error) {
    console.error('[CharacterAction] Expression sheet generation failed:', charName, error);

    // 立即清除node.data中的生成中状态
    const nodeCharacter = node.data.generatedCharacters?.find(c => c.name === charName);
    if (nodeCharacter) {
      onNodeUpdate(nodeId, {
        generatedCharacters: node.data.generatedCharacters.map(c =>
          c.name === charName ? { ...c, isGeneratingExpression: false, expressionError: String(error) } : c
        )
      });
    }

    // 关键：将manager中的状态设置为FAILED，避免一直卡在PROCESSING
    try {
      characterGenerationManager.updateCharacterState(nodeId, charName, {
        expressionStatus: 'FAILED'
      });
      console.log('[CharacterAction] Updated expressionStatus to FAILED after error:', charName);
    } catch (updateError) {
      console.error('[CharacterAction] Failed to update expressionStatus:', updateError);
    }

    alert(`九宫格表情生成失败：${error}`);
  }

  updateNodeUI(nodeId, onNodeUpdate, allNodes);
}

/**
 * 生成三视图
 */
async function handleGenerateThreeView(
  nodeId: string,
  charName: string,
  node: AppNode,
  allNodes: AppNode[],
  onNodeUpdate: (nodeId: string, updates: any) => void,
  customPrompt?: string
) {
  console.log('[CharacterAction] handleGenerateThreeView:', { nodeId, charName, hasCustomPrompt: !!customPrompt });

  let state = characterGenerationManager.getCharacterState(nodeId, charName);

  // 如果管理器中没有这个角色，先尝试从node.data恢复
  if (!state) {
    console.log('[CharacterAction] Character state not found in manager, checking node.data:', charName);

    // 从node.data中查找角色数据
    const existingCharacter = node.data.generatedCharacters?.find(c => c.name === charName);

    if (existingCharacter && (existingCharacter.basicStats || existingCharacter.profession)) {
      console.log('[CharacterAction] Found character in node.data, restoring to manager:', charName);
      // 初始化并恢复profile数据
      state = characterGenerationManager.initializeCharacter(nodeId, charName);
      if (existingCharacter.basicStats) {
        characterGenerationManager.updateCharacterState(nodeId, charName, {
          profile: existingCharacter,
          profileStatus: 'SUCCESS'
        });
      }
      // 同时恢复expressionSheet（如果有）
      if (existingCharacter.expressionSheet) {
        characterGenerationManager.updateCharacterState(nodeId, charName, {
          expressionSheet: existingCharacter.expressionSheet,
          expressionStatus: 'SUCCESS'
        } as any);
      }
      // 重新获取更新后的 state，避免直接 mutation
      state = characterGenerationManager.getCharacterState(nodeId, charName)!;
    } else {
      console.log('[CharacterAction] Character not found in node.data, initializing empty state:', charName);
      state = characterGenerationManager.initializeCharacter(nodeId, charName);
    }
  } else {
    console.log('[CharacterAction] Character state exists:', charName,
      'profileStatus:', state.profileStatus,
      'expressionStatus:', state.expressionStatus,
      'hasProfile:', !!state.profile,
      'hasExpression:', !!state.expressionSheet);
  }

  // 检查是否有 profile 数据
  if (!state?.profile) {
    alert('角色档案未生成，请先生成角色档案');
    return;
  }

  // 检查是否已生成表情图（仅主角需要）
  const character = node.data.generatedCharacters?.find(c => c.name === charName);
  const isSupportingRole = character?.roleType === 'supporting';

  if (!isSupportingRole && !state?.expressionSheet) {
    alert('请先生成九宫格表情图，再生成三视图。三视图基于九宫格表情图生成。');
    return;
  }

  // 配角可以直接生成三视图（不需要九宫格）
  if (isSupportingRole && !state?.expressionSheet) {
    console.log('[CharacterAction] Supporting character generating three-view without expression sheet');
  }

  const stylePrompt = getStylePrompt(node, allNodes);
  const { style: styleType } = getUpstreamStyleContextFromNode(node, allNodes);

  // 立即更新node.data，让UI显示生成中状态
  const nodeCharacter = node.data.generatedCharacters?.find(c => c.name === charName);
  if (nodeCharacter) {
    onNodeUpdate(nodeId, {
      generatedCharacters: node.data.generatedCharacters.map(c =>
        c.name === charName ? { ...c, isGeneratingThreeView: true } : c
      )
    });
  }

  try {
    // 添加超时保护（5分钟超时）
    const timeoutMs = 5 * 60 * 1000;
    let timeoutId: NodeJS.Timeout;

    const threeViewSheet = await Promise.race([
      characterGenerationManager.generateThreeView(
        nodeId,
        charName,
        async () => {
          // 使用自定义提示词或使用promptManager生成提示词
          let viewPrompt: string;
          let threeViewPromptPair: { zh: string; en: string };

          if (customPrompt) {
            viewPrompt = customPrompt;
            threeViewPromptPair = {
              zh: customPrompt,
              en: customPrompt
            };
          } else {
            // 使用promptManager生成中英文提示词，传递风格类型
            threeViewPromptPair = promptManager.buildThreeViewPrompt(stylePrompt, state.profile, undefined, styleType);
            viewPrompt = threeViewPromptPair.zh; // 使用中文版本生成
          }

          // 存储提示词到state（通过 updateCharacterState 避免直接 mutation）
          characterGenerationManager.updateCharacterState(nodeId, charName, {
            threeViewPromptZh: threeViewPromptPair.zh,
            threeViewPromptEn: threeViewPromptPair.en
          } as any);

          const negativePrompt = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui, username, website, chinese characters, info box, stats, descriptions, annotations";

          // 使用九宫格表情作为参考图片
          const inputImages = state.expressionSheet ? [state.expressionSheet] : [];

          let viewImages: string[] = [];
          let hasText = true;
          let attempt = 0;
          const MAX_ATTEMPTS = 3;

          console.log('[CharacterAction] Starting 3-view generation, attempts:', MAX_ATTEMPTS);

          while (hasText && attempt < MAX_ATTEMPTS) {
            if (attempt > 0) {
              const retryPrompt = viewPrompt + " NO TEXT. NO LABELS. CLEAR BACKGROUND.";
              viewImages = await generateImageWithFallback(
                retryPrompt,
                getUserDefaultModel('image'),
                inputImages,
                { aspectRatio: '16:9', resolution: '1K', count: 1 },
                { nodeId, nodeType: node.type }
              );
            } else {
              viewImages = await generateImageWithFallback(
                viewPrompt,
                getUserDefaultModel('image'),
                inputImages,
                { aspectRatio: '16:9', resolution: '1K', count: 1 },
                { nodeId, nodeType: node.type }
              );
            }

            if (viewImages.length > 0) {
              hasText = await detectTextInImage(viewImages[0]);
              if (hasText) {
                console.log(`Text detected in generated 3-view (Attempt ${attempt + 1}/${MAX_ATTEMPTS}). Retrying...`);
              }
            }
            attempt++;
          }

          if (!viewImages || viewImages.length === 0) {
            throw new Error('三视图生成失败：API未返回图片数据');
          }

          return viewImages[0];
        }
      ),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('三视图生成超时，请检查网络连接或API配置'));
        }, timeoutMs);
      })
    ]).finally(() => {
      clearTimeout(timeoutId);
    }) as string;

    console.log('[CharacterAction] Three-view sheet generated successfully:', charName);
    // 添加成功反馈
    alert(`✅ 三视图生成成功：${charName}`);
  } catch (error) {
    console.error('[CharacterAction] Three-view sheet generation failed:', charName, error);

    // 立即清除node.data中的生成中状态
    const nodeCharacter = node.data.generatedCharacters?.find(c => c.name === charName);
    if (nodeCharacter) {
      onNodeUpdate(nodeId, {
        generatedCharacters: node.data.generatedCharacters.map(c =>
          c.name === charName ? { ...c, isGeneratingThreeView: false, threeViewError: String(error) } : c
        )
      });
    }

    // 关键：将manager中的状态设置为FAILED，避免一直卡在PROCESSING
    try {
      characterGenerationManager.updateCharacterState(nodeId, charName, {
        threeViewStatus: 'FAILED'
      });
      console.log('[CharacterAction] Updated threeViewStatus to FAILED after error:', charName);
    } catch (updateError) {
      console.error('[CharacterAction] Failed to update threeViewStatus:', updateError);
    }

    alert(`三视图生成失败：${error}`);
  }

  updateNodeUI(nodeId, onNodeUpdate, allNodes);
}

/**
 * 生成单个角色（仅生成档案，需要手动点击生成九宫格和三视图）
 */
async function handleGenerateSingle(
  nodeId: string,
  charName: string,
  node: AppNode,
  allNodes: AppNode[],
  onNodeUpdate: (nodeId: string, updates: any) => void
) {
  console.log('[CharacterAction] handleGenerateSingle:', { nodeId, charName });

  try {
    // 仅生成档案，不自动生成表情和三视图
    await handleRetry(nodeId, charName, node, allNodes, onNodeUpdate);

    console.log('[CharacterAction] Character profile generated:', charName);
  } catch (error) {
    console.error('[CharacterAction] Character profile generation failed:', charName, error);
  }
}

/**
 * 更新节点UI
 * 关键：合并管理器和node.data的数据，避免角色丢失
 * 策略：以 existing（node.data）为基础，只用 manager 中有值的字段覆盖
 */
function updateNodeUI(
  nodeId: string,
  onNodeUpdate: (nodeId: string, updates: any) => void,
  allNodes: AppNode[]
) {
  // 从管理器获取已生成的角色（最新状态，stateToProfile 已过滤 undefined）
  const managerCharacters = characterGenerationManager.getCharactersForNode(nodeId);

  // 从node.data获取现有的角色（可能包含管理器没有的）
  const node = allNodes.find(n => n.id === nodeId);
  const existingCharacters = node?.data?.generatedCharacters || [];

  console.log('[updateNodeUI] Merging data:', {
    nodeId,
    managerCount: managerCharacters.length,
    existingCount: existingCharacters.length,
  });

  // 合并两个数据源
  const mergedMap = new Map<string, any>();

  // 1. 先添加node.data中已有的角色（保留完整历史数据）
  existingCharacters.forEach(c => {
    mergedMap.set(c.name, { ...c });
  });

  // 2. 管理器的数据合并：以 existing 为基础，manager 中有值的字段覆盖
  managerCharacters.forEach(c => {
    const existing = mergedMap.get(c.name);
    if (existing) {
      // 从 existing 开始（包含所有历史字段）
      const merged: any = { ...existing };

      // 遍历 manager 中的所有字段，只更新有值的（stateToProfile 已过滤 undefined）
      Object.keys(c).forEach(key => {
        if (c[key] !== undefined && c[key] !== null) {
          merged[key] = c[key];
        }
      });

      mergedMap.set(c.name, merged);
    } else {
      // manager 中有新角色
      mergedMap.set(c.name, { ...c });
    }
  });

  // 3. 转回数组
  const mergedCharacters = Array.from(mergedMap.values());

  console.log('[updateNodeUI] Merged result:', {
    nodeId,
    totalCount: mergedCharacters.length,
    characters: mergedCharacters.map(c => ({
      name: c.name,
      status: c.status,
      hasBasicStats: !!c.basicStats,
      hasExpression: !!c.expressionSheet,
      hasThreeView: !!c.threeViewSheet,
    }))
  });

  // 更新合并后的数据
  onNodeUpdate(nodeId, { generatedCharacters: mergedCharacters });
}

/**
 * 获取上游上下文
 */
function getUpstreamContext(node: AppNode, allNodes: AppNode[]): string {
  const inputs = node.inputs.map(i => allNodes.find(n => n.id === i)).filter(Boolean) as AppNode[];
  const upstreamTexts = inputs.map(n => {
    if (n?.type === NodeType.PROMPT_INPUT) return n.data.prompt;
    if (n?.type === NodeType.VIDEO_ANALYZER) return n.data.analysis;
    if (n?.type === NodeType.SCRIPT_EPISODE && n.data.generatedEpisodes) {
      return n.data.generatedEpisodes.map(ep => `${ep.title}\n角色: ${ep.characters}`).join('\n');
    }
    if (n?.type === NodeType.SCRIPT_PLANNER) return n.data.scriptOutline;
    return null;
  }).filter(t => t && t.trim().length > 0) as string[];

  return upstreamTexts.join('\n');
}

/**
 * 获取风格提示词
 */
function getStylePrompt(node: AppNode, allNodes: AppNode[]): string {
  const inputs = node.inputs.map(i => allNodes.find(n => n.id === i)).filter(Boolean) as AppNode[];
  const stylePresetNode = inputs.find(n => n.type === NodeType.STYLE_PRESET);

  if (stylePresetNode?.data.stylePrompt) {
    return stylePresetNode.data.stylePrompt;
  }

  // Fallback to upstream context
  const { style, genre, setting } = getUpstreamStyleContextFromNode(node, allNodes);
  return getVisualPromptPrefix(style, genre, setting);
}

function getUpstreamStyleContextFromNode(node: AppNode, allNodes: AppNode[]): { style: '3D' | 'REAL' | 'ANIME'; genre: string; setting: string } {
  const inputs = node.inputs.map(i => allNodes.find(n => n.id === i)).filter(Boolean) as AppNode[];
  let style: '3D' | 'REAL' | 'ANIME' = '3D'; // 默认3D风格
  let genre = '';
  let setting = '';

  // 递归查找 SCRIPT_PLANNER
  const findPlannerRecursive = (currentNode: AppNode, visited: Set<string> = new Set()): AppNode | null => {
    if (visited.has(currentNode.id)) return null;
    visited.add(currentNode.id);

    if (currentNode.type === NodeType.SCRIPT_PLANNER) {
      return currentNode;
    }

    // 检查当前节点的输入
    const currentInputs = currentNode.inputs.map(i => allNodes.find(n => n.id === i)).filter(Boolean) as AppNode[];
    for (const inputNode of currentInputs) {
      const found = findPlannerRecursive(inputNode, visited);
      if (found) return found;
    }

    return null;
  };

  // 首先尝试在输入中直接查找 SCRIPT_EPISODE 或 SCRIPT_PLANNER
  const episodeNode = inputs.find(n => n.type === NodeType.SCRIPT_EPISODE);
  const plannerNode = inputs.find(n => n.type === NodeType.SCRIPT_PLANNER);

  if (episodeNode) {
    if (episodeNode.data.scriptVisualStyle) style = episodeNode.data.scriptVisualStyle;
    // 向上遍历查找 planner
    const parentPlanner = allNodes.find(n => episodeNode.inputs.includes(n.id) && n.type === NodeType.SCRIPT_PLANNER);
    if (parentPlanner) {
      if (parentPlanner.data.scriptVisualStyle) style = parentPlanner.data.scriptVisualStyle;
      genre = parentPlanner.data.scriptGenre || '';
      setting = parentPlanner.data.scriptSetting || '';
    }
  } else if (plannerNode) {
    if (plannerNode.data.scriptVisualStyle) style = plannerNode.data.scriptVisualStyle;
    genre = plannerNode.data.scriptGenre || '';
    setting = plannerNode.data.scriptSetting || '';
  } else {
    // 如果没有找到直接的 SCRIPT_EPISODE 或 SCRIPT_PLANNER，递归搜索上游
    for (const inputNode of inputs) {
      const foundPlanner = findPlannerRecursive(inputNode);
      if (foundPlanner) {
        if (foundPlanner.data.scriptVisualStyle) style = foundPlanner.data.scriptVisualStyle;
        genre = foundPlanner.data.scriptGenre || '';
        setting = foundPlanner.data.scriptSetting || '';
        console.log(`[getUpstreamStyleContextFromNode] Found SCRIPT_PLANNER recursively:`, {
          style,
          genre,
          setting,
          plannerId: foundPlanner.id
        });
        break;
      }
    }
  }

  return { style, genre, setting };
}

function getVisualPromptPrefix(style: '3D' | 'REAL' | 'ANIME', genre: string, setting: string): string {
  // 根据风格类型返回对应的视觉提示词前缀
  switch (style) {
    case '3D':
      // 仙侠3D风格 - 半写实唯美风格（去除蓝光相关关键词）
      return `Xianxia 3D animation character, semi-realistic style, Xianxia animation aesthetics, high precision 3D modeling, PBR shading with soft translucency, subsurface scattering, ambient occlusion, delicate and smooth skin texture (not overly realistic), flowing fabric clothing, individual hair strands, neutral studio lighting, clear focused gaze, natural demeanor`;
    case 'REAL':
      // 真人写实风格
      return `Professional portrait photography, photorealistic human, cinematic photography, professional headshot, DSLR quality, 85mm lens, sharp focus, realistic skin texture, visible pores, natural skin imperfections, subsurface scattering, natural lighting, studio portrait lighting, softbox lighting, rim light, golden hour`;
    case 'ANIME':
      // 2D动漫风格
      return `Anime character, anime style, 2D anime art, manga illustration style, clean linework, crisp outlines, manga art style, detailed illustration, soft lighting, rim light, vibrant colors, cel shading lighting, flat shading`;
    default:
      // 默认3D风格（去除蓝光相关关键词）
      return `Xianxia 3D animation character, semi-realistic style, Xianxia animation aesthetics, high precision 3D modeling, PBR shading with soft translucency, subsurface scattering, ambient occlusion, delicate and smooth skin texture (not overly realistic), flowing fabric clothing, individual hair strands, neutral studio lighting, clear focused gaze, natural demeanor`;
  }
}

/**
 * 构建负面提示词
 */
function buildNegativePrompt(node: AppNode, allNodes: AppNode[]): string {
  let negative = "nsfw, text, watermark, label, signature, bad anatomy, deformed, low quality, writing, letters, logo, interface, ui";

  const { style: detectedStyle } = getUpstreamStyleContextFromNode(node, allNodes);
  if (detectedStyle === 'REAL') {
    negative += ", anime, 3d render, cgi, 3d animation, illustrated, painting, drawing";
  } else if (detectedStyle === 'ANIME') {
    negative += ", photorealistic, realistic, photo, 3d, cgi, live action";
  } else if (detectedStyle === '3D') {
    // 3D类型：明确排除2D风格，保留3D质感，避免过度写实
    negative += ", 2D illustration, hand-drawn, anime 2D, flat shading, cel shading, toon shading, cartoon 2D, paper cutout, overly photorealistic, hyper-realistic skin, photorealistic rendering";
  }

  negative += ", full body, standing, legs, feet, full-length portrait, wide shot, environmental background, patterned background, gradient background";

  return negative;
}

/**
 * 自动完成完整生成流程：基础信息 → 九宫格 → 三视图
 */
async function handleGenerateAll(
  nodeId: string,
  charName: string,
  node: AppNode,
  allNodes: AppNode[],
  onNodeUpdate: (nodeId: string, updates: any) => void
) {
  console.log('[CharacterAction] handleGenerateAll START:', { nodeId, charName });

  // 初始化状态为GENERATING
  characterGenerationManager.initializeCharacter(nodeId, charName);
  characterGenerationManager.updateCharacterState(nodeId, charName, {
    profileStatus: 'GENERATING'
  });
  updateNodeUI(nodeId, onNodeUpdate, allNodes);

  try {
    // 步骤1: 生成基础信息（如果还没有）
    let state = characterGenerationManager.getCharacterState(nodeId, charName);

    if (!state || !state.profile) {
      console.log('[CharacterAction] Step 1: Generating profile...');
      await handleGenerateSingle(nodeId, charName, node, allNodes, onNodeUpdate);
      // 重新获取状态
      state = characterGenerationManager.getCharacterState(nodeId, charName);
    }

    if (!state?.profile) {
      throw new Error('基础信息生成失败');
    }

    // 检查角色类型
    const character = node.data.generatedCharacters?.find(c => c.name === charName);
    const isSupportingRole = character?.roleType === 'supporting';

    console.log('[CharacterAction] Character role type:', { charName, roleType: character?.roleType, isSupportingRole });

    // 步骤2: 生成九宫格表情（仅主角需要，配角跳过）
    if (!isSupportingRole) {
      if (!state.expressionSheet) {
        console.log('[CharacterAction] Step 2: Generating expression sheet for main character...');
        await handleGenerateExpression(nodeId, charName, node, allNodes, onNodeUpdate);
        // 重新获取状态
        state = characterGenerationManager.getCharacterState(nodeId, charName);
      }

      if (!state?.expressionSheet) {
        throw new Error('九宫格表情生成失败');
      }
    } else {
      console.log('[CharacterAction] Step 2: Skipping expression sheet for supporting character');
    }

    // 步骤3: 生成三视图（主角和配角都需要）
    if (!state.threeViewSheet) {
      console.log('[CharacterAction] Step 3: Generating three-view sheet...');
      await handleGenerateThreeView(nodeId, charName, node, allNodes, onNodeUpdate);
    }

    console.log('[CharacterAction] handleGenerateAll COMPLETE:', { nodeId, charName, roleType: isSupportingRole ? 'supporting' : 'main' });
  } catch (error) {
    console.error('[CharacterAction] handleGenerateAll FAILED:', { nodeId, charName, error });
    throw error; // 重新抛出错误，让上层处理
  }
}
