// services/apiLogger.ts
// API日志记录系统 - 用于调试和问题定位

export interface APILogEntry {
    id: string;
    timestamp: number;
    apiName: string;          // API函数名称
    nodeId?: string;          // 关联的节点ID
    nodeType?: string;        // 节点类型
    request: {
        model?: string;
        prompt?: string;
        options?: any;
        inputs?: any[];
    };
    response?: {
        success: boolean;
        data?: any;
        error?: string;
    };
    duration?: number;        // 请求耗时(ms)
    status: 'pending' | 'success' | 'error';
}

class APILogger {
    private logs: APILogEntry[] = [];
    private maxLogs = 100;  // 最多保存100条日志
    private storageKey = 'AIYOU_API_LOGS';

    constructor() {
        this.loadFromStorage();
    }

    /**
     * 创建一个新的日志条目（请求开始）
     */
    startLog(
        apiName: string,
        request: APILogEntry['request'],
        context?: { nodeId?: string; nodeType?: string }
    ): string {
        const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const logEntry: APILogEntry = {
            id,
            timestamp: Date.now(),
            apiName,
            nodeId: context?.nodeId,
            nodeType: context?.nodeType,
            request,
            status: 'pending'
        };

        this.logs.unshift(logEntry);

        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }

        this.saveToStorage();

        console.log(`[API Logger] Started: ${apiName}`, {
            logId: id,
            request: this.sanitizeForConsole(request)
        });

        return id;
    }

    /**
     * 完成一个日志条目（请求成功）
     */
    endLog(logId: string, response: any, startTime: number) {
        const log = this.logs.find(l => l.id === logId);
        if (!log) return;

        log.status = 'success';
        log.duration = Date.now() - startTime;
        log.response = {
            success: true,
            data: this.sanitizeResponse(response)
        };

        this.saveToStorage();

        console.log(`[API Logger] Success: ${log.apiName}`, {
            logId,
            duration: log.duration,
            response: this.sanitizeForConsole(response)
        });
    }

    /**
     * 记录错误
     */
    errorLog(logId: string, error: any, startTime: number) {
        const log = this.logs.find(l => l.id === logId);
        if (!log) return;

        log.status = 'error';
        log.duration = Date.now() - startTime;
        log.response = {
            success: false,
            error: this.extractErrorMessage(error)
        };

        this.saveToStorage();

        console.error(`[API Logger] Error: ${log.apiName}`, {
            logId,
            duration: log.duration,
            error: log.response.error
        });
    }

    /**
     * 获取所有日志
     */
    getLogs(): APILogEntry[] {
        return [...this.logs];
    }

    /**
     * 根据条件过滤日志
     */
    filterLogs(filter: {
        apiName?: string;
        nodeId?: string;
        status?: APILogEntry['status'];
        startTime?: number;
        endTime?: number;
    }): APILogEntry[] {
        return this.logs.filter(log => {
            if (filter.apiName && log.apiName !== filter.apiName) return false;
            if (filter.nodeId && log.nodeId !== filter.nodeId) return false;
            if (filter.status && log.status !== filter.status) return false;
            if (filter.startTime && log.timestamp < filter.startTime) return false;
            if (filter.endTime && log.timestamp > filter.endTime) return false;
            return true;
        });
    }

    /**
     * 清除所有日志
     */
    clearLogs() {
        this.logs = [];
        this.saveToStorage();
        console.log('[API Logger] Logs cleared');
    }

    /**
     * 导出日志为JSON
     */
    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const total = this.logs.length;
        const success = this.logs.filter(l => l.status === 'success').length;
        const error = this.logs.filter(l => l.status === 'error').length;
        const pending = this.logs.filter(l => l.status === 'pending').length;

        const apiCounts: Record<string, number> = {};
        this.logs.forEach(log => {
            apiCounts[log.apiName] = (apiCounts[log.apiName] || 0) + 1;
        });

        const avgDuration = this.logs
            .filter(l => l.duration)
            .reduce((sum, l) => sum + (l.duration || 0), 0) / (total || 1);

        return {
            total,
            success,
            error,
            pending,
            avgDuration: Math.round(avgDuration),
            apiCounts
        };
    }

    // ===== 私有方法 =====

    private sanitizeResponse(response: any): any {
        // 对于大型响应数据，只保存关键信息
        if (typeof response === 'string') {
            // 截断超长字符串
            return response.length > 500 ? response.substring(0, 500) + '...' : response;
        }

        if (Array.isArray(response)) {
            // 数组只保存前3项
            return response.slice(0, 3).map(item => this.sanitizeResponse(item));
        }

        if (typeof response === 'object' && response !== null) {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(response)) {
                if (key === 'uri' || key === 'src' || key.includes('Url') || key.includes('Uri')) {
                    // 保留URL
                    sanitized[key] = value;
                } else if (typeof value === 'string' && value.startsWith('data:')) {
                    // Base64数据只保留前缀
                    const match = value.match(/^data:([^;]+);base64,/);
                    sanitized[key] = match ? `[Base64 ${match[1]}]` : '[Base64 Data]';
                } else {
                    sanitized[key] = this.sanitizeResponse(value);
                }
            }
            return sanitized;
        }

        return response;
    }

    private sanitizeForConsole(data: any): any {
        // 为控制台输出做更激进的清理
        if (typeof data === 'string') {
            return data.length > 200 ? data.substring(0, 200) + '...' : data;
        }

        if (Array.isArray(data)) {
            return `[Array(${data.length})]`;
        }

        if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data);
            return `{${keys.join(', ')}}`;
        }

        return data;
    }

    private extractErrorMessage(error: any): string {
        if (!error) return 'Unknown error';
        if (typeof error === 'string') return error;
        if (error.message) return error.message;
        if (error.error && error.error.message) return error.error.message;
        return JSON.stringify(error);
    }

    private saveToStorage() {
        try {
            // 只保存最近50条到 localStorage（避免存储过大）
            const recentLogs = this.logs.slice(0, 50);
            localStorage.setItem(this.storageKey, JSON.stringify(recentLogs));
        } catch (e) {
            console.warn('[API Logger] Failed to save to storage', e);
        }
    }

    private loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.logs = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('[API Logger] Failed to load from storage', e);
            this.logs = [];
        }
    }
}

// 全局单例
export const apiLogger = new APILogger();

/**
 * 包装API调用的辅助函数
 */
export async function logAPICall<T>(
    apiName: string,
    apiCall: () => Promise<T>,
    request: APILogEntry['request'],
    context?: { nodeId?: string; nodeType?: string }
): Promise<T> {
    const startTime = Date.now();
    const logId = apiLogger.startLog(apiName, request, context);

    try {
        const result = await apiCall();
        apiLogger.endLog(logId, result, startTime);
        return result;
    } catch (error) {
        apiLogger.errorLog(logId, error, startTime);
        throw error;
    }
}
