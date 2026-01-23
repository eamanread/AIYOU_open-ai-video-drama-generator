/**
 * 服务器端日志系统
 * 记录所有API请求和响应到文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 日志目录
const LOG_DIR = path.join(__dirname, '../logs');
const API_LOG_FILE = path.join(LOG_DIR, 'api.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 格式化日志条目
 */
function formatLogEntry(entry) {
  const timestamp = new Date(entry.timestamp).toISOString();
  const separator = '='.repeat(80);

  let log = `\n${separator}\n`;
  log += `[${timestamp}] ${entry.apiName}\n`;
  log += `ID: ${entry.id}\n`;
  log += `Status: ${entry.status}\n`;
  if (entry.duration) log += `Duration: ${entry.duration}ms\n`;
  if (entry.nodeId) log += `NodeID: ${entry.nodeId}\n`;
  if (entry.nodeType) log += `NodeType: ${entry.nodeType}\n`;

  // Request
  if (entry.request) {
    log += `\n--- Request ---\n`;
    log += JSON.stringify(entry.request, null, 2);
    log += `\n`;
  }

  // Response
  if (entry.response) {
    log += `\n--- Response ---\n`;
    log += JSON.stringify(entry.response, null, 2);
    log += `\n`;
  }

  return log;
}

/**
 * 写入日志到文件
 */
function writeLog(entry, logFile = API_LOG_FILE) {
  const logText = formatLogEntry(entry);

  try {
    fs.appendFileSync(logFile, logText + '\n', 'utf8');

    // 如果是错误，额外写入错误日志
    if (entry.status === 'error') {
      const errorLogText = `[${new Date().toISOString()}] ${entry.apiName} - ${entry.response?.error || 'Unknown error'}\n`;
      fs.appendFileSync(ERROR_LOG_FILE, errorLogText, 'utf8');
    }

    return true;
  } catch (error) {
    console.error('[Server Logger] Failed to write log:', error);
    return false;
  }
}

/**
 * 清理旧日志（保留最近7天）
 */
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);

      // 删除7天前的日志
      if (now - stats.mtime.getTime() > sevenDays) {
        fs.unlinkSync(filePath);
        console.log(`[Server Logger] Deleted old log: ${file}`);
      }
    });
  } catch (error) {
    console.error('[Server Logger] Failed to clean old logs:', error);
  }
}

// 每天清理一次旧日志
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

export {
  writeLog,
  cleanOldLogs,
  LOG_DIR,
  API_LOG_FILE,
  ERROR_LOG_FILE
};
