# 迭代 #1: MVP — 圆柱全景 + 双击仰天 + 无痕聊天

**日期**: 2026-05-15 ~ 2026-05-16
**Git commits**: 3699427 ~ 37996c6

## 目标
从零构建精神避难所 v5 MVP：入场动画 → 3D 圆柱全景 → 鼠标转视角 → 双击仰天 → 左拖聊天

## 改动
| 文件 | 操作 | 说明 |
|------|------|------|
| `index.html` | 新建 | 入口，CDN 加载 Three.js |
| `css/style.css` | 新建 | 聊天覆盖层、提示文字样式 |
| `js/main.js` | 新建 | 入口编排 |
| `js/entrance.js` | 新建 | 眼镜入场动画 (~3.8s) |
| `js/scene.js` | 新建/多次迭代 | 主场景：圆柱视频 + 黑面板 + 双击仰天 |
| `js/chat.js` | 新建 | 无痕聊天系统 |
| `js/audio.js` | 新建 | Web Audio 海洋环境音 |
| `CLAUDE.md` | 新建 | 项目规范与踩坑记录 |

## 关键决策
- 放弃 ShaderMaterial 海洋动态（GPU 性能问题）→ 直接用视频素材
- 放弃 CSS 3D 旋转（用户觉得别扭）→ Three.js 圆柱 Geometry
- 放弃三面板（左中右素材不全）→ 单视频面板 90° arc
- 天空从 PlaneGeometry/CircleGeometry 多次失败 → scene.background 纹理切换

## 踩坑
1. **视频镜像**: 圆柱 BackSide 渲染导致 UV 反向 → `uv.setX(i, 1 - uv.getX(i))`
2. **相机 X 轴方向搞反**: 负值看地面非天空 → 改为 `Math.PI / 2` 正值仰天
3. **CDN 缓存**: GitHub Pages 强缓存 → 每次改 js 必须升 `?v=N` 版本号
4. **天空平面不可见**: 几何体位置/朝向/遮挡问题 → 改用 scene.background 切换
5. **蓝天纹理镜像**: scene.background 纹理方向又反了 → Canvas2D `ctx.scale(-1,1)` 预翻转
6. **大文件 push 失败**: 海崖.mp4 121MB 超 100MB 限制 → ffmpeg 转 1080p H.264

## 结果
- 眼镜入场动画正常
- 单视频圆柱全景，±30° 旋转
- 双击仰天看蓝天（Canvas2D 翻转）
- 左拖进入无痕聊天
- 环境音播放
- 部署 hzd-ms.com 正常
