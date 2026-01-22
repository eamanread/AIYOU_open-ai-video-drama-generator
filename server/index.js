/**
 * AIYOU Backend Server
 * 提供 OSS 文件上传 API
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import COS from 'cos-nodejs-sdk-v5';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: ['http://localhost:4000', 'http://127.0.0.1:4000'],
  credentials: true
}));
app.use(express.json());

// 配置文件上传（使用内存存储，限制文件大小为 100MB）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10
  }
});

// OSS 配置
const ossConfig = {
  bucket: process.env.OSS_BUCKET || 'aiyou-1256635214',
  region: process.env.OSS_REGION || 'ap-guangzhou',
  secretId: process.env.OSS_SECRET_ID,
  secretKey: process.env.OSS_SECRET_KEY
};

// 初始化腾讯云 COS SDK
const cos = new COS({
  SecretId: ossConfig.secretId,
  SecretKey: ossConfig.secretKey,
});

/**
 * 健康检查接口
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AIYOU Backend Server is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * OSS 文件上传接口
 * POST /api/upload-oss
 */
app.post('/api/upload-oss', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }

    const { originalname, mimetype, buffer, size } = req.file;
    const { folder = 'aiyou-uploads' } = req.body;

    // 验证文件类型
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/mp3'
    ];

    if (!allowedTypes.includes(mimetype)) {
      return res.status(400).json({
        success: false,
        error: `不支持的文件类型: ${mimetype}`
      });
    }

    // 验证文件大小（限制 50MB）
    const maxSize = 50 * 1024 * 1024;
    if (size > maxSize) {
      return res.status(400).json({
        success: false,
        error: `文件大小超过限制: ${(size / 1024 / 1024).toFixed(2)}MB (最大 50MB)`
      });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = originalname.split('.').pop();
    const fileName = `${folder}/${timestamp}_${random}.${ext}`;

    console.log('📤 开始上传到 OSS:', {
      originalName: originalname,
      fileName: fileName,
      size: `${(size / 1024).toFixed(2)}KB`,
      type: mimetype
    });

    // 上传到腾讯云 COS
    const result = await new Promise((resolve, reject) => {
      cos.putObject({
        Bucket: ossConfig.bucket,
        Region: ossConfig.region,
        Key: fileName,
        Body: buffer,
        ContentType: mimetype,
      }, (err, data) => {
        if (err) {
          console.error('❌ OSS 上传失败:', err);
          reject(err);
        } else {
          console.log('✅ OSS 上传成功:', data.Location);
          resolve(data);
        }
      });
    });

    // 返回文件 URL
    const fileUrl = `https://${ossConfig.bucket}.cos.${ossConfig.region}.myqcloud.com/${fileName}`;

    res.json({
      success: true,
      url: fileUrl,
      fileName: fileName,
      size: size,
      type: mimetype,
      originalName: originalname
    });

  } catch (error) {
    console.error('❌ 上传失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '文件上传失败'
    });
  }
});

/**
 * 获取 OSS 上传预签名 URL（可选，用于直接前端上传）
 * GET /api/oss-upload-url?fileName=example.jpg&fileType=image/jpeg
 */
app.get('/api/oss-upload-url', async (req, res) => {
  try {
    const { fileName, fileType = 'image/jpeg' } = req.query;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: '缺少 fileName 参数'
      });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const finalFileName = `aiyou-uploads/${timestamp}_${random}_${fileName}`;

    // 生成预签名 URL（有效期 1 小时）
    const result = await new Promise((resolve, reject) => {
      cos.getObjectUrl({
        Bucket: ossConfig.bucket,
        Region: ossConfig.region,
        Key: finalFileName,
        Method: 'PUT',
        Sign: true,
        Expires: 3600, // 1小时
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    res.json({
      success: true,
      uploadUrl: result.Url,
      fileName: finalFileName,
      expiresIn: 3600
    });

  } catch (error) {
    console.error('❌ 生成预签名 URL 失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '生成预签名 URL 失败'
    });
  }
});

/**
 * Sora 2 API 代理 - 提交视频生成任务
 * POST /api/sora/generations
 */
app.post('/api/sora/generations', async (req, res) => {
  try {
    const { prompt, images, aspect_ratio, duration, hd, watermark, private: isPrivate } = req.body;

    // 从请求头获取 API Key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少 API Key，请在请求头中提供 X-API-Key'
      });
    }

    const requestBody = {
      prompt: prompt || '',
      model: 'sora-2',
      images: images || [],
      aspect_ratio: aspect_ratio || '16:9',
      duration: duration || '10',
      hd: hd !== undefined ? hd : true,
      watermark: watermark !== undefined ? watermark : true,
      private: isPrivate !== undefined ? isPrivate : true
    };

    console.log('📹 Sora API 代理: 提交视频生成任务', {
      promptLength: prompt?.length,
      hasImages: !!images?.length,
      aspect_ratio,
      duration,
      requestBody: JSON.stringify(requestBody)
    });

    const response = await fetch('https://hk-api.gptbest.vip/v2/videos/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    console.log('📹 Sora API 响应:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ Sora API 错误:', response.status, data);
      return res.status(response.status).json({
        success: false,
        error: data.message || data.error || 'Sora API 请求失败',
        details: data
      });
    }

    console.log('✅ Sora API 代理: 任务提交成功', data.id || data.task_id || 'NO_ID');
    res.json(data);

  } catch (error) {
    console.error('❌ Sora API 代理错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Sora API 代理请求失败'
    });
  }
});

/**
 * Sora 2 API 代理 - 查询任务状态
 * GET /api/sora/generations/:taskId
 */
app.get('/api/sora/generations/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    // 从请求头获取 API Key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少 API Key，请在请求头中提供 X-API-Key'
      });
    }

    const response = await fetch(`https://hk-api.gptbest.vip/v2/videos/generations/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Sora API 查询错误:', response.status, data);
      return res.status(response.status).json({
        success: false,
        error: data.message || data.error || 'Sora API 查询失败',
        details: data
      });
    }

    res.json(data);

  } catch (error) {
    console.error('❌ Sora API 代理查询错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Sora API 代理查询失败'
    });
  }
});

/**
 * 错误处理
 */
app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

/**
 * 404 处理
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

/**
 * 启动服务器
 */
app.listen(PORT, () => {
  console.log('🚀 AIYOU Backend Server started');
  console.log(`📍 HTTP: http://localhost:${PORT}`);
  console.log(`🔧 Health: http://localhost:${PORT}/api/health`);
  console.log(`📤 Upload: http://localhost:${PORT}/api/upload-oss`);
  console.log('');
  console.log('⚙️  OSS Configuration:');
  console.log(`   Bucket: ${ossConfig.bucket}`);
  console.log(`   Region: ${ossConfig.region}`);
});
