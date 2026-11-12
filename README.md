# 龙创汽车设计 · 交互动画 v8

26 个工序节点的 Three.js 互动演示，单页应用。构建产物是纯静态文件，可放到任意静态服务器。

## 目录

```
src/engine/   渲染核心、真车、全息道具、车内系统
src/nodes/    26 个工序的动画脚本（每个 6 个镜头）
src/app.js    页面与播放逻辑
data/         业务数据（story.json / beats.json / shots-v7.json）
tools/        辅助脚本（截图、探针、节拍工具）
build.mjs     构建脚本
dist/         构建产物（提交在仓库里，服务器直接托管）
```

## 构建

需要 Node.js 20+ 和 `npm install`（依赖 esbuild + three）。

```bash
export LC_ASSETS=<素材目录>     # 内含 audio-manifest.json、assets/audio/*.mp3、assets/tesla-model-3.glb
node build.mjs                  # 单文件版 → out/龙创汽车设计_交互动画_v8.html（约 22MB，全部内嵌）
node build.mjs --site           # 网站版   → out/site/（index.html + model.glb + audio/*.mp3，约 17MB）
node build.mjs --web            # 嵌入用的片段版
```

`LC_ASSETS` 的结构要求：

```
<素材目录>/
  audio-manifest.json          { "<节点id>": {duration, segments:[{captionText,...} ×6]} }
  assets/audio/<节点id>.mp3    26 段配音
  assets/tesla-model-3.glb     车模
```

> 原环境把素材放在 `/home/claude/longchuang-anim/unpacked`；本机用 `LC_ASSETS` 指向整理好的副本，不必改代码。

## 部署

`dist/` 是**站点版**构建产物（`index.html` + `model.glb` + `audio/*.mp3`），由 `node build.mjs --site` 生成；它不是单份 HTML，不能脱离同目录的车模与配音单独打开。

单文件版用 `node build.mjs` 生成 `out/龙创汽车设计_交互动画_v8.html`（约 22.5MB，模型/脚本/样式/26 段配音全部内嵌），生成方式、体积构成与站内 `/download/` 挂载见 [`docs/单文件交付说明.md`](docs/单文件交付说明.md)。

```bash
bash /root/ld install        # 识别为静态站，不注册 node 服务
bash /root/ld caddy static   # Caddy 直接托管 dist/
```

更新流程（站点版）：本地改代码 → `node build.mjs --site` → 覆盖 `dist/` → 提交推送 → 服务器 `bash /root/ld deploy`。单文件版按 `docs/单文件交付说明.md` 单独发布到 `/download/`。

## 构建注意

- `build.mjs` 默认走 esbuild 的可执行文件（部分受限环境里 Node 起子进程会被拦），找不到时自动回退到 esbuild JS API。
- 车模 8.3MB、配音 7.5MB，首屏只加载 HTML（1.4MB），车模与配音并行拉取并缓存。
