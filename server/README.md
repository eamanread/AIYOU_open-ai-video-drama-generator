# AIYOU 漫剧生成平台 - 部署指南

## 系统要求

- Node.js 18+
- 操作系统: Linux / macOS / Windows

## 快速部署

### 1. 解压

```bash
tar -xzf aiyou-deploy.tar.gz
cd aiyou-deploy
```

### 2. 安装依赖

```bash
npm install --production
```

### 3. 配置环境变量（可选）

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 填入你的配置：

```env
# 服务端口（默认 3001）
PORT=3001

# 腾讯云 COS 配置（用于文件上传，可选）
OSS_BUCKET=your-bucket-name
OSS_REGION=ap-guangzhou
OSS_SECRET_ID=your-secret-id
OSS_SECRET_KEY=your-secret-key
```

### 4. 启动

```bash
# 方式一：使用启动脚本（推荐）
chmod +x start.sh
./start.sh          # 默认端口 3001
./start.sh 5000     # 指定端口 5000

# 方式二：直接启动
node index.js

# 方式三：指定端口
PORT=6000 node index.js

# 方式四：后台运行
nohup node index.js > aiyou.log 2>&1 &
```

### 5. 访问

启动后打开浏览器访问：

```
http://localhost:3001
```

API 健康检查：

```
http://localhost:3001/api/health
```

## 目录结构

```
aiyou-deploy/
├── index.js          # 后端服务入口
├── logger.js         # 日志模块
├── model-config.json # 模型配置
├── package.json      # 依赖声明
├── start.sh          # 启动脚本
├── .env.example      # 环境变量模板
├── README.md         # 本文件
├── public/           # 管理后台页面
│   └── index.html
└── dist/             # 前端构建产物（自动托管）
    ├── index.html
    └── assets/       # JS/CSS 资源
```

## 使用 PM2 管理（生产推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start index.js --name aiyou -- --port 3001

# 查看状态
pm2 status

# 查看日志
pm2 logs aiyou

# 重启
pm2 restart aiyou

# 开机自启
pm2 startup
pm2 save
```

## 使用 Docker 部署（可选）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

```bash
docker build -t aiyou .
docker run -d -p 3001:3001 --name aiyou aiyou
```
