import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Guppy, VARIANTS } from './fish.js';
import { music } from './music.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const fishNEl = $('fishN');
const foodNEl = $('foodN');
const snowEl = $('snowState');
const musicBtn = $('musicBtn');
const volSlider = $('volSlider');

function updateMusicUI() {
  musicBtn.textContent = music.playing ? '♫ 音乐:开' : '♫ 音乐:关';
}
musicBtn.addEventListener('click', () => {
  music.toggle();
  updateMusicUI();
});
volSlider.addEventListener('input', () => {
  music.setVolume(volSlider.value / 100);
});

// ---------------------------------------------------------------- renderer

const canvas = $('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();

// vertical sky gradient
{
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#04060a');
  grad.addColorStop(0.55, '#0a1018');
  grad.addColorStop(1, '#141d2a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
scene.fog = new THREE.Fog(0x0d121a, 16, 52);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 200);
const CAM_HOME = new THREE.Vector3(4.8, 3.1, 6.6);
const TARGET_HOME = new THREE.Vector3(0, 1.55, 0);
camera.position.copy(CAM_HOME);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET_HOME);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3.5;
controls.maxDistance = 22;
controls.maxPolarAngle = 1.48;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;

// shift+scroll to adjust volume
canvas.addEventListener('wheel', (e) => {
  if (!e.shiftKey) return;
  e.preventDefault();
  const v = Math.max(0, Math.min(100, parseInt(volSlider.value) - Math.sign(e.deltaY) * 5));
  volSlider.value = v;
  music.setVolume(v / 100);
}, { passive: false });

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;

// ---------------------------------------------------------------- lights

// dim room ambient
const hemi = new THREE.HemisphereLight(0x3d4c66, 0x0b0e14, 0.35);
scene.add(hemi);

// key light: the hood lamp above the tank, shining down into it
const hood = new THREE.SpotLight(0xf4f8ff, 35, 18, 0.95, 0.45, 2);
hood.position.set(0, 3.5, 0);
hood.target.position.set(0, 0.4, 0);
hood.castShadow = true;
hood.shadow.mapSize.set(2048, 2048);
hood.shadow.bias = -0.0004;
hood.shadow.normalBias = 0.02;
hood.shadow.camera.near = 0.5;
hood.shadow.camera.far = 14;
scene.add(hood, hood.target);

// warm glow right under the light bar (sparkle on glass + water)
const tankLamp = new THREE.PointLight(0xfff2e0, 8, 7, 2);
tankLamp.position.set(0, 3.25, 0);
scene.add(tankLamp);

// cool fills so glass edges and fish silhouettes read against the dark
const fill = new THREE.DirectionalLight(0x8fb2dc, 0.55);
fill.position.set(-7, 5, -6);
scene.add(fill);

const rim = new THREE.DirectionalLight(0x5f86c0, 0.7);
rim.position.set(7, 3, -8);
scene.add(rim);

// ---------------------------------------------------------------- constants

const INNER_X = 3.0;      // tank inner half-width
const INNER_Z = 1.8;      // tank inner half-depth
const FLOOR_Y = 0.10;     // tank inner floor
const WATER_Y = 2.80;     // water surface
const GLASS_T = 0.08;
const TOP_Y = 3.40;

const BOUNDS = {
  min: new THREE.Vector3(-2.7, 0.5, -1.5),
  max: new THREE.Vector3(2.7, 2.7, 1.5),
  obstacles: [
    // interior rocks (Three coords: blender (x,y,z) -> (x,z,-y))
    { x: -1.70, y: 0.16, z: -0.60, r: 0.74 },
    { x: -1.20, y: 0.16, z: -1.05, r: 0.47 },
    { x: 1.60, y: 0.16, z: 0.80, r: 0.82 },
    { x: 2.15, y: 0.16, z: 0.30, r: 0.41 },
    { x: 0.30, y: 0.16, z: 1.20, r: 0.60 },
    { x: -0.45, y: 0.16, z: -1.30, r: 0.33 },
    // driftwood segments
    { x: -1.69, y: 0.41, z: 0.64, r: 0.30 },
    { x: -0.70, y: 0.58, z: 0.17, r: 0.32 },
    { x: 0.29, y: 0.74, z: -0.30, r: 0.30 },
    { x: 1.80, y: 0.30, z: -0.91, r: 0.30 },
  ],
};

// ---------------------------------------------------------------- decor (GLB)

const decorRoot = new THREE.Group();
decorRoot.name = 'decor';
scene.add(decorRoot);
let decorReady = false;

new GLTFLoader().load(
  '/scene.glb',
  (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name.startsWith('snow_')) {
        o.castShadow = false;
        o.receiveShadow = true;
      } else {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    decorRoot.add(gltf.scene);
    decorReady = true;
    statusEl.style.display = 'none';
  },
  undefined,
  () => {
    statusEl.textContent = '加载 public/scene.glb 失败 — 请先运行 npm run model（Blender 导出）';
  },
);

// ---------------------------------------------------------------- tank glass

const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0,
  roughness: 0.02,
  transmission: 1,
  thickness: 0.06,
  ior: 1.52,
  transparent: true,
  side: THREE.FrontSide,
  specularIntensity: 1,
  envMapIntensity: 0.7,
  // transmissive glass renders before the transparent pass; if it writes
  // depth, everything translucent behind it (snow, water, bubbles) fails
  // the depth test and vanishes — only the open top stays visible
  depthWrite: false,
});

const tankParts = [];
function glassBox(w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  scene.add(m);
  tankParts.push(m);
  return m;
}
const W = INNER_X * 2 + GLASS_T * 2;
const D = INNER_Z * 2 + GLASS_T * 2;
glassBox(W, GLASS_T, D, 0, FLOOR_Y - GLASS_T / 2, 0);                 // bottom
glassBox(W, TOP_Y - FLOOR_Y, GLASS_T, 0, (TOP_Y + FLOOR_Y) / 2, INNER_Z + GLASS_T / 2); // front
glassBox(W, TOP_Y - FLOOR_Y, GLASS_T, 0, (TOP_Y + FLOOR_Y) / 2, -INNER_Z - GLASS_T / 2);// back
glassBox(GLASS_T, TOP_Y - FLOOR_Y, INNER_Z * 2, INNER_X + GLASS_T / 2, (TOP_Y + FLOOR_Y) / 2, 0);
glassBox(GLASS_T, TOP_Y - FLOOR_Y, INNER_Z * 2, -INNER_X - GLASS_T / 2, (TOP_Y + FLOOR_Y) / 2, 0);

// LED lamp bar across the top
{
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.5, 0.1, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.35, metalness: 0.7 }),
  );
  bar.position.set(0, TOP_Y + 0.14, 0);
  bar.castShadow = true;
  scene.add(bar);
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.7, 0.02, 0.24),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  strip.position.set(0, TOP_Y + 0.085, 0);
  scene.add(strip);
  const legGeo = new THREE.BoxGeometry(0.05, 0.16, 0.05);
  const legMat = bar.material;
  for (const lx of [-W / 2 + 0.35, W / 2 - 0.35]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, TOP_Y + 0.05, 0);
    scene.add(leg);
  }
}

// ---------------------------------------------------------------- stand & floor

{
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(40, 64),
    new THREE.MeshStandardMaterial({ color: 0x0a0d13, roughness: 0.72, metalness: 0.15 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.88;
  floor.receiveShadow = true;
  scene.add(floor);

  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.18, 0.9, D + 0.18),
    new THREE.MeshStandardMaterial({ color: 0x12151c, roughness: 0.4, metalness: 0.45 }),
  );
  stand.position.y = -0.43;
  stand.castShadow = true;
  stand.receiveShadow = true;
  scene.add(stand);
}

// ---------------------------------------------------------------- water

const waterMat = new THREE.MeshPhysicalMaterial({
  color: 0x69b8da,
  transparent: true,
  opacity: 0.32,
  roughness: 0.15,
  metalness: 0,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const waterBox = new THREE.Mesh(
  new THREE.BoxGeometry(INNER_X * 2, WATER_Y - FLOOR_Y, INNER_Z * 2),
  waterMat,
);
waterBox.position.set(0, (WATER_Y + FLOOR_Y) / 2, 0);
scene.add(waterBox);

// animated surface
const surfGeo = new THREE.PlaneGeometry(INNER_X * 2 - 0.04, INNER_Z * 2 - 0.04, 42, 26);
surfGeo.rotateX(-Math.PI / 2);
const surfBase = surfGeo.attributes.position.array.slice();
const waterSurface = new THREE.Mesh(
  surfGeo,
  new THREE.MeshPhysicalMaterial({
    color: 0x74c4de,
    transparent: true,
    opacity: 0.55,
    roughness: 0.05,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
waterSurface.position.y = WATER_Y;
scene.add(waterSurface);

// ---------------------------------------------------------------- guppies

const rng = () => Math.random();
const guppies = [];
const pick = ['neon', 'tiger', 'sunset', 'blue', 'neon', 'tiger', 'female', 'female', 'blue', 'female', 'neon', 'tiger'];
for (const name of pick) {
  const v = VARIANTS.find((x) => x.name === name);
  let pos = null;
  for (let tries = 0; tries < 40; tries++) {
    const p = new THREE.Vector3(
      THREE.MathUtils.lerp(BOUNDS.min.x, BOUNDS.max.x, rng()),
      THREE.MathUtils.lerp(0.8, 2.4, rng()),
      THREE.MathUtils.lerp(BOUNDS.min.z, BOUNDS.max.z, rng()),
    );
    const clear = BOUNDS.obstacles.every((o) => p.distanceTo(new THREE.Vector3(o.x, o.y, o.z)) > o.r + 0.35);
    if (clear) { pos = p; break; }
  }
  if (!pos) pos = new THREE.Vector3(0, 1.8, 0);
  const g = new Guppy(v, pos, BOUNDS, rng);
  guppies.push(g);
  scene.add(g.root);
}
fishNEl.textContent = guppies.length;

// ---------------------------------------------------------------- bubbles

const bubbles = [];
{
  const geo = new THREE.SphereGeometry(1, 8, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xdff4ff, transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0,
  });
  for (let i = 1; i < 27; i++) {
    const m = new THREE.Mesh(geo, mat);
    const s = 0.018 + rng() * 0.03;
    m.scale.setScalar(s);
    const ox = -2.55 + (rng() - 0.5) * 0.16;
    const oz = 1.35 + (rng() - 0.5) * 0.16;
    m.position.set(ox, FLOOR_Y + 0.2 + rng() * 2.4, oz);
    scene.add(m);
    bubbles.push({ m, ox, oz, speed: 0.35 + rng() * 0.5, phase: rng() * Math.PI * 2 });
  }
}

// ---------------------------------------------------------------- snowfall

// snow drifts down through the whole tank interior (fantasy snow-globe feel),
// lamp-lit, respawning at the top when it sinks into the snow bed
const SNOW_N = 700;
const snowPts = (() => {
  const pos = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * (INNER_X * 2 - 0.2);
    pos[i * 3 + 1] = 0.35 + Math.random() * (TOP_Y - 0.45);
    pos[i * 3 + 2] = (Math.random() - 0.5) * (INNER_Z * 2 - 0.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.PointsMaterial({
    size: 0.12, map: tex, transparent: true, depthWrite: false,
    opacity: 1.0, sizeAttenuation: true, color: 0xffffff,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  // draw after the water box/surface (transparent sort keys points at their
  // object origin, which sits deeper than the tank center, dimming flakes)
  pts.renderOrder = 2;
  scene.add(pts);
  return pts;
})();
const snowSpeed = new Float32Array(SNOW_N);
const snowPhase = new Float32Array(SNOW_N);
for (let i = 0; i < SNOW_N; i++) {
  snowSpeed[i] = 0.22 + Math.random() * 0.45;
  snowPhase[i] = Math.random() * Math.PI * 2;
}

// ---------------------------------------------------------------- food

const pellets = [];
const pelletGeo = new THREE.SphereGeometry(0.035, 8, 6);
const pelletMat = new THREE.MeshStandardMaterial({ color: 0xb5651d, roughness: 0.7, metalness: 0 });
const probeRay = new THREE.Raycaster();
probeRay.far = 6;

function spawnFood(x, z) {
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(pelletGeo, pelletMat);
    m.position.set(
      x + (Math.random() - 0.5) * 0.26,
      WATER_Y - 0.08 - i * 0.03,
      z + (Math.random() - 0.5) * 0.26,
    );
    m.scale.setScalar(0.7 + Math.random() * 0.6);
    scene.add(m);
    const p = {
      mesh: m,
      vy: -0.05,
      resting: false,
      restY: 0.13,
      probed: false,
      dying: false,
      dieT: 0,
      age: 0,
      seed: Math.random() * Math.PI * 2,
      eat() { this.dying = true; this.dieT = 0; },
    };
    pellets.push(p);
  }
  while (pellets.length > 80) {
    const oldest = pellets.find((p) => !p.dying);
    if (!oldest) break;
    oldest.dying = true;
  }
  foodCount++;
  foodNEl.textContent = foodCount;
}

let foodCount = 0;

function updatePellets(dt, t) {
  for (let i = pellets.length - 1; i >= 0; i--) {
    const p = pellets[i];
    if (p.dying) {
      p.dieT += dt;
      const s = Math.max(0, 1 - p.dieT * 5);
      p.mesh.scale.setScalar(s * 0.9);
      if (s <= 0) {
        scene.remove(p.mesh);
        pellets.splice(i, 1);
      }
      continue;
    }
    p.age += dt;
    if (!p.resting) {
      p.vy = Math.max(p.vy - 1.5 * dt, -0.9);
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x += Math.sin(t * 2 + p.seed) * 0.05 * dt;
      if (p.mesh.position.y <= 1.0 && decorReady) {
        probeRay.set(p.mesh.position, new THREE.Vector3(0, -1, 0));
        const hit = probeRay.intersectObject(decorRoot, true)[0];
        p.restY = hit ? hit.point.y + 0.04 : 0.13;
        p.probed = true;
      }
      if ((p.probed && p.mesh.position.y <= p.restY) || p.mesh.position.y <= 0.11) {
        p.resting = true;
        p.mesh.position.y = Math.max(p.restY, 0.11);
      }
    } else if (p.age > 22) {
      p.dying = true;
      p.dieT = 0;
    }
  }
}

// ---------------------------------------------------------------- input

const raycaster = new THREE.Raycaster();
const clickTargets = [waterSurface, ...tankParts];
let downX = 0, downY = 0;

canvas.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
  controls.autoRotate = false;
  // auto-start music on first interaction
  if (!music._started) {
    music.play();
    updateMusicUI();
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
  const ndc = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(clickTargets, false)[0];
  if (!hit) return;
  const fx = THREE.MathUtils.clamp(hit.point.x, -INNER_X + 0.25, INNER_X - 0.25);
  const fz = THREE.MathUtils.clamp(hit.point.z, -INNER_Z + 0.25, INNER_Z - 0.25);
  spawnFood(fx, fz);
});

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      snowPts.visible = !snowPts.visible;
      snowEl.textContent = snowPts.visible ? '开' : '关';
      break;
    case 'KeyR':
      camera.position.copy(CAM_HOME);
      controls.target.copy(TARGET_HOME);
      controls.autoRotate = false;
      break;
    case 'KeyM':
      music.toggle();
      updateMusicUI();
      break;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- loop

const clock = new THREE.Timer();
const world = { bounds: BOUNDS, pellets, guppies };
window.__qa = { camera, controls, guppies, scene, renderer };

function animate() {
  requestAnimationFrame(animate);
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsed();

  for (const g of guppies) g.update(dt, t, world);
  updatePellets(dt, t);

  for (const b of bubbles) {
    b.m.position.y += b.speed * dt;
    b.m.position.x = b.ox + Math.sin(t * 2.2 + b.phase) * 0.05;
    b.m.position.z = b.oz + Math.cos(t * 1.7 + b.phase) * 0.05;
    if (b.m.position.y > WATER_Y - 0.04) {
      b.m.position.y = FLOOR_Y + 0.15;
      b.m.position.x = b.ox;
    }
  }

  if (snowPts.visible) {
    const pos = snowPts.geometry.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < SNOW_N; i++) {
      const ix = i * 3;
      arr[ix + 1] -= snowSpeed[i] * dt;
      arr[ix] += Math.sin(t * 0.8 + snowPhase[i]) * 0.05 * dt;
      arr[ix + 2] += Math.cos(t * 0.7 + snowPhase[i]) * 0.04 * dt;
      if (arr[ix + 1] < 0.35) {
        arr[ix] = (Math.random() - 0.5) * (INNER_X * 2 - 0.2);
        arr[ix + 1] = TOP_Y - 0.06;
        arr[ix + 2] = (Math.random() - 0.5) * (INNER_Z * 2 - 0.2);
      }
    }
    pos.needsUpdate = true;
  }

  // water surface ripples
  {
    const p = surfGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = surfBase[i * 3], z = surfBase[i * 3 + 2];
      p.array[i * 3 + 1] =
        Math.sin(x * 2.1 + t * 1.4) * 0.016 +
        Math.sin(z * 3.2 + t * 1.1) * 0.012;
    }
    p.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();
