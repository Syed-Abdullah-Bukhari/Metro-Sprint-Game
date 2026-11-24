import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LANE_W = 2.4;
export const TRAIN_H = 3.0;
export const TRAIN_W = 1.9;
export const RAMP_LEN = 9;
const BODY_H = TRAIN_H - 0.4;

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function canvasTexture(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  srgb = true,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/* ------------------------------------------------------------------ */
/* Ground / track textures (+ bump maps for real depth under light)    */
/* ------------------------------------------------------------------ */

/** One tile = LANE_W wide and LANE_W long in world units. */
export function makeTrackTextures(lanes: number): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const speck = Array.from({ length: Math.floor((128 * lanes * 128) / 9) }, () => [Math.random(), Math.random(), Math.random(), Math.random()]);
  const draw = (g: CanvasRenderingContext2D, w: number, h: number, height: boolean) => {
    g.fillStyle = height ? '#6e6e6e' : '#8d877e';
    g.fillRect(0, 0, w, h);
    for (const [a, b, c, d] of speck) {
      const v = height ? 70 + Math.floor(c * 90) : 105 + Math.floor(c * 80);
      g.fillStyle = height ? `rgb(${v},${v},${v})` : `rgb(${v},${v - 4},${v - 12})`;
      g.fillRect(a * w, b * h, 2 + d * 3, 2 + d * 2);
    }
    for (let l = 0; l < lanes; l++) {
      const x0 = l * 128;
      for (const y of [12, 76]) {
        if (height) {
          g.fillStyle = '#c4c4c4';
          g.fillRect(x0 + 12, y, 104, 20);
          g.fillStyle = '#e6e6e6';
          g.fillRect(x0 + 12, y + 2, 104, 12);
        } else {
          g.fillStyle = '#2f2118';
          g.fillRect(x0 + 12, y, 104, 20);
          g.fillStyle = '#4f3829';
          g.fillRect(x0 + 12, y, 104, 14);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(x0 + 12, y + 16, 104, 4);
          g.fillStyle = 'rgba(255,255,255,0.08)';
          for (let k = 0; k < 6; k++) g.fillRect(x0 + 18 + k * 16, y + 3, 7, 1);
        }
      }
      for (const rx of [30, 90]) {
        if (height) {
          g.fillStyle = '#ffffff';
          g.fillRect(x0 + rx, 0, 9, h);
        } else {
          g.fillStyle = 'rgba(0,0,0,0.38)';
          g.fillRect(x0 + rx - 2, 0, 14, h);
          g.fillStyle = '#8b94a5';
          g.fillRect(x0 + rx, 0, 9, h);
          g.fillStyle = '#e4e9f4';
          g.fillRect(x0 + rx + 1, 0, 3, h);
          // bolts / fish plates
          g.fillStyle = '#5a6272';
          g.fillRect(x0 + rx, 58, 9, 6);
        }
      }
    }
  };
  const map = canvasTexture(128 * lanes, 128, (g, w, h) => draw(g, w, h, false));
  const bump = canvasTexture(128 * lanes, 128, (g, w, h) => draw(g, w, h, true), false);
  return { map, bump };
}

export function makeGroundTextures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const speck = Array.from({ length: 2400 }, () => [Math.random(), Math.random(), Math.random(), Math.random()]);
  const draw = (g: CanvasRenderingContext2D, w: number, h: number, height: boolean) => {
    g.fillStyle = height ? '#707070' : '#b9b4aa';
    g.fillRect(0, 0, w, h);
    for (const [a, b, c, d] of speck) {
      const v = height ? 60 + Math.floor(c * 120) : 140 + Math.floor(c * 90);
      g.fillStyle = height ? `rgb(${v},${v},${v})` : `rgb(${v},${v - 3},${v - 9})`;
      g.fillRect(a * w, b * h, 2 + d * 4, 2 + d * 3);
    }
  };
  return {
    map: canvasTexture(128, 128, (g, w, h) => draw(g, w, h, false)),
    bump: canvasTexture(128, 128, (g, w, h) => draw(g, w, h, true), false),
  };
}

/* ------------------------------------------------------------------ */
/* Walls / buildings                                                   */
/* ------------------------------------------------------------------ */

function wallTex(base: string, accents: string[]) {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.16)';
    g.lineWidth = 2;
    for (let y = 0; y < h; y += 16) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
      const off = (y / 16) % 2 ? 16 : 0;
      for (let x = off; x < w; x += 32) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 16);
        g.stroke();
      }
    }
    // grime
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
      g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 2 + Math.random() * 10);
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let i = 0; i < 5; i++) {
      const col = pick(accents);
      const x = rnd(16, w - 80);
      const y = rnd(26, h - 36);
      const path = () => {
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + 20, y - 28, x + 38, y + 28, x + 58, y - 6);
        g.bezierCurveTo(x + 66, y - 16, x + 74, y + 10, x + 54, y + 16);
      };
      g.strokeStyle = 'rgba(10,10,20,0.55)';
      g.lineWidth = 15;
      path();
      g.stroke();
      g.strokeStyle = col;
      g.lineWidth = 9;
      path();
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2.5;
      path();
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(0, 0, w, 9);
  });
}

export function makeWallTextures(): THREE.CanvasTexture[] {
  const accents = ['#ff3d71', '#2ee6c5', '#ffd23f', '#7a5cff', '#3a9bff', '#ff8a3d'];
  const list = [wallTex('#a89684', accents), wallTex('#8a97a6', accents), wallTex('#9c8794', accents)];
  list.forEach((t) => t.repeat.set(4, 1));
  return list;
}

/** Window facade pair (diffuse + emissive for night). One tile = 4x4 window cells. */
export function makeBuildingTexturePair(): { map: THREE.CanvasTexture; emi: THREE.CanvasTexture } {
  const cs = 32;
  const lit: boolean[] = [];
  for (let i = 0; i < 16; i++) lit.push(Math.random() < 0.38);
  const map = canvasTexture(128, 128, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        g.fillStyle = 'rgba(0,0,0,0.1)';
        g.fillRect(x * cs, y * cs + cs - 4, cs, 4);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x * cs + 5, y * cs + 4, cs - 10, cs - 10);
        g.fillStyle = lit[y * 4 + x] ? '#ffe7a0' : '#4f6283';
        g.fillRect(x * cs + 7, y * cs + 6, cs - 14, cs - 14);
        g.fillStyle = 'rgba(255,255,255,0.16)';
        g.fillRect(x * cs + 7, y * cs + 6, (cs - 14) * 0.45, cs - 14);
      }
    }
  });
  const emi = canvasTexture(128, 128, (g) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (lit[y * 4 + x]) {
          g.fillStyle = '#ffc94d';
          g.fillRect(x * cs + 7, y * cs + 6, cs - 14, cs - 14);
        }
      }
    }
  });
  return { map, emi };
}

function stripeTexture(c1: string, c2: string) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = c1;
    g.fillRect(0, 0, w, h);
    g.fillStyle = c2;
    for (let i = -h; i < w + h; i += 32) {
      g.beginPath();
      g.moveTo(i, h);
      g.lineTo(i + 16, h);
      g.lineTo(i + 16 + h, 0);
      g.lineTo(i + h, 0);
      g.closePath();
      g.fill();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Trains                                                              */
/* ------------------------------------------------------------------ */

export const TRAIN_COLORS = [
  { body: '#e63946', accent: '#ffffff', roof: '#8f1f2b' },
  { body: '#1fa59a', accent: '#ffe066', roof: '#157a72' },
  { body: '#f08a24', accent: '#ffffff', roof: '#a85a10' },
  { body: '#3a7bf0', accent: '#ffffff', roof: '#254fa3' },
  { body: '#8f4be8', accent: '#ffd23f', roof: '#5f2fa6' },
  { body: '#f2c230', accent: '#2b2b3a', roof: '#a8820f' },
];

type TC = (typeof TRAIN_COLORS)[number];

function trainSideTexture(c: TC) {
  return canvasTexture(256, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, c.body);
    grd.addColorStop(1, c.body);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(0, 10, w, 4);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, 0, w, 10);
    for (const x of [16, 138]) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(x - 3, 17, 110, 54);
      g.fillStyle = '#1b2742';
      g.fillRect(x, 20, 104, 46);
      g.fillStyle = '#31507f';
      g.fillRect(x + 4, 24, 96, 38);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.moveTo(x + 10, 62);
      g.lineTo(x + 34, 24);
      g.lineTo(x + 52, 24);
      g.lineTo(x + 28, 62);
      g.closePath();
      g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(124, 14, 4, 90);
    g.fillRect(0, 14, 3, 90);
    g.fillStyle = c.accent;
    g.fillRect(0, 84, w, 9);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(0, 100, w, 28);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 8; x < w; x += 22) {
      g.beginPath();
      g.arc(x, 112, 2.2, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function trainFrontTexture(c: TC) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = c.body;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(0, 0, w, 14);
    g.fillStyle = '#0c1122';
    g.fillRect(28, 3, 72, 9);
    g.fillStyle = '#ffb02e';
    g.font = '800 8px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('EXPRESS', 64, 8);
    g.fillStyle = '#12182b';
    g.fillRect(10, 18, 108, 50);
    g.fillStyle = '#2c4676';
    g.fillRect(14, 22, 100, 42);
    g.fillStyle = 'rgba(255,255,255,0.24)';
    g.beginPath();
    g.moveTo(18, 64);
    g.lineTo(48, 22);
    g.lineTo(70, 22);
    g.lineTo(40, 64);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(62, 18, 4, 50);
    g.fillStyle = c.accent;
    g.fillRect(0, 76, w, 8);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(0, 96, w, 32);
    for (const x of [28, 100]) {
      g.fillStyle = 'rgba(255,240,170,0.3)';
      g.beginPath();
      g.arc(x, 104, 14, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff8cf';
      g.beginPath();
      g.arc(x, 104, 8, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#f5f5f5';
    g.fillRect(50, 92, 28, 12);
    g.fillStyle = '#222';
    g.fillRect(54, 96, 20, 4);
  });
}

const trainMatCache = new Map<number, THREE.Material[]>();
const trainBodyGeoCache = new Map<number, THREE.BufferGeometry>();
const trainUnderGeoCache = new Map<number, THREE.BufferGeometry>();
const bogieGeo = new THREE.BoxGeometry(1.98, 0.5, 2.4);
const underMat = new THREE.MeshStandardMaterial({ color: 0x1d1f29, roughness: 0.85, metalness: 0 });
const bogieMat = new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.85, metalness: 0.05 });
const roofUnitMat = new THREE.MeshStandardMaterial({ color: 0xc9cfda, roughness: 0.8, metalness: 0.05 });
const roofUnitGeo = new THREE.BoxGeometry(1.1, 0.14, 1.7);
const headGeo = new THREE.BoxGeometry(0.38, 0.22, 0.05);
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });

function trainMaterials(v: number): THREE.Material[] {
  let m = trainMatCache.get(v);
  if (!m) {
    const c = TRAIN_COLORS[v % TRAIN_COLORS.length];
    const side = new THREE.MeshStandardMaterial({ map: trainSideTexture(c), roughness: 0.75, metalness: 0.03 });
    const roof = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.roof), roughness: 0.75, metalness: 0.03 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x20222c, roughness: 0.8 });
    const front = new THREE.MeshStandardMaterial({ map: trainFrontTexture(c), roughness: 0.75, metalness: 0.03 });
    m = [side, side, roof, dark, front, front];
    trainMatCache.set(v, m);
  }
  return m;
}

function trainBodyGeo(len: number): THREE.BufferGeometry {
  let g = trainBodyGeoCache.get(len);
  if (!g) {
    g = new THREE.BoxGeometry(TRAIN_W, BODY_H, len);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    // px / nx faces (first 8 vertices): tile the side texture along the length
    for (let i = 0; i < 8; i++) uv.setX(i, uv.getX(i) * (len / 6));
    uv.needsUpdate = true;
    trainBodyGeoCache.set(len, g);
  }
  return g;
}

export function createTrain(len: number, variant: number, shadows = true): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(trainBodyGeo(len), trainMaterials(variant));
  body.position.y = 0.4 + BODY_H / 2;
  body.castShadow = shadows;
  body.receiveShadow = shadows;
  g.add(body);

  let ug = trainUnderGeoCache.get(len);
  if (!ug) {
    ug = new THREE.BoxGeometry(TRAIN_W - 0.04, 0.44, len - 0.1);
    trainUnderGeoCache.set(len, ug);
  }
  const under = new THREE.Mesh(ug, underMat);
  under.position.y = 0.23;
  g.add(under);

  for (const z of [-(len / 2 - 3.4), len / 2 - 3.4]) {
    const b = new THREE.Mesh(bogieGeo, bogieMat);
    b.position.set(0, 0.26, z);
    g.add(b);
  }
  for (const x of [-0.55, 0.55]) {
    const h = new THREE.Mesh(headGeo, headMat);
    h.position.set(x, 0.85, len / 2 + 0.03);
    g.add(h);
  }
  for (let z = -len / 2 + 3; z < len / 2 - 2; z += 6) {
    const u = new THREE.Mesh(roofUnitGeo, roofUnitMat);
    u.position.set(0, TRAIN_H + 0.07, z);
    g.add(u);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Ramp                                                                */
/* ------------------------------------------------------------------ */

let rampGeo: THREE.BufferGeometry | null = null;
let rampMats: THREE.Material[] | null = null;

export function createRamp(): THREE.Mesh {
  if (!rampGeo) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(RAMP_LEN, 0);
    shape.lineTo(0, TRAIN_H);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: TRAIN_W, bevelEnabled: false });
    g.rotateY(-Math.PI / 2);
    g.translate(TRAIN_W / 2, 0, -RAMP_LEN / 2);
    rampGeo = g;
    rampMats = [
      new THREE.MeshStandardMaterial({ color: 0xffb703, roughness: 0.7, metalness: 0.03 }),
      new THREE.MeshStandardMaterial({ color: 0xd98e00, roughness: 0.7, metalness: 0.03 }),
    ];
  }
  const m = new THREE.Mesh(rampGeo, rampMats!);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------------ */
/* Barriers                                                            */
/* ------------------------------------------------------------------ */

let lowTex: THREE.CanvasTexture | null = null;
let highTex: THREE.CanvasTexture | null = null;
const lightMat = new THREE.MeshBasicMaterial({ color: 0xffa530 });
const postMat = new THREE.MeshStandardMaterial({ color: 0x3b3f4d, roughness: 0.75, metalness: 0.05 });
let lowMat: THREE.MeshStandardMaterial | null = null;
let highMat: THREE.MeshStandardMaterial | null = null;
const lowGeo = new THREE.BoxGeometry(2.0, 0.9, 0.8);
const lowBaseGeo = new THREE.BoxGeometry(2.1, 0.16, 0.9);
const lowBaseMat = new THREE.MeshStandardMaterial({ color: 0x2b2e3a, roughness: 0.85 });
const lightGeo = new THREE.BoxGeometry(0.22, 0.2, 0.22);
const postGeo = new THREE.BoxGeometry(0.24, 2.3, 0.24);
const barGeo = new THREE.BoxGeometry(2.2, 0.7, 0.3);

export function createLowBarrier(): THREE.Group {
  if (!lowMat) {
    lowTex = stripeTexture('#f5f5f5', '#e63946');
    lowMat = new THREE.MeshStandardMaterial({ map: lowTex, roughness: 0.75, metalness: 0 });
  }
  const g = new THREE.Group();
  const b = new THREE.Mesh(lowGeo, lowMat);
  b.position.y = 0.45;
  b.castShadow = true;
  b.receiveShadow = true;
  g.add(b);
  const base = new THREE.Mesh(lowBaseGeo, lowBaseMat);
  base.position.y = 0.08;
  g.add(base);
  for (const x of [-0.8, 0.8]) {
    const l = new THREE.Mesh(lightGeo, lightMat);
    l.position.set(x, 1.0, 0);
    g.add(l);
  }
  return g;
}

export function createHighBarrier(): THREE.Group {
  if (!highMat) {
    highTex = stripeTexture('#ffd23f', '#1d1f29');
    highMat = new THREE.MeshStandardMaterial({ map: highTex, roughness: 0.75, metalness: 0 });
  }
  const g = new THREE.Group();
  for (const x of [-0.98, 0.98]) {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(x, 1.15, 0);
    p.castShadow = true;
    g.add(p);
  }
  const bar = new THREE.Mesh(barGeo, highMat);
  bar.position.y = 1.65;
  bar.castShadow = true;
  g.add(bar);
  for (const x of [-0.98, 0.98]) {
    const l = new THREE.Mesh(lightGeo, lightMat);
    l.position.set(x, 2.38, 0);
    g.add(l);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Coins                                                               */
/* ------------------------------------------------------------------ */

export function createCoinAssets() {
  const geo = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 28);
  geo.rotateX(Math.PI / 2);
  const face = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#ffc928';
    g.fillRect(0, 0, w, h);
    g.beginPath();
    g.arc(32, 32, 27, 0, Math.PI * 2);
    g.fillStyle = '#ffdf6e';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#e09a00';
    g.stroke();
    g.fillStyle = '#f0a800';
    g.font = '900 30px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('$', 32, 34);
  });
  face.wrapS = face.wrapT = THREE.ClampToEdgeWrapping;
  const side = new THREE.MeshStandardMaterial({ color: 0xf0b000, emissive: 0x8a5600, emissiveIntensity: 0.35, metalness: 0.15, roughness: 0.5 });
  const faceMat = new THREE.MeshStandardMaterial({ map: face, emissive: 0xffb000, emissiveMap: face, emissiveIntensity: 0.3, metalness: 0.15, roughness: 0.5 });
  return { geo, mats: [side, faceMat, faceMat] as THREE.Material[] };
}

/* ------------------------------------------------------------------ */
/* Road vehicles: buses and cars                                       */
/* ------------------------------------------------------------------ */

export const BUS_COLORS = ['#e63946', '#f2c230', '#2f7bf0', '#1fa59a', '#f08a24', '#f4f4f8', '#8f4be8'];
export const CAR_COLORS = ['#e63946', '#2f7bf0', '#f2c230', '#1fa59a', '#ececf2', '#8f4be8', '#f08a24', '#2a2d3a'];

/** Buses that drive out of the wall are clipped at the inner wall face. */
export const BUS_CLIP = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 9.3), new THREE.Plane(new THREE.Vector3(1, 0, 0), 9.3)];

const vMats = new Map<string, THREE.Material>();
function vm<T extends THREE.Material>(key: string, clip: boolean, make: () => T): T {
  const id = clip ? key + ':c' : key;
  let m = vMats.get(id) as T | undefined;
  if (!m) {
    m = make();
    if (clip) m.clippingPlanes = BUS_CLIP;
    vMats.set(id, m);
  }
  return m;
}
const vTex = new Map<string, THREE.CanvasTexture>();
function vt(key: string, make: () => THREE.CanvasTexture) {
  let t = vTex.get(key);
  if (!t) {
    t = make();
    vTex.set(key, t);
  }
  return t;
}
const vGeo = new Map<string, THREE.BufferGeometry>();
function vg(key: string, make: () => THREE.BufferGeometry) {
  let g = vGeo.get(key);
  if (!g) {
    g = make();
    vGeo.set(key, g);
  }
  return g;
}

function colorBox(w: number, h: number, d: number, x: number, y: number, z: number, rgb: [number, number, number]) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = rgb[0];
    arr[i * 3 + 1] = rgb[1];
    arr[i * 3 + 2] = rgb[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function wheelSet(r: number, w: number, x: number, zs: number[], y: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (const z of zs) {
    for (const sx of [-1, 1]) {
      const g = new THREE.CylinderGeometry(r, r, w, 14);
      g.rotateZ(Math.PI / 2);
      g.translate(sx * x, y, z);
      parts.push(g);
    }
  }
  return mergeGeometries(parts, false)!;
}

function busSideTexture(col: string) {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = col;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(0, 0, w, 10);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, 10, w, 4);
    const win = (x: number, ww: number) => {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(x - 2, 17, ww + 4, 52);
      g.fillStyle = '#1b2742';
      g.fillRect(x, 19, ww, 48);
      g.fillStyle = '#34548a';
      g.fillRect(x + 3, 22, ww - 6, 42);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.moveTo(x + 6, 64);
      g.lineTo(x + 18, 22);
      g.lineTo(x + 28, 22);
      g.lineTo(x + 16, 64);
      g.closePath();
      g.fill();
    };
    win(8, 36);
    win(48, 36);
    win(172, 36);
    win(212, 36);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(90, 15, 76, 78);
    g.fillStyle = '#243656';
    g.fillRect(92, 17, 72, 74);
    g.fillStyle = '#3e5f94';
    g.fillRect(95, 20, 33, 68);
    g.fillRect(130, 20, 33, 68);
    g.fillStyle = 'rgba(255,255,255,0.2)';
    g.fillRect(98, 24, 8, 60);
    g.fillRect(133, 24, 8, 60);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 96, w, 6);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 102, w, 26);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = '800 15px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('CITY BUS', 128, 115);
  });
}

function busFrontTexture(col: string) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = col;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, 0, w, 10);
    g.fillStyle = '#0c1122';
    g.fillRect(22, 12, 84, 15);
    g.fillStyle = '#ffb02e';
    g.font = '800 11px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('CENTRAL 42', 64, 20);
    g.fillStyle = '#10162a';
    g.fillRect(8, 31, 112, 52);
    g.fillStyle = '#2f4d80';
    g.fillRect(12, 35, 104, 44);
    g.fillStyle = 'rgba(255,255,255,0.24)';
    g.beginPath();
    g.moveTo(16, 79);
    g.lineTo(44, 35);
    g.lineTo(66, 35);
    g.lineTo(38, 79);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(62, 31, 4, 52);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 88, w, 6);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 100, w, 28);
    g.fillStyle = '#f5f5f5';
    g.fillRect(48, 104, 32, 12);
    g.fillStyle = '#222';
    g.fillRect(52, 108, 24, 4);
  });
}

function busBackTexture(col: string) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = col;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, 0, w, 10);
    g.fillStyle = '#10162a';
    g.fillRect(20, 24, 88, 38);
    g.fillStyle = '#2a4372';
    g.fillRect(24, 28, 80, 30);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 88, w, 6);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 100, w, 28);
    g.fillStyle = '#f5f5f5';
    g.fillRect(48, 104, 32, 12);
  });
}

export function createBus(len: number, variant: number, clip = false): THREE.Group {
  const col = BUS_COLORS[variant % BUS_COLORS.length];
  const g = new THREE.Group();
  const side = vm('bus-side-' + col, clip, () => new THREE.MeshStandardMaterial({ map: vt('bs' + col, () => busSideTexture(col)), roughness: 0.75, metalness: 0.03 }));
  const front = vm('bus-front-' + col, clip, () => new THREE.MeshStandardMaterial({ map: vt('bf' + col, () => busFrontTexture(col)), roughness: 0.75, metalness: 0.03 }));
  const back = vm('bus-back-' + col, clip, () => new THREE.MeshStandardMaterial({ map: vt('bk' + col, () => busBackTexture(col)), roughness: 0.75, metalness: 0.03 }));
  const roof = vm('bus-roof-' + col, clip, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.7), roughness: 0.75, metalness: 0.03 }));
  const dark = vm('bus-dark', clip, () => new THREE.MeshStandardMaterial({ color: 0x1c1e27, roughness: 0.85 }));
  const body = new THREE.Mesh(vg('bus-body' + len, () => new THREE.BoxGeometry(2.3, 2.5, len)), [side, side, roof, dark, front, back]);
  body.position.y = 1.7;
  g.add(body);

  // solid dark skirt: the bus reaches the ground, so there is no gap to slide under
  const skirt = new THREE.Mesh(vg('bus-skirt' + len, () => new THREE.BoxGeometry(2.26, 0.56, len - 0.3)), dark);
  skirt.position.y = 0.3;
  g.add(skirt);

  const wheels = new THREE.Mesh(
    vg('bus-wheels' + len, () => wheelSet(0.46, 0.34, 1.12, [len / 2 - 1.7, -(len / 2 - 1.7)], 0.46)),
    vm('wheel', clip, () => new THREE.MeshStandardMaterial({ color: 0x14151c, roughness: 0.9 })),
  );
  g.add(wheels);

  const lights = new THREE.Mesh(
    vg('bus-lights' + len, () =>
      mergeGeometries(
        [
          colorBox(0.46, 0.26, 0.06, -0.8, 0.95, len / 2 + 0.03, [1, 0.95, 0.75]),
          colorBox(0.46, 0.26, 0.06, 0.8, 0.95, len / 2 + 0.03, [1, 0.95, 0.75]),
          colorBox(0.34, 0.22, 0.06, -0.85, 1.1, -len / 2 - 0.03, [0.85, 0.1, 0.08]),
          colorBox(0.34, 0.22, 0.06, 0.85, 1.1, -len / 2 - 0.03, [0.85, 0.1, 0.08]),
        ],
        false,
      )!,
    ),
    vm('lights', clip, () => new THREE.MeshBasicMaterial({ vertexColors: true })),
  );
  g.add(lights);

  const ac = new THREE.Mesh(
    vg('bus-ac' + len, () => new THREE.BoxGeometry(1.3, 0.28, Math.min(2.4, len * 0.3))),
    vm('bus-ac', clip, () => new THREE.MeshStandardMaterial({ color: 0xc9cfda, roughness: 0.8, metalness: 0.05 })),
  );
  ac.position.y = 3.09;
  g.add(ac);
  return g;
}

export function createCar(variant: number): THREE.Group {
  const col = CAR_COLORS[variant % CAR_COLORS.length];
  const g = new THREE.Group();
  const paint = vm('car-paint-' + col, false, () => new THREE.MeshStandardMaterial({ color: col, roughness: 0.65, metalness: 0.05 }));
  const glass = vm('car-glass', false, () => new THREE.MeshStandardMaterial({ color: 0x1b2a45, roughness: 0.6, metalness: 0.05 }));
  const body = new THREE.Mesh(vg('car-body', () => new THREE.BoxGeometry(1.7, 0.62, 3.9)), paint);
  body.position.y = 0.75;
  const cabin = new THREE.Mesh(vg('car-cabin', () => new THREE.BoxGeometry(1.5, 0.56, 2.0)), glass);
  cabin.position.set(0, 1.34, -0.15);
  const top = new THREE.Mesh(vg('car-top', () => new THREE.BoxGeometry(1.46, 0.08, 1.8)), paint);
  top.position.set(0, 1.66, -0.15);
  const wheels = new THREE.Mesh(
    vg('car-wheels', () => wheelSet(0.34, 0.26, 0.86, [1.2, -1.2], 0.34)),
    vm('wheel', false, () => new THREE.MeshStandardMaterial({ color: 0x14151c, roughness: 0.85 })),
  );
  const lights = new THREE.Mesh(
    vg('car-lights', () =>
      mergeGeometries(
        [
          colorBox(0.36, 0.18, 0.05, -0.6, 0.8, 1.97, [1, 0.95, 0.75]),
          colorBox(0.36, 0.18, 0.05, 0.6, 0.8, 1.97, [1, 0.95, 0.75]),
          colorBox(0.3, 0.16, 0.05, -0.62, 0.85, -1.97, [0.85, 0.1, 0.08]),
          colorBox(0.3, 0.16, 0.05, 0.62, 0.85, -1.97, [0.85, 0.1, 0.08]),
        ],
        false,
      )!,
    ),
    vm('lights', false, () => new THREE.MeshBasicMaterial({ vertexColors: true })),
  );
  g.add(body, cabin, top, wheels, lights);
  return g;
}
