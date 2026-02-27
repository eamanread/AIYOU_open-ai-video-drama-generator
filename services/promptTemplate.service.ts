/**
 * 提示词模板服务 — 加载、填充、注册模板
 */
import type { PromptTemplate, NodeType } from '../types';

export class PromptTemplateService {
  private templates: PromptTemplate[] = [];

  /** 注册单个模板 */
  register(template: PromptTemplate): void {
    const idx = this.templates.findIndex((t) => t.id === template.id);
    if (idx >= 0) {
      this.templates[idx] = template;
    } else {
      this.templates.push(template);
    }
  }

  /** 按节点类型获取所有可用模板 */
  getTemplatesForNode(nodeType: NodeType): PromptTemplate[] {
    return this.templates.filter((t) => t.nodeType === nodeType);
  }

  /** 按 ID 获取模板 */
  getById(id: string): PromptTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  /**
   * 填充模板变量，返回最终 prompt 文本。
   * 未提供的变量保留 {{variable}} 原样。
   */
  render(templateId: string, variables: Record<string, string>): string {
    const tpl = this.getById(templateId);
    if (!tpl) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return tpl.body.replace(/\{\{(\w+)\}\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(variables, key)
        ? variables[key]
        : match,
    );
  }

  /** 批量注册默认模板（Phase 2 填充） */
  registerDefaults(): void {
    // TODO: Phase 2 — 在此注册内置模板
  }
}

/** 单例 */
export const promptTemplateService = new PromptTemplateService();
