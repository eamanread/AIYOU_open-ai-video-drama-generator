// utils/imageFusion.ts
/**
 * 图片融合工具 - 将多张分镜图拼接并标号
 */

import { SplitStoryboardShot } from '../types';

/**
 * 融合多张分镜图为一张图
 * @param splitShots - 分镜数组（包含splitImage）
 * @param options - 融合选项
 * @returns Promise<string> - 融合后的图片Base64
 */
export async function fuseStoryboardImages(
    splitShots: SplitStoryboardShot[],
    options: {
        layout?: 'grid' | 'horizontal' | 'vertical'; // 布局方式
        columns?: number; // 网格列数（默认3）
        padding?: number; // 图片间距（默认8）
        bgColor?: string; // 背景颜色（默认#1a1a1c）
        showNumbers?: boolean; // 是否显示标号（默认true）
        numberSize?: number; // 标号字体大小（默认16）
    } = {}
): Promise<string> {
    const {
        layout = 'grid',
        columns = 3,
        padding = 8,
        bgColor = '#1a1a1c',
        showNumbers = true,
        numberSize = 16
    } = options;

    if (splitShots.length === 0) {
        throw new Error('没有可融合的分镜图');
    }

    // 加载所有图片
    const images = await Promise.all(
        splitShots.map(shot => loadImage(shot.splitImage))
    );

    // 统一图片尺寸（使用第一张图片的尺寸作为基准）
    const imgWidth = images[0].width;
    const imgHeight = images[0].height;

    // 计算布局
    let canvasWidth: number;
    let canvasHeight: number;
    let positions: Array<{ x: number; y: number; image: HTMLImageElement; index: number }>;

    if (layout === 'grid') {
        // 网格布局
        const cols = columns;
        const rows = Math.ceil(images.length / cols);
        const totalPaddingX = (cols + 1) * padding;
        const totalPaddingY = (rows + 1) * padding;
        canvasWidth = imgWidth * cols + totalPaddingX;
        canvasHeight = imgHeight * rows + totalPaddingY;

        positions = images.map((img, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            return {
                x: padding + col * (imgWidth + padding),
                y: padding + row * (imgHeight + padding),
                image: img,
                index: index + 1
            };
        });
    } else if (layout === 'horizontal') {
        // 水平布局
        canvasWidth = imgWidth * images.length + (images.length + 1) * padding;
        canvasHeight = imgHeight + padding * 2;

        positions = images.map((img, index) => ({
            x: padding + index * (imgWidth + padding),
            y: padding,
            image: img,
            index: index + 1
        }));
    } else {
        // 垂直布局
        canvasWidth = imgWidth + padding * 2;
        canvasHeight = imgHeight * images.length + (images.length + 1) * padding;

        positions = images.map((img, index) => ({
            x: padding,
            y: padding + index * (imgHeight + padding),
            image: img,
            index: index + 1
        }));
    }

    // 创建canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('无法创建canvas上下文');
    }

    // 填充背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 绘制图片
    positions.forEach(({ x, y, image, index }) => {
        // 绘制图片
        ctx.drawImage(image, x, y, imgWidth, imgHeight);

        // 绘制标号
        if (showNumbers) {
            // 标号背景
            const numPadding = 6;
            const numBgWidth = numberSize + numPadding * 2;
            const numBgHeight = numberSize + numPadding * 1.5;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x + 4, y + 4, numBgWidth, numBgHeight);

            // 标号文字
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${numberSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(String(index), x + 4 + numPadding, y + 4 + numPadding * 0.75);
        }
    });

    // 添加标题信息
    const titleHeight = 30;
    const titleCanvas = document.createElement('canvas');
    titleCanvas.width = canvasWidth;
    titleCanvas.height = canvasHeight + titleHeight;
    const titleCtx = titleCanvas.getContext('2d');
    if (!titleCtx) {
        throw new Error('无法创建标题canvas上下文');
    }

    // 绘制主图到标题canvas
    titleCtx.fillStyle = bgColor;
    titleCtx.fillRect(0, 0, canvasWidth, canvasHeight + titleHeight);
    titleCtx.drawImage(canvas, 0, titleHeight);

    // 绘制标题文本
    titleCtx.fillStyle = '#22d3ee';
    titleCtx.font = 'bold 14px Arial, sans-serif';
    titleCtx.textAlign = 'left';
    titleCtx.textBaseline = 'top';
    titleCtx.fillText(`分镜融合图 - 共 ${splitShots.length} 个镜头`, 10, 8);

    // 转换为Base64
    return titleCanvas.toDataURL('image/png', 0.95);
}

/**
 * 加载图片为HTMLImageElement
 */
function loadImage(imageUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        // 处理CORS问题
        if (imageUrl.startsWith('http')) {
            img.crossOrigin = 'anonymous';
        }

        img.onload = () => {
            resolve(img);
        };

        img.onerror = () => {
            reject(new Error(`图片加载失败: ${imageUrl.substring(0, 50)}...`));
        };

        img.src = imageUrl;
    });
}

/**
 * 批量融合多个任务组的分镜图
 * @param taskGroups - 任务组数组
 * @param onProgress - 进度回调
 * @returns Promise<Array<{ groupId: string, fusedImage: string }>>
 */
export async function fuseMultipleTaskGroups(
    taskGroups: Array<{ id: string; splitShots: SplitStoryboardShot[] }>,
    onProgress?: (current: number, total: number, groupName: string) => void
): Promise<Array<{ groupId: string; fusedImage: string }>> {
    const results: Array<{ groupId: string; fusedImage: string }> = [];

    for (let i = 0; i < taskGroups.length; i++) {
        const tg = taskGroups[i];

        try {
            const fusedImage = await fuseStoryboardImages(tg.splitShots);
            results.push({ groupId: tg.id, fusedImage });

            if (onProgress) {
                onProgress(i + 1, taskGroups.length, `任务组 ${i + 1}`);
            }
        } catch (error) {
            console.error(`融合任务组 ${tg.id} 失败:`, error);
            // 继续处理其他任务组
        }
    }

    return results;
}
