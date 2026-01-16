# AIYOU短剧风格完整指南

## 目录
- [一、三大制作类型](#一三大制作类型)
- [二、视觉风格详解](#二视觉风格详解)
- [三、剧集类型分类](#三剧集类型分类)
- [四、画风细分](#四画风细分)
- [五、风格组合方案](#五风格组合方案)
- [六、技术参数配置](#六技术参数配置)

---

## 一、三大制作类型

### 1.1 AI短剧 (REAL - 真人实拍风格)

**定义**：使用AI生成逼真的真人影像，模拟实拍效果

**技术特征**：
- 风格标签：`photorealistic`, `cinematic`, `realistic`
- 模型选择：Veo 3.1 Pro, Stable Diffusion Realistic
- 渲染质量：8k uhd, high resolution, professional photography
- 光照处理：natural lighting, volumetric lighting, soft shadows
- 焦距效果：shallow depth of field, bokeh effect
- 相机参数：shot on Canon EOS R5, 85mm f/1.2

**适用场景**：
- 现代都市剧
- 职场商战
- 悬疑推理
- 现实主义题材
- 情感剧

**质量要求**：
- 真实的皮肤质感：realistic skin texture, pores, subsurface scattering
- 自然的光影：golden hour, rim light, natural shadows
- 电影级构图：cinematic composition, rule of thirds
- 专业色调：color grading, cinematic look, film grain

**负面避免**：
```
anime, 2D animation, 3D animation, 3D render, cgi,
painting, illustration, artificial, fake, low quality, blurry
```

---

### 1.2 2D漫剧 (ANIME - 二次元动漫风格)

**定义**：手绘风格的2D动画效果，日式/国风动漫画风

**技术特征**：
- 风格标签：`anime style`, `anime art`, `detailed illustration`
- 模型选择：Anything V5, MeinaMix, Abyss Orange Mix
- 渲染质量：masterpiece, best quality, official art
- 色彩处理：vibrant colors, cel shading, flat colors
- 线条风格：clean linework, sharp outlines
- 光影特点：soft lighting, rim light, gentle highlights

**细分流派**：

#### 1.2.1 日系动漫风
```
特点：
- 大眼睛，精致五官
- 发型复杂（twin tails, ahoge, hair ornament）
- 服装华丽（magical girl outfit, frilly dress）
- 表情夸张（sparkles, glowing, blushing）
- 配色鲜艳（pastel colors, vibrant）

关键词：
anime screencap, official art, beautiful detailed eyes,
expressive face, kawaii, moe style
```

#### 1.2.2 国风漫画
```
特点：
- 东方审美（细长眼，柳叶眉）
- 传统服饰（hanfu, 汉服，古装）
- 水墨意境（ink wash painting influence）
- 色调优雅（muted colors, elegant palette）
- 建筑元素（traditional architecture, pavilion）

关键词：
chinese style, hanfu, traditional chinese art,
elegant composition, ink painting influence
```

#### 1.2.3 韩系漫画
```
特点：
- 清新写实（semi-realistic）
- 柔和色调（soft colors, warm tone）
- 少女感（youthful, fresh）
- 时尚服装（modern fashion）
- 细腻光影（delicate shading）

关键词：
webtoon style, korean manhwa, soft shading,
clean aesthetic, modern fashion
```

**适用题材**：
- 校园恋爱
- 奇幻冒险
- 热血战斗
- 魔法少女
- 古风仙侠
- 穿越重生

**质量关键词**：
```
正面：
masterpiece, best quality, high quality,
highly detailed, beautiful detailed eyes,
detailed character design, clean linework,
vibrant colors, smooth shading

负面：
realistic, photo, 3d, nsfw, bad anatomy,
bad hands, extra limbs, deformed, disfigured,
low quality, blurry, monochrome
```

---

### 1.3 3D漫剧 (3D - 三维动画风格)

**定义**：使用3D建模和渲染技术制作的动画短剧，强调艺术化、风格化的视觉效果，非写实真人风格

**技术特征**：
- 风格标签：`3d animated character`, `stylized 3d render`
- 渲染引擎：Octane, Unreal Engine 5, Blender Cycles
- 材质系统：stylized materials, toon shading, cel shading
- 光照技术：studio lighting, ambient occlusion, soft shadows
- 质量参数：8k resolution, high poly model, clean rendering

**细分风格**：

#### 1.3.1 动画3D（通用动画风格）
```
特点：
- 风格化模型（stylized character, smooth surfaces）
- 光滑皮肤（stylized skin, no skin texture）
- 卡通着色（toon shading, cel shading）
- 艺术渲染（artistic rendering, non-photorealistic）

关键词：
3d animated character, stylized 3d render,
toon shading,
smooth stylized skin, clean surfaces,
vibrant colors, artistic rendering,
non-photorealistic, 3D anime aesthetics

禁止：
photorealistic, realistic skin texture,
subsurface scattering, skin details,
photo, photography, hyperrealistic

适合：
- 都市爱情
- 职场商战
- 悬疑推理
- 现代题材（所有类型）
```

#### 1.3.2 Pixar/迪士尼风格
```
特点：
- 夸张比例（stylized proportions）
- 鲜艳配色（vibrant colors, saturated）
- 简化细节（stylized details）
- 可爱造型（cute, adorable）
- 卡通渲染（toon shading, cel shading）

关键词：
pixar style, disney style, 3D anime,
stylized 3d, cute character design,
colorful, family-friendly, toon render

适合：
- 儿童动画
- 家庭喜剧
- 轻松幽默
- 童话故事
```

#### 1.3.3 低多边形风格（Low Poly）
```
特点：
- 几何化造型（geometric shapes）
- 平面着色（flat shading, faceted）
- 简约美学（minimalist）
- 复古游戏感（retro gaming aesthetic）

关键词：
low poly, polygon art, geometric,
minimalist 3d, faceted surface,
retro style, indie game art

适合：
- 抽象叙事
- 艺术实验
- 怀旧题材
```

**3D渲染质量要求**：
```
正面：
3d animated character, stylized rendering,
toon shading, cel shading,
octane render, unreal engine, blender,
studio lighting, ambient occlusion,
vibrant colors, clean surfaces,
artistic style, non-photorealistic

负面：
photorealistic, realistic skin texture,
skin details, pores, wrinkles,
hyperrealistic, photo, photography,
subsurface scattering, realistic shader
```

---

## 二、视觉风格详解

### 2.1 色调分类

#### 暖色调 (Warm Tone)
```
特点：温暖、温馨、怀旧、浪漫
色系：橙红黄为主
光照：golden hour, sunset, candlelight

关键词：
warm tone, golden palette, warm colors,
cozy atmosphere, nostalgic, romantic lighting

适合类型：
- 温情剧
- 爱情故事
- 家庭剧
- 治愈系
```

#### 冷色调 (Cool Tone)
```
特点：冷静、科技、神秘、高级
色系：蓝紫为主
光照：moonlight, neon lights, blue hour

关键词：
cool tone, blue palette, cold colors,
cyberpunk, sci-fi atmosphere, neon glow

适合类型：
- 科幻剧
- 悬疑推理
- 赛博朋克
- 都市noir
```

#### 中性色调 (Neutral Tone)
```
特点：自然、真实、平衡
色系：灰白黑为主
光照：natural lighting, balanced

关键词：
natural colors, balanced colors,
neutral palette, realistic tone

适合类型：
- 现实题材
- 纪录片风格
- 日常生活
```

---

### 2.2 光影风格

#### 高对比度 (High Contrast)
```
特点：
- 明暗分明
- 戏剧张力强
- 电影感强烈

关键词：
dramatic lighting, high contrast,
chiaroscuro, deep shadows,
film noir style

适合：悬疑、惊悚、黑帮、史诗
```

#### 柔光风格 (Soft Light)
```
特点：
- 柔和过渡
- 温柔舒适
- 梦幻感

关键词：
soft lighting, diffused light,
gentle shadows, dreamy atmosphere,
ethereal glow

适合：爱情、治愈、日常、童话
```

#### 体积光 (Volumetric Lighting)
```
特点：
- 光束可见
- 空间感强
- 神圣/史诗感

关键词：
volumetric lighting, god rays,
light shafts, atmospheric perspective,
cinematic rays

适合：奇幻、史诗、宗教、魔法
```

---

### 2.3 构图风格

#### 电影级构图 (Cinematic Composition)
```
技术：
- 三分法则 (rule of thirds)
- 引导线 (leading lines)
- 对称构图 (symmetry)
- 框架构图 (framing)

关键词：
cinematic composition, professional framing,
widescreen aspect ratio, establishing shot,
dramatic angles

适合：所有严肃题材
```

#### 漫画分镜感 (Manga Panel Style)
```
技术：
- 动态角度 (dynamic angles)
- 夸张透视 (exaggerated perspective)
- 速度线 (speed lines)
- 冲击力构图 (impact framing)

关键词：
manga composition, dynamic angle,
action shot, dramatic perspective,
comic book style

适合：热血、战斗、体育
```

---

## 三、剧集类型分类

### 3.1 现代都市类

#### 职场商战
```
视觉风格：REAL写实风格
色调：冷色调 + 高级灰
光照：office lighting, professional
场景：modern office, skyscraper, business district

提示词模板：
photorealistic style, cinematic quality,
modern urban architecture, glass buildings,
professional business atmosphere,
cool tone, sophisticated lighting,
8k uhd, sharp focus
```

#### 都市爱情
```
视觉风格：REAL写实或2D清新漫画
色调：暖色调
光照：romantic lighting, golden hour
场景：city streets, cafe, apartment

提示词模板：
warm tone, romantic atmosphere,
urban lifestyle, modern fashion,
soft lighting, bokeh background,
cinematic romance, natural colors
```

#### 悬疑推理
```
视觉风格：REAL写实，偏noir风格
色调：冷色调 + 高对比度
光照：dramatic lighting, shadows
场景：dark alleys, rain, night city

提示词模板：
film noir style, high contrast,
moody atmosphere, dramatic shadows,
rainy night, urban mystery,
cinematic thriller, dark tone
```

---

### 3.2 古装/历史类

#### 古风仙侠 (2D国风)
```
视觉风格：ANIME国风漫画
色调：典雅色系（青、白、金）
光照：soft ethereal glow, mystical light
场景：ancient architecture, mountains, clouds

提示词模板：
chinese style, xianxia genre,
traditional chinese art influence,
hanfu, flowing robes, elegant composition,
misty mountains, ethereal atmosphere,
ink painting aesthetic, elegant colors,
masterpiece, detailed illustration
```

#### 历史正剧 (REAL写实)
```
视觉风格：REAL写实，纪录片感
色调：自然写实
光照：natural lighting, period accurate
场景：historical architecture, period costumes

提示词模板：
historical drama, period piece,
authentic costume design,
natural lighting, realistic textures,
cinematic historical reconstruction,
8k uhd, professional cinematography
```

---

### 3.3 奇幻/科幻类

#### 奇幻冒险 (2D日系或3D卡通)
```
视觉风格：ANIME日系或3D Pixar风格
色调：鲜艳多彩
光照：magical glow, fantasy lighting
场景：fantasy world, magic effects

提示词模板（2D）：
anime style, fantasy adventure,
magical effects, vibrant colors,
detailed character design,
epic fantasy scenery, glowing magic,
masterpiece, high quality

提示词模板（3D）：
pixar style, 3d fantasy animation,
colorful magical world,
stylized characters, family-friendly,
octane render, vibrant lighting
```

#### 赛博朋克 (3D动画风格)
```
视觉风格：3D动画渲染
色调：冷色调 + 霓虹灯
光照：neon lights, volumetric fog
场景：futuristic city, holographic displays

提示词模板：
cyberpunk style, 3d animated cityscape,
stylized futuristic city,
neon lights, holographic elements,
rainy night, volumetric fog,
artistic rendering,
cinematic sci-fi, high tech atmosphere,
ray tracing, 8k resolution,
non-photorealistic, vibrant colors
```

#### 末日废土 (3D动画风格)
```
视觉风格：3D动画渲染
色调：沙漠暖色或灰暗冷色
光照：harsh sunlight or overcast
场景：ruins, desert, destroyed buildings

提示词模板：
post-apocalyptic, stylized 3d render,
destroyed cityscape, ruins,
harsh lighting, dusty atmosphere,
3d animated style, artistic rendering,
stylized textures, clean surfaces,
8k uhd, desolate environment,
3D anime aesthetics, non-photorealistic
```

---

### 3.4 校园/青春类

#### 校园恋爱 (2D日系/韩系)
```
视觉风格：ANIME日系或韩系漫画
色调：清新明亮
光照：soft natural light, spring atmosphere
场景：school, classroom, cherry blossoms

提示词模板（日系）：
anime style, school romance,
beautiful detailed eyes, youthful,
cherry blossoms, spring atmosphere,
school uniform, soft lighting,
pastel colors, masterpiece

提示词模板（韩系）：
webtoon style, korean manhwa,
school life, modern fashion,
soft shading, clean aesthetic,
warm tone, fresh atmosphere
```

#### 青春励志
```
视觉风格：REAL写实或2D写实漫画
色调：阳光明媚
光照：bright natural light
场景：sports field, classroom, street

提示词模板：
youthful energy, inspirational,
bright sunlight, vibrant atmosphere,
realistic or semi-realistic style,
natural colors, optimistic mood,
high quality, detailed
```

---

### 3.5 喜剧/搞笑类

#### 轻喜剧 (3D卡通或2D Q版)
```
视觉风格：3D Pixar风格或2D Q版
色调：明亮欢快
光照：bright cheerful lighting
场景：colorful environments

提示词模板（3D）：
pixar style, 3D anime,
cute character design, colorful,
funny expressions, family-friendly,
bright lighting, cheerful atmosphere

提示词模板（2D）：
chibi style, cute anime,
super deformed, kawaii,
bright colors, comedic,
simple background, funny
```

---

## 四、画风细分

### 4.1 REAL写实风格画风分类

#### 电影质感
```
特点：35mm胶片质感，电影级调色
关键词：
cinematic film look, 35mm film grain,
color grading, cinematic LUT,
professional cinematography,
anamorphic lens flare
```

#### 纪录片风格
```
特点：自然光照，真实记录感
关键词：
documentary style, natural lighting,
handheld camera, authentic moments,
realistic atmosphere, candid
```

#### 商业广告风格
```
特点：完美光照，精致构图
关键词：
commercial photography, studio lighting,
perfect composition, polished look,
high-end production, professional
```

---

### 4.2 ANIME 2D风格画风分类

#### 赛璐璐风格 (Cel Shading)
```
特点：平涂色块，清晰边界
关键词：
cel shading, flat colors,
clean edges, anime cell paint,
traditional animation style
```

#### 厚涂风格 (Thick Paint)
```
特点：笔触明显，质感丰富
关键词：
thick paint, visible brush strokes,
painterly style, rich textures,
digital painting, artistic
```

#### 水彩风格 (Watercolor)
```
特点：柔和渲染，水彩质感
关键词：
watercolor style, soft edges,
gentle blending, pastel tones,
dreamy aesthetic, artistic
```

#### 线稿风格 (Lineart Dominant)
```
特点：强调线条，简化上色
关键词：
strong linework, clean lines,
minimal shading, sketch style,
comic book aesthetic
```

---

### 4.3 3D风格画风分类

#### NPR渲染 (Non-Photorealistic) - 3D默认风格
```
特点：3D模型，风格化渲染效果，非写实
关键词：
NPR rendering, toon shading,
cel-shaded 3d, anime 3d style,
stylized 3d rendering, artistic style,
non-photorealistic, 3D anime aesthetics
```

#### 风格化PBR渲染
```
特点：3D模型，风格化材质和光照
关键词：
stylized PBR workflow, artistic rendering,
stylized materials, vibrant colors,
clean surfaces, smooth textures,
toon shading
```

#### 体素风格 (Voxel)
```
特点：像素化3D，复古游戏感
关键词：
voxel art, minecraft style,
blocky 3d, pixelated 3d,
retro game aesthetic
```

---

## 五、风格组合方案

### 5.1 推荐组合

#### 现代爱情剧
```
制作类型：REAL写实
画风：电影质感
色调：暖色调
光照：柔光 + Golden Hour
场景风格：都市时尚

完整提示词：
photorealistic style, cinematic romance,
warm tone, golden hour lighting,
soft bokeh, natural colors,
modern urban setting, fashion photography,
8k uhd, shallow depth of field,
professional cinematography
```

#### 古风仙侠
```
制作类型：ANIME 2D
画风：国风漫画 + 水彩风格
色调：典雅中性
光照：柔和仙气
场景风格：山水意境

完整提示词：
chinese style, xianxia fantasy,
watercolor painting influence,
elegant color palette, misty atmosphere,
traditional chinese art, hanfu,
flowing robes, ethereal glow,
ink wash aesthetic, masterpiece,
highly detailed illustration
```

#### 赛博朋克
```
制作类型：3D动画渲染
画风：电影级科幻动画
色调：冷色调 + 霓虹
光照：体积光 + 霓虹灯
场景风格：未来都市

完整提示词：
cyberpunk style, 3d animated cityscape,
stylized futuristic city,
neon-lit cityscape, rainy night,
volumetric fog, holographic displays,
cool tone, dramatic lighting,
ray tracing, global illumination,
unreal engine 5, 8k resolution,
cinematic sci-fi atmosphere,
non-photorealistic, vibrant colors,
3D anime aesthetics
```

#### 魔法少女
```
制作类型：ANIME 2D
画风：日系动漫 + 赛璐璐
色调：鲜艳多彩
光照：魔法光效
场景风格：奇幻梦幻

完整提示词：
anime style, magical girl genre,
cel shading, vibrant colors,
sparkling magical effects,
beautiful detailed eyes,
frilly costume, ribbons,
glowing magic circles,
pastel background, starry sky,
masterpiece, best quality
```

---

### 5.2 混合风格

#### 2.5D风格（2D+3D混合）
```
特点：3D模型 + 2D渲染
技术：3D建模 + NPR渲染
效果：立体感 + 动漫风

关键词：
2.5d style, anime 3d hybrid,
cel-shaded 3d model,
toon rendering, stylized 3d,
anime aesthetic with depth
```

#### 半写实风格（Realistic + Anime）
```
特点：真实质感 + 动漫美化
技术：写实渲染 + 美型设计
效果：精致唯美

关键词：
semi-realistic, anime realism,
detailed realistic textures,
beautiful anime face,
photorealistic body with stylized features
```

---

## 六、技术参数配置

### 6.1 分辨率建议

#### 竖屏短剧（抖音/快手）
```
比例：9:16
分辨率：1080x1920 (1080p) 或 2160x3840 (4K)
关键词：vertical video, mobile format, 9:16 aspect ratio
```

#### 横屏短剧（B站/YouTube）
```
比例：16:9
分辨率：1920x1080 (1080p) 或 3840x2160 (4K)
关键词：widescreen, cinematic aspect ratio, 16:9
```

#### 方形视频（Instagram）
```
比例：1:1
分辨率：1080x1080 或 2160x2160
关键词：square format, 1:1 aspect ratio
```

---

### 6.2 质量标签体系

#### 通用高质量标签
```
REAL写实：
8k uhd, 4k resolution, high resolution,
ultra detailed, highly detailed,
professional photography, masterwork,
award winning, sharp focus

ANIME 2D：
masterpiece, best quality, high quality,
official art, highly detailed,
professional illustration, award winning,
detailed character design

3D渲染：
8k resolution, high poly model,
ray tracing, global illumination,
professional rendering, award winning,
detailed textures, cinematic quality
```

#### 通用负面标签
```
REAL写实：
anime, 2D animation, 3D animation, painting, illustration,
3d render, cgi, low quality, blurry,
out of focus, bad quality, amateur

ANIME 2D：
realistic, photo, 3d render,
bad anatomy, bad hands, extra limbs,
deformed, low quality, blurry,
worst quality, bad art

3D渲染：
2d, flat, anime, photo, painting,
low poly (unless intended),
low quality, blurry, bad topology,
bad geometry, artifacts
```

---

### 6.3 镜头语言

#### 景别分类
```
远景 (ELS)：Extreme Long Shot, establishing shot
全景 (LS)：Long Shot, full body
中景 (MS)：Medium Shot, waist up
近景 (CU)：Close Up, face
特写 (ECU)：Extreme Close Up, eyes/details
```

#### 机位角度
```
平视：eye level, straight on
仰角：low angle, from below, worm's eye view
俯角：high angle, from above, bird's eye view
侧面：side angle, profile view
斜角：dutch angle, tilted camera
```

#### 运镜方式
```
固定：static shot, locked camera
推镜：push in, dolly forward
拉镜：pull out, dolly back
摇镜：pan left/right
跟拍：tracking shot, following
环绕：orbit shot, 360 degree
升降：crane shot, boom up/down
```

---

## 七、实战案例模板

### 案例1：霸道总裁爱上我（REAL现代都市）

**剧集类型**：都市爱情
**制作类型**：REAL写实
**色调**：暖色调为主
**画风**：电影级商业片

**场景风格提示词**：
```
photorealistic style, cinematic romance,
modern urban luxury, high-end office interior,
warm tone, golden hour lighting,
soft bokeh background, shallow depth of field,
professional fashion photography,
elegant composition, natural colors,
8k uhd, sharp focus,
cinematic film grain, color graded
```

**人物风格提示词**：
```
photorealistic portrait, realistic human,
professional fashion model quality,
detailed facial features, natural skin texture,
soft portrait lighting, rim light,
shallow depth of field, bokeh background,
elegant styling, high-end fashion,
8k uhd, professional photography,
natural colors, cinematic lighting
```

---

### 案例2：修仙归来（ANIME古风仙侠）

**剧集类型**：古风仙侠
**制作类型**：ANIME 2D国风
**色调**：清雅中性，仙气缥缈
**画风**：国风漫画+水彩质感

**场景风格提示词**：
```
chinese style, xianxia fantasy background,
watercolor painting aesthetic,
misty mountains, floating clouds,
traditional chinese architecture,
ethereal atmosphere, soft glowing light,
ink wash painting influence,
elegant color palette, muted tones,
masterpiece, highly detailed illustration,
beautiful scenery, peaceful ambiance
```

**人物风格提示词**：
```
anime character, chinese style,
xianxia cultivator, traditional hanfu,
flowing robes, elegant design,
beautiful detailed eyes, refined features,
clean linework, soft shading,
gentle lighting, ethereal glow,
masterpiece, best quality,
detailed character illustration,
official art, professional
```

---

### 案例3：末日求生（3D科幻废土）

**剧集类型**：末日科幻
**制作类型**：3D动画渲染
**色调**：冷灰色调
**画风**：风格化动画

**场景风格提示词**：
```
3d animated environment, stylized render,
post-apocalyptic wasteland,
destroyed cityscape, ruins,
overcast sky, dusty atmosphere,
volumetric fog, dramatic lighting,
unreal engine 5, ambient occlusion,
ray tracing, global illumination,
clean surfaces, artistic rendering,
cinematic composition, desolate mood,
non-photorealistic
```

**人物风格提示词**：
```
3d animated character, stylized 3d render,
stylized features, smooth surfaces,
high poly model, clean character design,
weathered clothing, tactical gear,
stylized materials, vibrant colors,
studio lighting, three-point lighting,
octane render, 8k resolution,
ray tracing, detailed character design
```

---

### 案例4：校园恋爱喜剧（ANIME日系轻松）

**剧集类型**：校园爱情
**制作类型**：ANIME 2D日系
**色调**：明亮清新
**画风**：赛璐璐+萌系

**场景风格提示词**：
```
anime style, school romance background,
spring season, cherry blossoms,
school building, blue sky,
soft lighting, bright atmosphere,
pastel colors, cel shading,
clean composition, beautiful scenery,
anime background art, detailed illustration,
masterpiece, high quality
```

**人物风格提示词**：
```
anime character, 1girl or 1boy,
school uniform, youthful appearance,
beautiful detailed eyes, expressive face,
cute smile, slight blush,
clean linework, cel shading,
vibrant colors, soft lighting,
masterpiece, best quality,
detailed character design,
official art, kawaii style
```

---

## 八、进阶技巧

### 8.1 权重控制

在Stable Diffusion中使用权重语法：
```
(keyword:1.5) - 增强150%
(keyword:0.8) - 降低到80%
((keyword)) - 增强1.1倍
[keyword] - 降低到0.9倍

示例：
(beautiful detailed eyes:1.4), (cinematic lighting:1.3),
wearing dress, [simple background:0.7]
```

---

### 8.2 分层Prompt策略

**基础层**（必须包含）：
```
风格定义 + 质量标签 + 核心主题
例：anime style, masterpiece, school romance
```

**细节层**（丰富描述）：
```
具体元素 + 色彩 + 光照 + 构图
例：cherry blossoms, pastel colors, soft lighting, beautiful composition
```

**优化层**（提升品质）：
```
专业术语 + 技术参数 + 艺术家风格
例：official art, detailed illustration, by Makoto Shinkai
```

**否定层**（避免问题）：
```
负面提示词列表
例：bad anatomy, low quality, blurry, nsfw
```

---

### 8.3 艺术家参考（慎用）

#### REAL写实风格参考
```
摄影师风格：
by Annie Leibovitz (时尚人像)
by Roger Deakins (电影摄影)
by Gregory Crewdson (戏剧性场景)

注意：使用艺术家名字可能有版权问题
建议：使用风格描述代替具体名字
```

#### ANIME风格参考
```
动画风格：
Makoto Shinkai style (新海诚 - 唯美背景)
Kyoto Animation style (京阿尼 - 精致细腻)
Studio Ghibli style (吉卜力 - 温暖治愈)

注意：仅作学习参考，商业使用需授权
```

---

## 九、常见问题FAQ

### Q1: 如何选择制作类型？
```
A: 根据题材和预算：
- REAL写实：现代题材，追求真实感，成本较高
- ANIME 2D：动漫题材，风格多样，成本适中
- 3D渲染：特效需求大，可控性强，成本高
```

### Q2: 提示词是否越长越好？
```
A: 不是。遵循原则：
- 保持30-80个关键词
- 重要的放前面
- 避免矛盾描述
- 删除冗余词汇
```

### Q3: 如何避免生成的内容不一致？
```
A: 统一风格方案：
1. 使用风格设定节点生成统一的风格前缀
2. 保持同一场景使用相同的场景提示词
3. 角色保持相同的人物提示词基础
4. 使用相同的负面提示词
5. 固定视觉风格（REAL/ANIME/3D）
```

### Q4: 如何提升生成质量？
```
A: 多方面优化：
1. 使用高质量标签（masterpiece, 8k等）
2. 明确风格定义（photorealistic, anime style等）
3. 详细描述细节（lighting, composition等）
4. 添加专业术语（cinematic, professional等）
5. 使用负面提示词排除问题
6. 提高分辨率参数
```

---

## 十、总结与建议

### 10.1 三大类型选择指南

| 类型 | 优势 | 劣势 | 适合场景 |
|------|------|------|----------|
| REAL写实 | 真实感强，代入感好 | 成本高，细节要求高 | 现代、历史、悬疑 |
| ANIME 2D | 风格多样，表现力强 | 可能显得幼稚 | 校园、奇幻、古风 |
| 3D渲染 | 可控性强，特效好 | 制作周期长 | 科幻、魔幻、喜剧 |

---

### 10.2 风格选择决策树

```
题材是什么？
├─ 现代都市
│  ├─ 真实感 → REAL写实
│  └─ 浪漫化 → ANIME 2D清新漫画
│
├─ 古装历史
│  ├─ 正剧 → REAL写实纪录片风格
│  └─ 仙侠 → ANIME 2D国风
│
├─ 科幻未来
│  ├─ 硬核 → REAL写实或3D写实
│  └─ 软科幻 → 3D卡通或ANIME 2D
│
├─ 奇幻魔法
│  ├─ 成人向 → 3D写实或REAL
│  └─ 儿童向 → 3D卡通或ANIME 2D萌系
│
└─ 校园青春
   ├─ 写实 → REAL写实
   └─ 二次元 → ANIME 2D日系/韩系
```

---

### 10.3 最佳实践建议

1. **确定核心风格**：先确定REAL/ANIME/3D，再细化画风
2. **保持统一性**：全剧使用统一的风格设定
3. **场景与人物匹配**：确保风格一致性
4. **测试与迭代**：生成样片测试效果
5. **建立风格库**：保存成功的提示词模板
6. **参考优秀作品**：学习同类型作品的视觉风格
7. **技术与艺术平衡**：不要过度依赖技术参数

---

**文档版本**：v1.0
**最后更新**：2026-01-10
**适用于**：AIYOU短剧创作平台

---

## 附录：快速查询表

### 风格关键词速查

| 需求 | REAL | ANIME | 3D |
|------|------|-------|-----|
| 核心标签 | photorealistic, cinematic | anime style, masterpiece | 3d animated character, stylized 3d render |
| 质量 | 8k uhd, professional | best quality, official art | ray tracing, 8k, clean rendering |
| 光照 | natural lighting, volumetric | soft lighting, rim light | studio lighting, ambient occlusion |
| 质感 | realistic texture, sharp focus | cel shading, clean lines | toon shading, smooth surfaces, non-photorealistic |

### 题材风格速查

| 题材 | 推荐类型 | 关键词 |
|------|----------|--------|
| 霸总 | REAL | urban luxury, business, elegant |
| 古偶 | ANIME 2D | chinese style, hanfu, romantic |
| 仙侠 | ANIME 2D | xianxia, cultivation, ethereal |
| 科幻 | REAL/3D | cyberpunk, futuristic, neon |
| 校园 | ANIME 2D | school, youthful, cherry blossoms |
| 悬疑 | REAL | noir, mystery, dramatic shadows |

---

*本文档为AIYOU短剧创作的完整风格指南，建议保存并在创作时查阅*
