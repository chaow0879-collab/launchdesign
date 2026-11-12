# T 时间轴框架（v9）· engineering-2 Demo

只新增文件，没有改 `src/engine/*`、`src/nodes/*`、`src/scene.js`、`src/app.js`、`build.mjs`、`data/*`。

```
src/v9/timeline.js              框架本体（纯 JS，不 import three）
src/v9/demo/engineering-2.js    engineering-2 六镜头（纯数据 + 时间轴，不 import three）
src/v9/demo/bind-three.js       把状态写进 three（唯一 import three 的地方）
src/v9/demo/main.js             浏览器入口（镜头按钮 / 进度条 / 接触面板）
src/v9/demo/index.html          ES module 版页面（需 http）
src/v9/demo/demo.html           打好的单文件版（双击即开）
src/v9/demo/build-demo.mjs      打包 demo.html
src/v9/demo/serve.mjs           只读静态服务器（开发用）
src/v9/demo/verify.mjs          200 点采样断言（幂等/确定性/连续/不穿透/真接触/无源）
src/v9/demo/smoke.mjs           渲染层无头冒烟（不需要 WebGL）
src/v9/demo/render-filmstrip.mjs 自写光栅器出 PNG 胶片条（不需要浏览器）
```

## 跑起来

```bat
:: 单文件 demo（双击也行）
src\v9\demo\demo.html

:: 开发用（ES module）
node src\v9\demo\serve.mjs 8891
:: → http://127.0.0.1:8891/src/v9/demo/index.html

:: 断言
node --no-warnings src\v9\demo\verify.mjs
node --no-warnings src\v9\demo\smoke.mjs

:: 出胶片条 PNG
node --no-warnings src\v9\demo\render-filmstrip.mjs
```

`demo.html` 需要先打包一次（改了 `main.js` / `bind-three.js` / `engineering-2.js` 之后）：

```bat
node_modules\@esbuild\win32-x64\esbuild.exe src/v9/demo/main.js ^
  --bundle --format=iife --target=chrome100 --minify --outfile=src/v9/demo/.bundle.js
node src\v9\demo\build-demo.mjs
```

## 最小用法

```js
import {createTimeline, track, sequence, parallel, delay,
        appear, dissolve, move, path, rotate, scale, deform, flow, contact,
        easeInOutCubic, expoOut} from '../timeline.js';

const tl = createTimeline(parallel(
  track('floor', [appear({at: 0, dur: .5})], {origin: [0, .8, 0], half: [1.2, .03, .75], opacity0: 1}),
  track('pack', [
    appear({at: .3, dur: .7}),
    path({at: 1.1, dur: 3.6, ease: 'easeInOutSine', points: [[3.6, .02, 0], [0, .02, 0]]}),
    contact('floor', {face: 'bottom', gap: .004, at: 4.8}),   // 碰到地板就停
    move({at: 4.8, dur: 2.2, by: [0, .70, 0], ease: 'easeInCubic'})
  ], {origin: [3.6, .02, 0], half: [1.15, .225, .68]})
));

tl.duration;              // 轨道时长并集
tl.stateAt(6.0).pack;     // {opacity,pos,rot,scale,deform,flow,contact,...}
tl.seek(6.0).get('pack'); // 同上（游标）
tl.track('pack').beats;   // 逐 beat 的可观测信息
```

## 三条硬约束（自检脚本会验）

1. `stateAt(t)` 只依赖 t 与初始状态：无时钟、无随机数。
2. `move` 用 `by` 相对位移，从该 beat 起点已解状态累加，不再每帧从头算。
3. `contact(other, face)` 在求解期把对象钉在接触面前；穿深恒 0。
