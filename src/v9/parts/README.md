# P 部件与模型 · v9 程序化部件库

**目标**：替换 `src/engine/systems.js` 里"平直 Box/Cylinder + 单一 roughness"的程序化部件，解决两条用户原话——**"模型没有塑料方块感"**、**"科技感强"**。

**只新增文件**：本目录以外的任何文件都没有改动（`src/engine/*`、`src/nodes/*`、`src/css/*`、`src/app.js`、`src/scene.js`、`build.mjs`、`data/*` 全部零改动）。本库**不调用现有 `engine/kit.js`**，自带最小注册器。

---

## 1. 接口

```js
import * as THREE from 'three';
import {createParts, CATALOG, TOTAL_BUDGET} from './src/v9/parts/index.js';

const parts = createParts(THREE, {car});        // car 可选：传现有 car api 时白车身贴合真实车顶线
const seat = parts.build('seat');               // → THREE.Group
scene.add(seat);

seat.name;                     // 'seat'
seat.userData.kind;            // 'part'
seat.userData.tris;            // 构建时统计的三角面（自检用）
seat.userData.subparts;        // {cushion: Group, backrest: …, bolsters: [..], …}
seat.bolsters[0].position.x;   // 可控子件同时挂成组属性，动画可直接取
```

- `parts.catalog`：部件清单（key / label / budget / nodes）。
- `parts.build(key, opts)`：建单个部件。`parts.buildAll()`：全部建一遍。
- `parts.stats(group)`：`{tris, meshes, verts, tiers, size, subparts, nan}`。
- `parts.dispose(group)`：释放几何 / 材质 / 贴图。
- `parts.G / parts.L / parts.M / parts.F`：几何 / 贴图 / 材质 / 紧固件工具箱（新部件可直接复用）。

**与现有工序脚本对接**（不改现有文件，由接入方在节点里调用）：

```js
// 例如 engineering-2 的"模组落位紧固"
const pack = parts.build('batteryPack');
pack.modules.forEach((m, i) => { /* 逐个落位 */ });
pack.lid.position.y = .12;                  // 上盖可单独抬起
K.add(pack);                                // 沿用现有 kit 的登记/透明度驱动
```

`build()` 产出的组仍然是普通 `THREE.Group`，交给现有 `K.add()` / `op()` 即可按现有时间轴淡入淡出；每个部件内部自带 palette（材质实例互不共享），不会出现"改一个部件的透明度，另一个跟着变"。

---

## 2. 部件清单与预算

单件三角面上限按任务卡执行；编号括号里是对象数量。

| 部件 | key | 三角面 | 上限 | 网格 | 可控子件（主要） | 材质档位 | 用途节点 |
|---|---|---:|---:|---:|---|---|---|
| 座椅总成 | `seat` | 7356 | 8000 | 64 | `cushion` `backrest` `headrest` `bolsters[2]` `backBolsters[2]` `rails[2]` `bolts[4]` `recliners[2]` `buckle` `strap` `piping` `tag` | fabric · shell · machined · plastic · rubber · label | concept-2 / validation-1 |
| 电池模组 | `batteryModule` | 2504 | 3000 | 66 | `housing` `frameTop` `endPlates[2]` `cells[6]` `busbars[2]` `bridge` `terminals[2]` `bolts[2]` `bms` `label` `warn` | shell · machined · plastic · copper · pcb · rubber · label | engineering-2 / validation-3 |
| 电池包总成 | `batteryPack` | 15438 | 20000 | 301 | `modules[12]` `tray` `walls[4]` `ribs[7]` `mounts[4]` `coolantPlate` `coolantChannel` `coolantHoses[2]` `busbar` `busbars[2]` `hvTerminals[2]` `hvConnector` `lid` `gasket` `lidBolts` `bms` `relays[3]` | shell · machined · plastic · copper · rubber · pcb · label | engineering-2 / validation-1 |
| 电驱总成 | `driveUnit` | 7028 | 9000 | 37 | `motor` `housing` `fins` `bells[2]` `gearbox` `shafts[2]` `boots[2]` `inverter` `phases[3]` `hvPlug` `mounts[2]` `ground` | shell · machined · plastic · copper · rubber · label | engineering-2 / validation-2 |
| 区域控制器 | `ecu` | 3542 | 4000 | 54 | `base` `pcb` `chips[4]` `caps[4]` `connectors[2]` `pins[2]`(各16针) `lid` `fins` `gasket` `bolts[4]` `leds[3]` `label` | shell · pcb · plastic · machined · rubber · label · emissive | engineering-3 / validation-3 |
| 白车身骨架 | `biw` | 11130 | 30000 | 55 | `beams[]`（rocker/A-pillar/roof-rail/B-pillar/C-pillar/front-rail/rear-rail/floor-cross/roof-bow/bumper）`towers[2]` `firewall` `floorPan` `impactBars[2]` `joints[8]` `welds[3]` `bolts` | shell · machined · label | engineering-1 / launch-1 |
| 悬架角总成 | `suspension` | 7488 | 12000 | 81 | `spring` `damper` `dustBoot` `bumpStop` `topMount` `arm` `bushings[2]` `ballJoint` `knuckle` `hub` `studs[5]` `disc` `hat` `caliper` `pads[2]` `swayLink` | shell · machined · chrome · rubber · plastic · ceramic · label | engineering-2 / validation-2 |
| 制动角总成 | `brake` | 3798 | 9000 | 26 | `hub` `studs[5]` `disc` `vanes` `hat` `caliper` `pistons[4]` `bridge` `line` `shield` `sensor` | machined · shell · chrome · rubber · plastic · label | validation-2 / engineering-4 |
| 车门板件 | `doorPanel` | 5252 | 9000 | 41 | `skin` `charLine` `sillSeam` `frontSeam` `frame` `beltReinf` `glass` `frit` `handle` `hinges[2]` `seal` `innerPanel` `ribs[4]` `speakerMesh` `emblem` `vin` | paint · glass · shell · chrome · machined · plastic · rubber · label | cas-2 / classa-2 |
| 立铣刀 | `endMill` | 1206 | 2500 | 9 | `holder` `nut` `notches` `body` `flutes[3]` `tip` `mark` | machined · label | clay-1 / launch-1 |
| 六轴机械臂 | `robotArm` | 4698 | 9000 | 25 | `base` `baseBolts` `j1` `turret` `arm` `upper` `lower` `joints[3]` `wristCable` `conduit` `toolFlange` `gripper` `fingers[2]` | shell · machined · rubber · label | launch-1 / clay-1 |
| 快速夹钳 | `toggleClamp` | 1930 | 4000 | 25 | `basePlate` `post` `armGrp` `armPlates[2]` `yoke` `spindle` `screw`(真螺纹) `adjNut` `pad` `handleArm` `link` `pins[3]` `bolts[2]` | machined · rubber · chrome · label | launch-1 |
| 百分表检具 | `gauge` | 1680 | 3000 | 16 | `baseBody` `switchKnob` `post` `knuckleA/B` `armRod` `dialBody` `bezel` `face` `ticks` `needle` `glassFace` `stem` `tip` `ringGo` `ringNoGo` | shell · plastic · rubber · machined · chrome · glass · label | launch-1 / validation-2 |

**合计 73,050 三角面 / 800 网格 / 184,764 顶点，占 120,000 预算的 61%**（余 46,950）。逐件全部在各自上限内。

尺寸可信（与现有场景同一坐标系，米）：车长 4.747（白车身）、坐垫上表面 0.32 / 座椅总高 0.875、电池包 2.30×1.36×0.14（模块 0.59×0.115×0.35）、ECU 180×120×40mm、电驱 φ305×约 400mm、制动盘 Ø340。

---

## 3. 去塑料感的六个具体手法

### ① 真倒角与圆角（不是默认参数的圆角盒）
`geo.js` 里三种基元，按零件厚度选：**圆角盒**（球面推出法：把外盒表面点向"内盒"做等半径推出，法线解析给出 → 圆角带是连续高光带，平面区法线恒定）、**倒角块**（44 面：6 面 + 12 倒棱 + 8 角）、**拉伸板**（带 bevel 的圆角矩形，薄板四角半径 6mm、厚度方向 0.8mm 倒棱）。半径按真实比例：薄板 2–3mm、壳体 4–6mm、铸件 8–12mm。
效果：掠射光下边缘出现一条连续亮带，方块感消失；这是"看出不是方块"最直接的一层。

### ② 同一部件内分材质档位（7–8 档，而不是一个 MeshStandard）
`materials.js` 定义 17 个档位，任务卡要求的档位全部落到参数上：壳体 `.45/.35`、加工件 `.25/.80`（另加 `anisotropy .42` + `anisotropyRotation`，做出刀纹方向的高光拉长）、塑料 `.60/0`、橡胶 `.85/0`、玻璃 `roughness .04 + opacity .30`（可传 `transmission` 换真折射）、铭牌走程序化贴图。另有织物 `sheen 1 / sheenRoughness .9`、铜、碳纤维、车漆 clearcoat、PCB、镀铬、陶瓷。
效果：一个电池模组里同时有深冲铝壳、铣削端板、黑色塑料电芯盖、铜排、PCB、橡胶密封、铭牌——材质对比本身就是"工业件"的信号。

### ③ 面板线与分缝（几何凹槽，不是贴图）
`geo.js:seam()` 生成一条深约 0.9–2mm、宽 1.6–8mm 的三角截面凹槽，沿路径扫掠后压在表面上：车门的下裙线、前缘分缝、电池包上盖密封胶条、ECU 壳体合缝都用它；车门还额外用 `bead()` 做了一条腰线特征棱（半径 2.8mm 的凸棱，掠射光会拉出高光）。车门外板本身拆成"外板 + 窗框 + 玻璃 + 内板"四层，而不是一整块板。
效果：近看有真实分块与缝隙；远看轮廓上有明暗断点，不再是"一整块光板"。

### ④ 真连接件（六角头 + 垫圈 + 螺纹段 + 真针脚）
`fasteners.js`：螺栓＝车削六棱柱头（6 段，带顶部倒角）+ 法兰垫圈（10 段环）+ 杆 + **螺旋三角棱条螺纹**（22 段，牙距 1.25mm；不是贴图）；另有螺母（六角带孔）、垫圈、轮毂螺柱、高压端子（铜排 + 圆孔 + 螺纹柱 + 绝缘帽）、**ECU 针脚阵列**（2×8 方形冲压针，合并成一个几何）、管夹（整圈钢带 + 橡胶内衬 + 耳片）。静止的大批量连接用 `boltArray()` 合并，省 draw call。
效果：`engineering-2` 原来"小球当螺栓"的问题消失；端盖上一圈螺栓头在暗场里自带秩序感。

### ⑤ 程序化贴图（canvas 现场画，零联网）
`labels.js` 生成：金属拉丝（map + roughnessMap）、**粗糙度噪声**（打破单一 roughness，高光边缘会"碎"）、铭牌（品牌行 + 规格 + 序列号 + 条码 + 二维码）、高压警示三角、橙白警示斜纹、PCB（走线 + 焊盘 + 丝印 U1/C12）、冲孔六角网、织物斜纹（map + bumpMap）、碳纤维斜纹、铸造钢印（ALSi9Cu3 / PA66-GF30）、测量网格、软阴影、LED 光晕。
全部用确定性哈希（`sin` 哈希）生成，**同一个 seed 永远同一张图**，无 `Math.random`。

### ⑥ 法线与平滑：该软的软、该硬的硬
`geo.js:creaseNormals(geo, angle)` 按折角重新分组法线：同一位置上的面法线夹角小于阈值才平均，超过阈值（车削台阶、型材翻边、倒角棱）直接拆成硬边；圆角盒本身用解析法线（平面区恒定、圆角带连续）。弹簧、波纹管、线缆用 `computeVertexNormals` 全平滑。
效果：台阶是脆的、圆角是顺的——这是"塑料感 vs 金属感"的分水岭之一。

**附加（第 7 条，工艺特征）**：白车身梁柱用 `sweep()` 扫掠**帽形 / C 型槽 / 椭圆管**闭合截面（带翻边、端盖、截面沿路径渐变），不是圆柱管；加上加强筋、减轻孔、散热鳍片、减震塔、溃缩盒、焊道（`bead()`，带波纹）、密封胶条、螺栓圈。这些是"设计过"的证据。

---

## 4. bench 输出

```
$ node src/v9/parts/bench.mjs

P 部件库 · 三角面验收  (three r180 · v9-parts-1.0.0)

部件             │ key             │   三角面 │     上限 │    用量 │  网格 │  子件 │ 尺寸 x×y×z (m)         │ 状态
─────────────────┼─────────────────┼──────────┼──────────┼─────────┼───────┼───────┼────────────────────────┼────────
座椅总成         │ seat            │     7356 │     8000 │     92% │    64 │    27 │ 0.709×0.875×0.627      │ 临界
电池模组         │ batteryModule   │     2504 │     3000 │     83% │    66 │    14 │ 0.626×0.155×0.378      │ OK
电池包总成       │ batteryPack     │    15438 │    20000 │     77% │   301 │    23 │ 2.787×0.237×1.778      │ OK
电驱总成         │ driveUnit       │     7028 │     9000 │     78% │    37 │    20 │ 0.383×0.413×0.668      │ OK
区域控制器       │ ecu             │     3542 │     4000 │     89% │    54 │    22 │ 0.222×0.057×0.147      │ OK
白车身骨架       │ biw             │    11130 │    30000 │     37% │    55 │    17 │ 4.747×1.116×1.688      │ OK
悬架角总成       │ suspension      │     7488 │    12000 │     62% │    81 │    37 │ 0.62×1.022×0.595       │ OK
制动角总成       │ brake           │     3798 │     9000 │     42% │    26 │    15 │ 0.34×0.453×0.135       │ OK
车门板件         │ doorPanel       │     5252 │     9000 │     58% │    41 │    21 │ 1.1×0.706×0.78         │ OK
立铣刀           │ endMill         │     1206 │     2500 │     48% │     9 │     7 │ 0.039×0.082×0.04       │ OK
六轴机械臂       │ robotArm        │     4698 │     9000 │     52% │    25 │    17 │ 0.835×1.021×0.822      │ OK
快速夹钳         │ toggleClamp     │     1930 │     4000 │     48% │    25 │    16 │ 0.296×0.159×0.156      │ OK
百分表检具       │ gauge           │     1680 │     3000 │     56% │    16 │    18 │ 0.273×0.304×0.182      │ OK
─────────────────┼─────────────────┼──────────┼──────────┼─────────┼───────┼───────┼────────────────────────┼────────
合计             │                 │    73050 │   120000 │     61% │   800 │   254 │                        │ OK

材质档位分布：
  machined(13)  label(13)  shell(11)  rubber(11)  plastic(9)  chrome(5)  copper(3)  pcb(3)  glass(2)  fabric(1)  emissive(1)  ceramic(1)  paint(1)

几何自检（有符号体积 / 绕序，负值=法线朝内）：
  rbox 200×100×100 r6           体积 1.987e-3  期望 2.000e-3  偏差 0.7%  ✓
  chamferBox 100³ c4            体积 9.907e-4  期望 1.000e-3  偏差 0.9%  ✓
  lathe 圆柱 r50 h100           体积 7.765e-4  期望 7.854e-4  偏差 1.1%  ✓
  sweep 矩形管 20×10 L200       体积 4.000e-5  期望 4.000e-5  偏差 0.0%  ✓
  curvedPanel 900×600 t1.6      体积 8.595e-4  期望 8.640e-4  偏差 0.5%  ✓

顶点 184,764 · 网格 800 · 构建耗时 522 ms
预算：单件见上表，全部部件加总 ≤ 120,000（当前 73,050，余 46,950）

✓ 全部通过：预算、尺寸、结构、确定性（无随机数）
```

bench 除了算三角面，还会检查：**预算**、**尺寸合理性**、**`userData.kind==='part'` / `name` / 子件数量≥3**、**两次构建的三角面/顶点/位置哈希一致（确定性）**、**顶点无 NaN**、**闭合件的绕序与体积**（发现过车门外板折边有一条反绕序，已修）。`--json` 输出机读结果，退出码非 0 表示有项不合格。

---

## 5. 自检命令

```bash
cd projects/longchuang-v8

# 1) 语法（13 个文件，全部 ESM；parts/package.json 声明 type=module 就是为了 node --check 可靠）
for f in src/v9/parts/*.js; do node --check "$f" || echo "FAIL $f"; done

# 2) 三角面 / 尺寸 / 绕序 / 确定性
node src/v9/parts/bench.mjs

# 3) 确认几何是确定性生成（应为 0 处）
grep -rn "Math.random" src/v9/parts/ || echo "无 Math.random"
```

预览（可选，需要一个静态服务器，浏览器直接开 `file://` 会被 ES module 的 CORS 拦住）：

```bash
npx serve .            # 或任意静态服务器
# 打开 http://localhost:3000/src/v9/parts/preview.html
# W 线框 / R 真实尺度 / D 统一尺度归一化 / 1-9 单独看某件
```

`preview.html` 用 PMREM `RoomEnvironment` 做环境反射、三灯打光、ACES 色调映射——和 `engine/core.js` 的影棚设置一致，用来判断倒角高光与材质对比是否成立。

---

## 6. 文件

```
src/v9/parts/
  index.js      createParts(THREE, opts) + 最小注册器 reg/expose + CATALOG + stats/dispose
  geo.js        圆角盒 / 倒角块 / 拉伸板 / 扫掠型材 / 车削 / 螺纹 / 波纹管 / 弹簧 / 板缝 / 曲面钣金 / 焊缝 / crease 法线 / 合并
  materials.js  17 个材质档位 + 每部件独立 palette
  labels.js     canvas 程序化贴图（拉丝/噪声/铭牌/警示/斜纹/PCB/冲孔网/织物/碳纤/钢印/网格/软阴影）
  fasteners.js  螺栓 / 螺母 / 垫圈 / 螺柱 / 端子 / 针脚阵列 / 管夹 / 螺栓阵
  seat.js battery.js drive.js ecu.js body.js chassis.js panel.js tooling.js
  bench.mjs     三角面验收（Node 离线，不渲染）
  preview.html  可视化预览（真实环境反射 + 三灯）
  package.json  只为 "type": "module"（让 node --check / bench 按 ESM 解析）
  README.md
```

---

## 7. 风险与限制

1. **draw call 偏高（800 网格）**。这是"分材质 + 可动画子件"的代价。当前 26 个节点每个只点亮少量系统，单屏幕实际网格数远小于 800；若要进一步压，可用 `boltArray()` 合并静态紧固件（已支持），或对同材质的相邻小件做 `mergeGeos`（会失去单独驱动的能力）。
2. **金属档依赖环境反射**。`shell` / `machined` / `chrome` / `copper` 的高光质量取决于 `scene.environment`。现有 `engine/core.js` 已经烘了 PMREM RoomEnvironment（`environmentIntensity .75`），可以直接用；如果接到没有 environment 的场景，金属会显得发灰——那时需要补一张环境贴图，而不是调 roughness。
3. **各向异性（anisotropy）需要切线或 UV 导数**。我用 `anisotropy .42` 做刀纹高光；three r180 在没有 `tangent` 属性时会从 UV 导数推导，低模件在极端角度可能有轻微瑕疵，把 `anisotropy` 调 0 即可退化。
4. **玻璃走 opacity .30 而不是 transmission**。transmission 需要额外渲染目标，且与现有 `kit.op()` 的透明度动画（它会强制 `transparent=true`）冲突；需要真折射时给 `P.tier('glass', {transmission: .9})`。
5. **座椅 92%、ECU 89% 接近上限**。再加细节前先跑 bench；座椅的大头是 4 块发泡/面套（各 300～588 面）与 4 颗螺栓。
6. **没有在浏览器里截图验收**。本机沙箱禁止 Chromium 启动（crashpad `OpenProcess` 被拒），所以视觉验收走的是 `preview.html` + bench 的几何自检（体积/绕序/尺寸），而不是截图对比。请在能开浏览器的环境里跑一次 `preview.html` 复核。
7. **尺寸以现有车模为基准**：车长 4.747m、轮心 y=0.36、轴距按 `car.wheelCenters`。`buildBiw({car})` 会读 `car.topAt(x).roof` 贴车顶线；不传 `car` 时用内置近似曲线（`roofAt`），造型会略平但尺寸仍在量级内。
