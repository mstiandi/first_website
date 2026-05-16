# CLAUDE.md — 精神避难所 v5

## 项目概览
- **域名**: hzd-ms.com (GitHub Pages, 仓库 mstiandi/first_website, master 分支)
- **技术栈**: Three.js r0.160.0 (CDN), 原生 JS (无框架), CSS
- **入口文件**: `index.html` → `js/main.js` → `js/entrance.js` → `js/scene.js`
- **本地路径**: `D:/websites/just_me`

## 迭代记录（强制）
- **每次非细节的大改动（新功能、架构变更、重要修复）** 必须在 `iterations/` 文件夹中新建一个文件
- 文件命名: `NNN-简短描述.md`（如 `001-mvp-cylindrical-panorama.md`）
- 使用 `_template.md` 模板，记录目标、改动、踩坑、结果
- **这是一个强制性要求，不要等用户提醒**
- 细节改动（改颜色、调参数、修错字）不需要迭代记录

## 铁律 — 每次改动后必须做
1. **增量版本号**: `index.html` 中 scene.js 的 `?v=N` 每次提交都要 +1，否则 CDN 缓存旧文件
2. **浏览器验证**: 改完先用 Playwright 或实际浏览器打开域名确认生效，再报告"完成"
3. **纹理方向**: 任何贴图（视频、图片）都必须先确认方向正确再提交。用 Canvas2D `ctx.scale(-1,1)` 预翻转是可靠方案
4. **提交**: `git add <具体文件> && git commit -m "<描述>" && git push`，不要漏文件

## 已踩过的坑 — 禁止再犯

### 纹理镜像
- **问题**: Three.js 不同渲染路径纹理方向不一致。圆柱 BackSide、scene.background、VideoTexture 各有各的处理
- **解决**: 
  - 圆柱视频: UV 翻转 `uv.setX(i, 1 - uv.getX(i))`
  - scene.background: Canvas2D `ctx.scale(-1, 1)` 预翻转
  - **不确定方向时，先用标注左右上下的测试图验证，别猜**

### Three.js 旋转方向
- camera.rotation.x **正值** = 仰天 (look UP)，**负值** = 看地面 (look DOWN)
- camera.rotation.y **正值** = 看右边，**负值** = 看左边
- `targetRotation = -Math.PI/2` 是看地下，不是看天上

### CDN 缓存
- GitHub Pages 会缓存 HTML 和 JS 文件
- 每次改 scene.js 必须升 `?v=N` 版本号
- 测试用 `https://hzd-ms.com/?r` 绕过缓存（参数值随便写）

### 天空/仰天功能
- **不要用** PlaneGeometry 或 CircleGeometry 做天空顶盖（容易被遮挡或方向错乱）
- **直接用** `scene.background = texture` 切换背景（已验证可行）
- 天空纹理在 `buildScene` 之前用 Canvas2D 加载并翻转好

### 大文件
- GitHub 单文件上限 100MB，超过会 push 失败
- 视频素材用 ffmpeg 转 H.264 1080p 后再提交
- `海崖.mp4` (121MB) 没提交，提交的是 `海崖_web.mp4` (3.9MB)

### ffmpeg 视频转码
- 8K → 1080p H.264: `ffmpeg -i input -c:v libx264 -preset fast -crf 23 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -c:a aac -b:a 128k -r 30 output`

## 当前架构

### 文件结构
```
index.html          → 入口，加载 CDN + 所有 JS
css/style.css       → 聊天覆盖层、提示文字样式
js/main.js          → 编排：ChatSystem.init() → EntranceAnimation.start(callback) → MainScene.start() + AudioEngine.playOcean()
js/entrance.js      → 眼镜入场动画 (~3.8s)，独立 Three.js scene
js/scene.js         → 主场景：圆柱视频面板 + 左黑面板 + 双击仰天
js/chat.js          → 无痕聊天：左拖进入，文字浮现/消失，本地回声
js/audio.js         → Web Audio API 海洋环境音
videos/海崖_web.mp4 → 1080p H.264 海崖视频
images/蓝天.png     → 仰天时的天空图片 (1626×1082)
```

### 主场景参数
- 圆柱半径 8，高 7，FOV 35°，相机原点
- 视频面板 90° arc，左侧黑面板 35° arc
- 水平旋转 ±30°
- 双击: camera.rotation.x 在 0 (坐姿) 和 +π/2 (仰天) 之间切换
- 仰天时 scene.background = 天空纹理，坐姿时 = 黑色

### 交互
- 鼠标移动 → 左右转视角
- 双击 → 仰天/坐起
- 左拖 70px → 进入聊天
- 聊天中按 Esc → 退出聊天

## 用户偏好
- 先验证再报告完成，不要推完代码就说"好了"
- 方向/镜像问题必须打开浏览器确认，不准猜
- 不要反复改同一个问题，一次想透再动手
- 简洁回复，不要长篇总结
- 用户是 PKU 心理学大一学生，设计品味明确，按蓝图执行即可
