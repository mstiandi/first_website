# CLAUDE.md — 精神避难所 v5

## 项目概览
- **域名**: hzd-ms.com (GitHub Pages, mstiandi/first_website, master)
- **技术栈**: Three.js r0.160.0 (CDN), 原生 JS (IIFE 模块), 纯 CSS
- **本地路径**: `D:/websites/just_me`
- **本地服务**: `python -m http.server 8080`

## 文件结构
```
index.html              → 入口，加载 CDN + 所有 JS
css/style.css           → 聊天覆盖层、星光、流星、提示文字
js/main.js              → 编排：ChatSystem.init() → MainScene.start() + AudioEngine
js/scene.js             → 主场景：圆柱视频面板(海崖/家乡双击切换) + 黑面板 + 无人机入场
js/chat.js              → 无痕聊天：下拖进入/上拖退出，AI对话，文字浮现/消失
js/audio.js             → Web Audio API：海浪环境音 + 风铃(chime) + 孤星(resonance)
videos/海崖_web.mp4     → 1080p 主场景视频
videos/家乡.mp4         → 双击切换后的天空视频
```

## 当前架构

### 主场景 (scene.js)
- 圆柱半径 8，高 7，FOV 35°，相机原点在圆柱中心
- 视频面板 90° arc（居中于背面），左黑面板 35° arc（聊天入口）
- 两个 VideoTexture 同时播放（海崖 + 家乡），通过 `videoMat.map` 切换
- 双击触发放置 videoMat.map 在 seaTex ↔ homeTex 之间切换
- 入场动画：无人机落位（~4.5s ease-out 下降 + 悬停微颤 + 着地震颤）
- 入场前静默渲染等视频就绪，避免 shader 编译卡顿

### 聊天 (chat.js)
- 下拖 60px 进入，上拖 60px 或 Esc 退出
- 纯黑背景 + 白色星光（box-shadow 模拟，慢速闪烁）
- 忧郁灰蓝文字 #8ea4c0，Noto Serif SC 衬线体
- AI API: Vercel Serverless Function 代理 DeepSeek
- 音效: 发送=孤星轻吟(小三度)，收到=风铃(大三度)
- 流星: 冰蓝带冲击波+楔形尾迹+飞散粒子，从上中→左中斜向划过

### 环境音 (audio.js)
- Web Audio API 多层海浪噪声（低频+中频+泡沫）
- 入场 4.5s 淡入到 0.3 音量

## 铁律 — 每次改动必须做
1. **升版本号**: 改哪个 JS/CSS 就升对应的 `?v=N`，否则浏览器缓存旧文件
2. **浏览器验证**: 改完用 `http://localhost:8080` 确认生效再报告
3. **提交**: `git add <具体文件> && git commit -m "<描述>" && git push`

## 已踩过的坑

### CDN 缓存
- GitHub Pages 缓存 HTML/JS/CSS
- 每次改动必须升对应文件的 `?v=N`
- 测试可用 `https://hzd-ms.com/?r` 绕过

### 纹理方向
- 圆柱 BackSide 视频需要 UV 翻转: `uv.setX(i, 1 - uv.getX(i))`
- 球体 BackSide 不需要 UV 翻转
- 不确定方向时用测试图验证，别猜

### 大文件
- GitHub 单文件上限 100MB
- 视频用 ffmpeg 转 H.264 1080p: `ffmpeg -i input -c:v libx264 -preset fast -crf 23 -vf "scale=1920:1080:..." -r 30 output`

### 球体视频扭曲
- 普通视频（非 360° 全景）映射到球体会产生两极漩涡
- 躺下/仰天场景用圆柱面或直接切换纹理，不要用球体

## 项目约定
- 原生 JS，IIFE 模块模式，不引入框架
- CSS 用 `@import` 引入 Google Fonts（放文件顶部）
- 新功能先在 CSS 中写好样式，再在 JS 中加逻辑
- JavaScript 中用 `var` 声明（保持现有风格一致）
- 视频全部 autoplay + loop + muted + playsInline
