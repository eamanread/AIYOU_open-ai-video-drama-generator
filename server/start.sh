#!/bin/bash

# AIYOU 部署启动脚本
# 用法: ./start.sh [端口号]
# 示例: ./start.sh 3001

PORT=${1:-3001}

echo "================================"
echo "  AIYOU 漫剧生成平台"
echo "  启动端口: $PORT"
echo "================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js 18+"
    echo "   下载地址: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低 (当前: $(node -v))，需要 v18+"
    exit 1
fi

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，安装依赖..."
    npm install --production
fi

# 启动服务
PORT=$PORT node index.js
