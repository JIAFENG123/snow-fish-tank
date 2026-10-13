# 雪地孔雀鱼缸（Three.js + Blender）

暗色房间里一座开着灯的玻璃鱼缸：缸内是雪地造景（雪面、石头、枯木），12 条孔雀鱼在灯光下游动，缸内还飘着雪，可以点击喂食。

## 运行步骤

1. 安装依赖（本目录下执行）

```
npm install --include=dev
```

2. 用 Blender 导出布景模型（生成 `public/scene.glb`，已提交则可跳过）

```
npm run model
```

3. 启动

```
npm run dev
```

浏览器打开终端里显示的地址（默认 http://localhost:5173）。

## 操作

- 点击缸内水面：撒鱼食，附近的鱼会游过来抢食
- 拖动：旋转视角；滚轮：缩放
- `Space`：开关缸内飘雪
- `R`：复位视角

## 用了什么技术

- Three.js：渲染、OrbitControls 相机、MeshPhysicalMaterial 玻璃（transmission 折射）、ACES 色调映射
- 灯光设计：暗色渐变背景 + 雾，主光是缸顶 Spotlight（投射阴影照亮雪景），LED 灯条 MeshBasicMaterial 发光，冷色补光勾出玻璃轮廓，缸下黑色底柜 + 暗色地面
- Blender 5.2 无头脚本（`blender/make_scene.py`）：程序化生成缸内雪地、6 块雪帽石头、2 根枯木、石子，按面法线分配雪/岩石/木头材质，导出 GLB
- 孔雀鱼建模（对照 Poecilia reticulata 形态资料）：纺锤形侧扁身体（背平腹圆、吻部上翘=高位口）、大眼、Canvas 程序化贴图（反荫蔽 + 后半身色块 + 网状鳞纹=reticulata + 斑点，雌鱼有妊娠斑）、扇形尾鳍（独立 YZ 平面 UV + 鳍条纹理）、大三角背鳍、胸鳍/腹鳍、雄鱼棒状交接器（gonopodium）、雌鱼小尾鳍半透明
- 游动 AI：游荡 + 墙壁/障碍物（石头枯木球体）排斥 + 鱼间距分离 + 觅食寻路，转向用速度插值、身体沿速度朝向并带转弯倾斜，摆尾频率随速度变化
- 喂食：射线拾取水面位置，鱼食下沉（射线检测落在雪面/石头上），鱼靠近后吃掉缩小消失
- 缸内飘雪：450 个粒子在缸内水柱中下落，落到雪面后从缸顶重生
- 水体：半透明水盒 + 正弦波顶点动画水面 + 皂泡上升粒子
- Vite 构建，`render.yaml` 可直接部署到 Render 静态站

## 目录

```
blender/make_scene.py   Blender 布景脚本（npm run model 调用）
public/scene.glb        导出的缸内雪景模型
src/main.js             场景、灯光、鱼缸、水、飘雪、喂食、输入
src/fish.js             孔雀鱼几何体/贴色/游动逻辑
```
