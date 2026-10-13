import * as THREE from 'three';

// ---------------------------------------------------------------- helpers

function seedRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (t >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth value noise for organic movement
function hashN(n) {
  let t = (Math.imul(n, 0x6d2b79f5) + 0x7fffffff) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function smoothNoise(t, seed) {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const a = hashN(i + seed * 9973);
  const b = hashN(i + 1 + seed * 9973);
  return a + (b - a) * u;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function parseHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function shadeArr([r, g, b], amt) {
  return [
    Math.max(0, Math.min(255, r + amt)),
    Math.max(0, Math.min(255, g + amt)),
    Math.max(0, Math.min(255, b + amt)),
  ];
}

// ---------------------------------------------------------------- textures

// Body: u (canvas x) runs belly(0) -> back(1); v (canvas y, flipY) runs
// tail(0, bottom) -> nose(1, top). Reticulated net = species "reticulata".
function bodyCanvas({ base, back, belly, rear, rearAlpha = 0.95, spots, seed, gravid, bars }) {
  const s = seedRandom(seed);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, belly);
  grad.addColorStop(0.45, base);
  grad.addColorStop(1, back);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);

  // colored rear (soft organic edge), tail end = canvas bottom
  if (rear) {
    const rg = g.createLinearGradient(0, 26, 0, 128);
    rg.addColorStop(0, rgba(rear, 0));
    rg.addColorStop(0.32, rgba(rear, rearAlpha * 0.7));
    rg.addColorStop(1, rgba(rear, rearAlpha));
    g.fillStyle = rg;
    g.fillRect(0, 26, 256, 102);
    // irregular blobs spilling forward of the boundary
    g.fillStyle = rear;
    for (let i = 0; i < 34; i++) {
      const x = s() * 256;
      const y = 20 + Math.pow(s(), 1.8) * 55;
      g.globalAlpha = (1 - (y - 20) / 55) * 0.5 * rearAlpha;
      g.beginPath();
      g.ellipse(x, y, 4 + s() * 14, 3 + s() * 7, s() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // faint myomere (muscle segment) curves along the flank
  g.strokeStyle = 'rgba(36,48,60,0.17)';
  g.lineWidth = 3.5;
  for (let x = -20; x < 280; x += 26) {
    g.beginPath();
    g.moveTo(x, 10);
    g.quadraticCurveTo(x + 10, 64, x - 4, 120);
    g.stroke();
  }

  // lateral line: thin dark stripe along mid-flank (u=0.5 -> canvas x=128)
  g.fillStyle = 'rgba(30,40,52,0.22)';
  g.fillRect(126, 6, 3, 118);

  // vertical bars (tiger/cobra-style strains)
  if (bars) {
    const [count, color] = bars;
    g.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const y = 46 + (i * 74) / count;
      g.globalAlpha = 0.38;
      g.fillRect(0, y, 256, 6 + (i % 2) * 3);
    }
    g.globalAlpha = 1;
  }

  // reticulated scale net
  g.strokeStyle = 'rgba(16,24,34,0.33)';
  g.lineWidth = 1.3;
  for (let x = -128; x < 384; x += 11) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 128, 128); g.stroke();
    g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 128, 0); g.stroke();
  }

  // counter-shading boost: darker along the very back edge
  const bg = g.createLinearGradient(200, 0, 256, 0);
  bg.addColorStop(0, 'rgba(12,18,26,0)');
  bg.addColorStop(1, 'rgba(12,18,26,0.35)');
  g.fillStyle = bg;
  g.fillRect(200, 0, 56, 128);

  // mouth: dark slit at the snout (canvas top = nose); u=.5 is the flank,
  // so one stroke lands on both sides
  g.strokeStyle = 'rgba(28,24,22,0.8)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(104, 5);
  g.quadraticCurveTo(128, 11, 152, 5);
  g.stroke();

  // operculum: iridescent gill cover sheen + slit line behind the head
  const og = g.createLinearGradient(0, 8, 0, 42);
  og.addColorStop(0, 'rgba(150,190,215,0)');
  og.addColorStop(0.5, 'rgba(150,190,215,0.30)');
  og.addColorStop(1, 'rgba(150,190,215,0)');
  g.fillStyle = og;
  g.fillRect(40, 8, 176, 34);
  g.strokeStyle = 'rgba(30,34,40,0.45)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(46, 36);
  g.quadraticCurveTo(128, 22, 210, 36);
  g.stroke();

  // spots: rear-biased but scattered over the whole flank
  for (const [color, n, rmax] of spots) {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = s() * 256;
      const y = s() < 0.65 ? 55 + s() * 73 : s() * 128;
      const r = 1.5 + s() * rmax;
      g.globalAlpha = 0.35 + s() * 0.55;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;

  // female gravid spot (belly, rear third): u≈0.12, v≈0.3 -> x≈30, y≈90
  if (gravid) {
    g.fillStyle = 'rgba(22,24,22,0.85)';
    g.beginPath();
    g.ellipse(30, 90, 13, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(70,74,66,0.5)';
    g.beginPath();
    g.ellipse(30, 90, 8, 6, 0, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Fin (tail/dorsal): v=0 (canvas bottom) = fin base/joint, v=1 = outer rim.
// Draws base->rim color gradient plus radiating fin rays.
function finCanvas(color, dotColors, seed) {
  const s = seedRandom(seed);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');

  const rgb = parseHex(color);
  // membrane: dense at the joint, translucent toward the rim (real fin look)
  const grad = g.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, `rgba(${shadeArr(rgb, -35).join(',')},0.98)`);
  grad.addColorStop(0.45, `rgba(${rgb.join(',')},0.90)`);
  grad.addColorStop(0.8, `rgba(${shadeArr(rgb, 18).join(',')},0.72)`);
  grad.addColorStop(1, `rgba(${shadeArr(rgb, 34).join(',')},0.50)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);

  // lepidotrichia: fin rays radiating from the joint (bottom center)
  g.strokeStyle = 'rgba(255,255,255,0.30)';
  g.lineWidth = 1.4;
  for (let k = -7; k <= 7; k++) {
    const a = (k / 7.5) * 1.25;
    g.beginPath();
    g.moveTo(128, 256);
    g.lineTo(128 + Math.sin(a) * 300, 256 - Math.cos(a) * 300);
    g.stroke();
  }
  g.strokeStyle = 'rgba(10,10,14,0.24)';
  g.lineWidth = 1;
  for (let k = -7; k <= 7; k++) {
    const a = ((k + 0.5) / 7.5) * 1.25;
    g.beginPath();
    g.moveTo(128, 256);
    g.lineTo(128 + Math.sin(a) * 300, 256 - Math.cos(a) * 300);
    g.stroke();
  }

  // denser band where the fin meets the body
  const baseG = g.createLinearGradient(0, 256, 0, 196);
  baseG.addColorStop(0, 'rgba(10,10,14,0.35)');
  baseG.addColorStop(1, 'rgba(10,10,14,0)');
  g.fillStyle = baseG;
  g.fillRect(0, 196, 256, 60);

  for (const [dc, n] of dotColors) {
    g.fillStyle = dc;
    for (let i = 0; i < n; i++) {
      const x = s() * 256;
      const y = 30 + s() * 210;
      const r = 2 + s() * 6;
      g.globalAlpha = 0.3 + s() * 0.5;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------- variants

export const VARIANTS = [
  { name: 'neon', tail: '#ff5f1f', tailDots: [['#8f1606', 46], ['#ffd27f', 26]],
    base: '#8f9fa6', back: '#2c4254', belly: '#ccd3d4', rear: '#ff6a1f',
    spots: [['#ff6a1f', 38, 5], ['#123c52', 34, 4]], size: 0.85 },
  { name: 'tiger', tail: '#e8332a', tailDots: [['#5c0a06', 44], ['#ffb35c', 22]],
    base: '#99a2a4', back: '#3c3c36', belly: '#d3d6d0', rear: '#e0402a',
    spots: [['#c22a14', 42, 5], ['#22262b', 38, 4]], bars: [6, 'rgba(52,30,20,1)'],
    size: 0.9 },
  { name: 'sunset', tail: '#ffc21e', tailDots: [['#b35c05', 44], ['#fff1b8', 20]],
    base: '#a0a298', back: '#464234', belly: '#d8d6c8', rear: '#ef9018',
    spots: [['#ffa410', 42, 5], ['#5a3a10', 34, 4]], size: 0.82 },
  { name: 'blue', tail: '#2f7bff', tailDots: [['#0d2f8f', 46], ['#9fd0ff', 24]],
    base: '#8c9aa8', back: '#2a3c52', belly: '#cbd2da', rear: '#2f7bff',
    spots: [['#2470f0', 40, 5], ['#11294f', 38, 4]], size: 0.88 },
  { name: 'female', tail: '#cabfae', tailDots: [['#a89882', 24]],
    base: '#8f968c', back: '#3a443a', belly: '#c8ccc2', rear: '#7f8878', rearAlpha: 0.55,
    spots: [['#545a51', 26, 3]], size: 1.04, female: true },
];

// ---------------------------------------------------------------- geometry

// Spindle body, slightly compressed; flatter back / fuller belly; snout tilted
// up (guppies have a high, upturned mouth). Axis: nose +z, tail joint ~ -0.40.
// Narrow caudal peduncle where the fan tail attaches. Fancy strains are deeper-
// bodied than wild type — peak depth ~0.15 at 52% of body length.
const BODY_PROFILE = [
  [0.000, 0.000], [0.032, 0.040], [0.048, 0.110], [0.066, 0.185],
  [0.100, 0.275], [0.136, 0.355], [0.150, 0.420], [0.142, 0.490],
  [0.120, 0.575], [0.095, 0.655], [0.070, 0.725], [0.040, 0.778],
  [0.000, 0.800],
];

// radius of the lathe profile at axis coordinate ya (0..0.8)
function radiusAt(ya) {
  const P = BODY_PROFILE;
  if (ya <= P[0][1]) return P[0][0];
  for (let i = 1; i < P.length; i++) {
    if (ya <= P[i][1]) {
      const [r0, y0] = P[i - 1], [r1, y1] = P[i];
      return r0 + ((ya - y0) / (y1 - y0)) * (r1 - r0);
    }
  }
  return 0;
}

// height of the back surface in fish-space (after 0.86 flattening + snout tilt)
function backTop(z) {
  const ya = z + 0.42;
  let y = radiusAt(ya) * 0.86;
  if (ya > 0.18) y += ((ya - 0.18) / 0.62) * 0.045;
  return y;
}

function buildBodyGeometry() {
  const pts = BODY_PROFILE.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.rotateX(Math.PI / 2);          // axis -> +z, nose at +z

  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i);
    y = y > 0 ? y * 0.86 : y * 1.06;          // flat back, round belly
    const z = p.getZ(i);
    if (z > 0.18) y += ((z - 0.18) / 0.62) * 0.045; // upturned snout
    p.setY(i, y);
  }

  geo.scale(0.58, 1.0, 1.0);         // laterally compressed
  geo.translate(0, 0, -0.42);
  geo.computeVertexNormals();
  planarUV(geo);
  geo.userData.origPositions = new Float32Array(geo.attributes.position.array);
  return geo;
}

// Fan tail — slight depth curvature so it's not perfectly flat (normal = lateral), joint at local origin.
// Big delta fan: fancy guppy tails rival the body in size.
function buildTailGeometry(R = 0.50, spread = 1.32) {
  const N = 22;
  const pos = [0, 0, 0];
  const uv = [0.5, 0];
  const idx = [];
  for (let k = 0; k <= N; k++) {
    const a = -spread + (2 * spread * k) / N;
    const rr = R * (1 - 0.08 * Math.abs(a) / spread) * (1 + 0.03 * Math.sin(a * 4.5));
    const y = Math.sin(a) * rr;
    const z = -Math.cos(a) * rr * 0.94;
    const x3d = -Math.pow(Math.abs(Math.sin(a)), 1.5) * rr * 0.06;
    pos.push(x3d, y, z);
    uv.push(0.5 + y / (2 * R * 0.96), Math.hypot(y, z) / R);
  }
  for (let k = 1; k <= N; k++) idx.push(0, k, k + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.userData.origPositions = new Float32Array(geo.attributes.position.array);
  return geo;
}

// Large triangular dorsal sweep (guppy signature), base follows the back.
function buildDorsalGeometry() {
  const pos = [], uv = [], idx = [];
  const SEG = 12;
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const z = 0.10 - t * 0.40;
    const yTop = backTop(z) - 0.008;   // base sinks into the back, no gap
    const h = 0.185 * Math.sin(Math.PI * Math.pow(t, 1.35));
    pos.push(0, yTop, z, 0, yTop + h, z - 0.045);
    uv.push(t, 0, t, 1);
  }
  for (let i = 0; i < SEG; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.userData.origPositions = new Float32Array(geo.attributes.position.array);
  return geo;
}

function buildPectoralGeometry(mirror) {
  const m = mirror ? -1 : 1;
  const pos = [
    0, 0, 0,
    m * 0.130, -0.015, -0.075,
    m * 0.020, -0.040, -0.125,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0, 0.12, 1, 0.88, 1], 2));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}

// female anal fin: small soft fan under the belly
function buildAnalGeometry() {
  const pos = [
    0, -0.085, -0.095,
    0, -0.150, -0.150,
    0, -0.080, -0.180,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0.2, 0, 0.5, 1, 0.8, 0], 2));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}

// pelvic fins (positioned forward, per guppy anatomy)
function buildPelvicGeometry(mirror) {
  const m = mirror ? -1 : 1;
  const pos = [
    0, 0, 0,
    m * 0.050, -0.065, -0.055,
    m * 0.008, -0.035, -0.095,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0, 0.15, 1, 0.85, 1], 2));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}

function planarUV(geo, minY, maxY, minZ, maxZ) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const a = minY ?? bb.min.y, b = maxY ?? bb.max.y;
  const c = minZ ?? bb.min.z, d = maxZ ?? bb.max.z;
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getY(i) - a) / Math.max(b - a, 1e-6);
    uv[i * 2 + 1] = (p.getZ(i) - c) / Math.max(d - c, 1e-6);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const GEO = {
  body: buildBodyGeometry(),
  tail: buildTailGeometry(),
  dorsal: buildDorsalGeometry(),
  pecR: buildPectoralGeometry(false),
  pecL: buildPectoralGeometry(true),
  anal: buildAnalGeometry(),
  pelR: buildPelvicGeometry(false),
  pelL: buildPelvicGeometry(true),
  eye: new THREE.SphereGeometry(0.033, 14, 12),
  iris: new THREE.TorusGeometry(0.033, 0.0085, 8, 22).rotateY(Math.PI / 2),
};

const EYE_MAT = new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.12, metalness: 0.1 });
const IRIS_MAT = new THREE.MeshStandardMaterial({ color: 0xc8912f, roughness: 0.3, metalness: 0.25 });
const GONO_MAT = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.5, side: THREE.DoubleSide });

// ---------------------------------------------------------------- Guppy

export class Guppy {
  constructor(variant, pos, bounds, rng) {
    this.variant = variant;
    this.bounds = bounds;
    this.phase = rng() * Math.PI * 2;
    this.seedIdx = Math.floor(rng() * 10000);
    this.w1 = 0.23 + rng() * 0.18;
    this.w2 = 0.31 + rng() * 0.2;
    this.w3 = 0.27 + rng() * 0.16;
    this.baseSpeed = (variant.female ? 0.34 : 0.46) + rng() * 0.22;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3(rng() - 0.5, 0, rng() - 0.5).normalize().multiplyScalar(this.baseSpeed);
    this.roll = 0;

    // speed state machine: 0=idle, 1=cruise, 2=burst
    this.speedState = 1;
    this.stateTimer = 1 + rng() * 4;
    this.prevSpd = this.baseSpeed;
    this.glideT = 0;

    const bodyTex = bodyCanvas({
      base: variant.base, back: variant.back, belly: variant.belly,
      rear: variant.rear, rearAlpha: variant.rearAlpha,
      spots: variant.spots, bars: variant.bars, seed: 1000 + Math.floor(rng() * 900),
      gravid: variant.female,
    });
    const finTex = finCanvas(variant.tail, variant.tailDots, 2000 + Math.floor(rng() * 900));

    this.bodyMat = new THREE.MeshPhysicalMaterial({
      map: bodyTex, roughness: 0.52, metalness: 0.05,
      clearcoat: 0.15, clearcoatRoughness: 0.55,
      iridescence: 0.28, iridescenceIOR: 1.35,
      sheen: 0.1, sheenColor: 0xbfd8ff,
    });
    this.finMat = new THREE.MeshStandardMaterial({
      map: finTex, roughness: 0.42, metalness: 0.06,
      side: THREE.DoubleSide,
      transparent: true, depthWrite: false,
      opacity: variant.female ? 0.8 : 1,
    });

    const root = new THREE.Group();
    const body = new THREE.Group();

    const torso = new THREE.Mesh(GEO.body, this.bodyMat);
    torso.castShadow = true;
    body.add(torso);
    this.torsoMesh = torso;
    this.bodyOrigPos = GEO.body.userData.origPositions;

    this.tailPivot = new THREE.Group();
    this.tailPivot.position.set(0, 0, -0.40);
    const tail = new THREE.Mesh(GEO.tail, this.finMat);
    this.tailPivot.add(tail);
    if (variant.female) this.tailPivot.scale.setScalar(0.58);
    body.add(this.tailPivot);
    this.tailMesh = tail;
    this.tailOrigPos = GEO.tail.userData.origPositions;

    const dorsal = new THREE.Mesh(GEO.dorsal, this.finMat);
    if (variant.female) dorsal.scale.y = 0.65;
    body.add(dorsal);
    this.dorsalMesh = dorsal;
    this.dorsalOrigPos = GEO.dorsal.userData.origPositions;

    this.pecR = new THREE.Group();
    this.pecR.position.set(0.058, 0.028, 0.155);
    this.pecR.add(new THREE.Mesh(GEO.pecR, this.finMat));
    body.add(this.pecR);
    this.pecL = new THREE.Group();
    this.pecL.position.set(-0.058, 0.028, 0.155);
    this.pecL.add(new THREE.Mesh(GEO.pecL, this.finMat));
    body.add(this.pecL);

    this.pelR = new THREE.Mesh(GEO.pelR, this.finMat);
    this.pelR.translateX(0.030).translateY(-0.090).translateZ(0.045);
    body.add(this.pelR);
    this.pelL = new THREE.Mesh(GEO.pelL, this.finMat);
    this.pelL.translateX(-0.030).translateY(-0.090).translateZ(0.045);
    body.add(this.pelL);

    if (variant.female) {
      body.add(new THREE.Mesh(GEO.anal, this.finMat));
    } else {
      // male gonopodium: short rod-shaped anal fin tucked under the belly
      const gono = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.11, 6), GONO_MAT);
      const dir = new THREE.Vector3(0, -0.38, -0.92).normalize();
      gono.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      gono.position.set(0, -0.098, -0.115);
      body.add(gono);
    }

    this.eyes = [];
    for (const side of [1, -1]) {
      const eye = new THREE.Group();
      eye.add(new THREE.Mesh(GEO.eye, EYE_MAT));
      eye.add(new THREE.Mesh(GEO.iris, IRIS_MAT));
      eye.position.set(0.037 * side, 0.052, 0.295);
      body.add(eye);
      this.eyes.push(eye);
    }

    root.add(body);
    this.body = body;
    this.root = root;
    this.root.scale.setScalar(variant.size * (0.93 + rng() * 0.14));
    this.root.position.copy(this.pos);
    root.userData.guppy = this;
    root.traverse((o) => { o.userData.guppy = this; });
  }

  update(dt, t, world) {
    const { bounds, pellets } = world;
    const desired = new THREE.Vector3();

    // --- noise-based organic direction ---
    const nT = t * 0.25 + this.phase;
    desired.set(
      smoothNoise(nT * 1.0, this.seedIdx) * 2 - 1,
      (smoothNoise(nT * 1.4, this.seedIdx + 3) * 2 - 1) * 0.28,
      smoothNoise(nT * 0.85, this.seedIdx + 6) * 2 - 1,
    ).normalize();

    // --- speed state machine ---
    this.stateTimer -= dt;
    if (this.stateTimer <= 0 && !this._chasing) {
      const r = Math.random();
      if (this.speedState === 0) {
        this.speedState = r < 0.6 ? 1 : 2;
        this.stateTimer = 1.5 + Math.random() * 3;
      } else if (this.speedState === 1) {
        this.speedState = r < 0.18 ? 0 : r < 0.28 ? 2 : 1;
        this.stateTimer = 2 + Math.random() * 5;
      } else {
        this.speedState = r < 0.35 ? 1 : 0;
        this.stateTimer = 0.6 + Math.random() * 1.5;
      }
    }
    const stateMult = this.speedState === 0 ? 0.3 : this.speedState === 2 ? 1.7 : 1.0;
    let speed = this.baseSpeed * stateMult;

    let food = null, foodD = 3.6;
    for (const p of pellets) {
      if (p.dying) continue;
      const d = p.mesh.position.distanceTo(this.pos);
      if (d < foodD) { foodD = d; food = p; }
    }
    if (food) {
      const to = food.mesh.position.clone().sub(this.pos).normalize();
      desired.addScaledVector(to, 4.5);
      if (!this._chasing) {
        // first frame seeing food: startle burst
        this.speedState = 2;
        this.stateTimer = 1.0;
      }
      speed = this.baseSpeed * 2.6;
      this._chasing = true;
    } else {
      this._chasing = false;
    }

    // micro-movements: subtle random jitter for life-like feel
    desired.x += Math.sin(t * 13.7 + this.phase * 7) * 0.06;
    desired.y += Math.sin(t * 11.3 + this.phase * 5) * 0.04;
    desired.z += Math.sin(t * 9.8 + this.phase * 3) * 0.06;

    // vertical exploration: noise-driven depth target
    const depthNoise = smoothNoise(nT * 0.6, this.seedIdx + 9);
    const targetY = bounds.min.y + (bounds.max.y - bounds.min.y) * (0.3 + depthNoise * 0.5);
    desired.y += (targetY - this.pos.y) * 0.6;
    // resting: drift down gently when idle
    if (this.speedState === 0) desired.y -= 0.12;

    // boundary avoidance
    const m = 0.42;
    for (const ax of ['x', 'y', 'z']) {
      const lo = bounds.min[ax] + m, hi = bounds.max[ax] - m;
      const v = this.pos[ax];
      if (v < lo) desired[ax] += (lo - v) / m * 3.5;
      else if (v > hi) desired[ax] -= (v - hi) / m * 3.5;
    }

    // obstacle avoidance
    for (const o of bounds.obstacles) {
      const dx = this.pos.x - o.x, dy = this.pos.y - o.y, dz = this.pos.z - o.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const rr = o.r + 0.24;
      if (d < rr && d > 1e-5) {
        const push = ((rr - d) / rr) * 5.0;
        desired.x += (dx / d) * push;
        desired.y += (dy / d) * push;
        desired.z += (dz / d) * push;
      }
    }

    // collision avoidance + schooling alignment
    let alignX = 0, alignY = 0, alignZ = 0, alignN = 0;
    for (const f of world.guppies) {
      if (f === this) continue;
      const dx = this.pos.x - f.pos.x, dy = this.pos.y - f.pos.y, dz = this.pos.z - f.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 0.22 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = ((0.47 - d) / 0.47) * 1.6;
        desired.x += (dx / d) * push;
        desired.y += (dy / d) * push;
        desired.z += (dz / d) * push;
      }
      if (d2 < 3.5 && d2 > 0.01) {
        alignX += f.vel.x; alignY += f.vel.y; alignZ += f.vel.z;
        alignN++;
      }
    }
    if (alignN > 0) {
      const inv = 0.7 / alignN;
      desired.x += alignX * inv;
      desired.y += alignY * inv;
      desired.z += alignZ * inv;
    }

    if (desired.lengthSq() < 1e-6) desired.set(1, 0, 0);
    desired.normalize().multiplyScalar(speed);

    // turning speed modulation: slow down in sharp turns
    const desiredFwd = desired.clone().normalize();
    const curFwd = this.vel.clone().normalize();
    const turnDot = THREE.MathUtils.clamp(desiredFwd.dot(curFwd), -1, 1);
    const turnPenalty = 1 - (1 - turnDot) * 0.4;
    desired.multiplyScalar(turnPenalty);

    const k = 1 - Math.exp(-dt * 2.4);
    this.vel.lerp(desired, k);
    this.pos.addScaledVector(this.vel, dt);

    this.pos.x = Math.max(bounds.min.x, Math.min(bounds.max.x, this.pos.x));
    this.pos.y = Math.max(bounds.min.y, Math.min(bounds.max.y, this.pos.y));
    this.pos.z = Math.max(bounds.min.z, Math.min(bounds.max.z, this.pos.z));

    if (food && this.pos.distanceTo(food.mesh.position) < 0.24) food.eat();

    const spd = this.vel.length();
    if (spd > 1e-4) {
      const look = this.pos.clone().addScaledVector(this.vel, 1 / spd);
      this.root.position.copy(this.pos);
      this.root.lookAt(look);
    }

    // roll into turns
    const fwd = this.vel.clone().normalize();
    const turn = this.prevFwd ? this.prevFwd.clone().cross(fwd).y : 0;
    this.prevFwd = fwd;
    const targetRoll = THREE.MathUtils.clamp(-turn * 30, -0.6, 0.6);
    this.roll += (targetRoll - this.roll) * Math.min(dt * 4, 1);
    this.body.rotation.z = this.roll;

    // --- glide: periodically ease off the tail ---
    this.glideT += dt;
    const glideCycle = Math.sin(this.glideT * 0.35 + this.phase * 5);
    const glideMult = glideCycle > 0.75 ? THREE.MathUtils.smoothstep(glideCycle, 0.75, 1.0) * 0.7 + 0.3 : 1.0;

    // --- tail & body wave (synchronized) ---
    const accel = this.prevSpd !== undefined ? (spd - this.prevSpd) / Math.max(dt, 0.001) : 0;
    this.prevSpd = spd;
    const tailFreqMod = 1 + THREE.MathUtils.clamp(accel * 0.4, -0.3, 0.5);
    const wagFreq = (6.5 + spd * 5.5) * tailFreqMod;
    const t_wave = t * wagFreq + this.phase;
    const tailAmp = (0.34 + Math.min(spd * 0.24, 0.26)) * glideMult;
    // slight beat asymmetry (real tails aren't perfectly symmetric)
    const asym = Math.sin(t_wave * 0.7 + this.phase * 1.3) * 0.06;
    const wag = Math.sin(t_wave) * tailAmp + asym;
    this.tailPivot.rotation.y = wag;
    this.tailPivot.rotation.x = -0.09 + Math.sin(t * 1.4 + this.phase) * 0.06;

    // body counter-bend
    this.body.rotation.y = -wag * 0.18;

    // pitch: nose-down at speed
    this.body.rotation.x = Math.sin(t * 1.1 + this.phase * 1.7) * 0.035 - spd * 0.02;

    // --- body S-curve with harmonics + vertical component ---
    const waveAmp = tailAmp * 0.04;
    const posAttr = this.torsoMesh.geometry.attributes.position;
    const orig = this.bodyOrigPos;
    for (let i = 0; i < posAttr.count; i++) {
      const oz = orig[i * 3 + 2];
      const oy = orig[i * 3 + 1];
      const zn = THREE.MathUtils.clamp((0.38 - oz) / 0.80, 0, 1);
      const z2 = zn * zn;
      // fundamental + 2nd harmonic for organic shape
      const fundamental = Math.sin(zn * 5 - t_wave);
      const harmonic = Math.sin(zn * 10 - t_wave * 1.5) * 0.25;
      const lateral = waveAmp * z2 * (fundamental + harmonic);
      // vertical component (smaller, phase-shifted for 3D feel)
      const vertical = waveAmp * 0.35 * z2 * Math.sin(zn * 5 - t_wave + 1.1);
      posAttr.array[i * 3] = orig[i * 3] + lateral;
      posAttr.array[i * 3 + 1] = oy + vertical;
    }
    posAttr.needsUpdate = true;
    this.torsoMesh.geometry.computeVertexNormals();

    // --- pectoral fins: 3D rowing, slow at idle ---
    const finSpeed = this.speedState === 0 ? 4 : 8 + spd * 6;
    const flutZ = Math.sin(t * finSpeed + this.phase * 3) * (0.25 + spd * 0.18);
    const flutX = Math.sin(t * finSpeed * 0.6 + this.phase) * 0.18;
    this.pecR.rotation.z = flutZ;
    this.pecL.rotation.z = -flutZ;
    this.pecR.rotation.x = flutX;
    this.pecL.rotation.x = flutX + 0.08;
    // angle fins into turns
    const finTurn = this.roll * 0.35;
    this.pecR.rotation.y = finTurn;
    this.pecL.rotation.y = finTurn;

    // --- dorsal fin: subtle undulation ---
    this.dorsalMesh.rotation.z = Math.sin(t * 3 + this.phase * 2) * 0.025;
    this.dorsalMesh.rotation.x = Math.sin(t * 2.5 + this.phase) * 0.018;

    // --- tail membrane wave deformation ---
    {
      const tp = this.tailMesh.geometry.attributes.position;
      const to = this.tailOrigPos;
      const R = 0.50;
      const tailWaveAmp = tailAmp * 0.06;
      for (let i = 0; i < tp.count; i++) {
        const oy = to[i * 3 + 1];
        const oz = to[i * 3 + 2];
        const dist = Math.min(Math.sqrt(oy * oy + oz * oz) / R, 1);
        const d2 = dist * dist;
        // lateral bend propagating outward
        const bend = tailWaveAmp * d2 * Math.sin(dist * 4.5 - t_wave * 1.2);
        tp.array[i * 3] = to[i * 3] + bend;
        // slight vertical ripple
        tp.array[i * 3 + 1] = to[i * 3 + 1] + tailWaveAmp * 0.3 * d2 * Math.sin(dist * 5 - t_wave * 1.2 + 0.9);
      }
      tp.needsUpdate = true;
      this.tailMesh.geometry.computeVertexNormals();
    }

    // --- dorsal fin vertex wave ---
    {
      const dp = this.dorsalMesh.geometry.attributes.position;
      const dor = this.dorsalOrigPos;
      const dorAmp = waveAmp * 0.6;
      for (let i = 0; i < dp.count; i++) {
        const oz = dor[i * 3 + 2];
        const tNorm = THREE.MathUtils.clamp((0.10 - oz) / 0.40, 0, 1);
        const ripple = dorAmp * tNorm * Math.sin(tNorm * 4 - t_wave * 0.8) * 0.5;
        dp.array[i * 3] = dor[i * 3] + ripple;
      }
      dp.needsUpdate = true;
      this.dorsalMesh.geometry.computeVertexNormals();
    }

    // --- body breathing: subtle lateral pulsation ---
    const breathe = 1 + Math.sin(t_wave * 0.5) * 0.012;
    this.torsoMesh.scale.x = breathe;

    // --- eye tracking: subtle look-around ---
    const eyeYaw = Math.sin(t * 0.8 + this.phase * 3) * 0.18;
    const eyePitch = Math.sin(t * 0.6 + this.phase * 2) * 0.10;
    for (const eye of this.eyes) {
      eye.rotation.y = eyeYaw;
      eye.rotation.x = eyePitch;
    }

    // --- pelvic fins ---
    const pelFlut = Math.sin(t * 4 + this.phase * 1.5) * 0.12;
    this.pelR.rotation.z = pelFlut;
    this.pelL.rotation.z = -pelFlut;
  }
}
