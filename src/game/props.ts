import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, rnd, pick, createBus } from './assets';
import type { PropKind, BoulderSkin } from './themes';

/* ------------------------------------------------------------------ */
/* Merged, vertex-coloured scenery props (1 draw call each)            */
/* ------------------------------------------------------------------ */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();

type V3 = [number, number, number];

function paint(g: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function part(
  geo: THREE.BufferGeometry,
  color: string,
  pos: V3 = [0, 0, 0],
  scale: V3 = [1, 1, 1],
  rot: V3 = [0, 0, 0],
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  _m.compose(new THREE.Vector3(...pos), _q, new THREE.Vector3(...scale));
  g.applyMatrix4(_m);
  return paint(g, color);
}

/** Like part() but with an HDR vertex colour (for glowing windows). */
function partRGB(geo: THREE.BufferGeometry, rgb: [number, number, number], pos: V3 = [0, 0, 0]): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.translate(pos[0], pos[1], pos[2]);
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

/** Oriented part: geometry must have its base at the origin and point along +y. */
function partQ(geo: THREE.BufferGeometry, color: string, pos: V3, yaw: number, tilt: number, scale: V3 = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  _q.setFromEuler(_e.set(0, yaw, 0));
  _q2.setFromEuler(_e.set(0, 0, -tilt));
  _q.multiply(_q2);
  _m.compose(new THREE.Vector3(...pos), _q, new THREE.Vector3(...scale));
  g.applyMatrix4(_m);
  return paint(g, color);
}

const merge = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts, false)!;
  g.computeVertexNormals();
  return g;
};

const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
const cache = new Map<PropKind, THREE.BufferGeometry>();

function paintByHeight(g: THREE.BufferGeometry, fn: (y: number) => THREE.Color) {
  const pos = g.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = fn(pos.getY(i));
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function bandColor(y: number, bands: string[]): THREE.Color {
  const i = Math.min(bands.length - 1, Math.floor(y * bands.length));
  return new THREE.Color(bands[i]);
}

const frond = (len: number, w: number, seg = 4) => new THREE.ConeGeometry(w, len, seg).translate(0, len / 2, 0);
const stick = (r0: number, r1: number, len: number) => new THREE.CylinderGeometry(r1, r0, len, 6).translate(0, len / 2, 0);

function buildGeo(kind: PropKind): THREE.BufferGeometry {
  switch (kind) {
    case 'pine':
    case 'pineSnow': {
      const snow = kind === 'pineSnow';
      const cols = snow ? ['#6f9b86', '#a9cdc0', '#dfeaf2'] : ['#1f6b3a', '#2a8247', '#37a058'];
      return merge([
        part(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 6), '#5a3d28', [0, 0.7, 0]),
        part(new THREE.ConeGeometry(2.0, 2.8, 8), cols[0], [0, 2.5, 0]),
        part(new THREE.ConeGeometry(1.6, 2.4, 8), cols[1], [0, 4.0, 0]),
        part(new THREE.ConeGeometry(1.1, 2.1, 8), cols[2], [0, 5.4, 0]),
      ]);
    }
    case 'round':
      return merge([
        part(new THREE.CylinderGeometry(0.25, 0.35, 1.8, 6), '#6b4a30', [0, 0.9, 0]),
        part(new THREE.IcosahedronGeometry(1.5, 1), '#3f9b4a', [0, 3, 0], [1, 0.9, 1]),
        part(new THREE.IcosahedronGeometry(1.0, 1), '#52b05a', [0.9, 2.4, 0.3]),
        part(new THREE.IcosahedronGeometry(0.95, 1), '#35893f', [-0.8, 3.6, -0.2]),
      ]);
    case 'cactus':
      return merge([
        part(new THREE.CapsuleGeometry(0.38, 2.4, 4, 8), '#4c9a4a', [0, 1.6, 0]),
        part(new THREE.CapsuleGeometry(0.2, 0.5, 4, 8), '#4c9a4a', [0.55, 1.5, 0], [1, 1, 1], [0, 0, Math.PI / 2]),
        part(new THREE.CapsuleGeometry(0.2, 0.9, 4, 8), '#58a856', [0.9, 2.0, 0]),
        part(new THREE.CapsuleGeometry(0.18, 0.4, 4, 8), '#4c9a4a', [-0.5, 2.0, 0], [1, 1, 1], [0, 0, Math.PI / 2]),
        part(new THREE.CapsuleGeometry(0.18, 0.6, 4, 8), '#58a856', [-0.8, 2.35, 0]),
      ]);
    case 'rock':
      return merge([
        part(new THREE.IcosahedronGeometry(1, 0), '#8d8478', [0, 0.5, 0], [1.4, 0.9, 1.1]),
        part(new THREE.IcosahedronGeometry(0.6, 0), '#7b7368', [1.2, 0.3, 0.5], [1, 0.8, 1]),
      ]);
    case 'chimney':
      return merge([
        part(new THREE.CylinderGeometry(0.9, 1.3, 26, 10), '#8a4b3a', [0, 13, 0]),
        part(new THREE.CylinderGeometry(0.95, 1.0, 1.6, 10), '#ece7df', [0, 22.5, 0]),
        part(new THREE.CylinderGeometry(0.93, 0.95, 1.6, 10), '#c0392b', [0, 20.6, 0]),
        part(new THREE.CylinderGeometry(1.05, 0.9, 0.6, 10), '#2b2d36', [0, 26.2, 0]),
      ]);
    case 'tank':
      return merge([
        part(new THREE.CylinderGeometry(4, 4, 9, 16), '#9aa4ad', [0, 4.5, 0]),
        part(new THREE.ConeGeometry(4, 1.8, 16), '#7b858f', [0, 9.9, 0]),
        part(new THREE.CylinderGeometry(4.05, 4.05, 0.5, 16), '#c0392b', [0, 3, 0]),
        part(new THREE.CylinderGeometry(4.05, 4.05, 0.5, 16), '#c0392b', [0, 6.5, 0]),
      ]);
    case 'mesa': {
      const g = new THREE.CylinderGeometry(0.75, 1, 1, 9, 12, false);
      g.translate(0, 0.5, 0);
      const bands = ['#a8472a', '#b5532f', '#c9693a', '#d88a4d', '#e0a468', '#c9693a', '#d88a4d', '#e6b27a'];
      return paintByHeight(g, (y) => bandColor(Math.min(0.999, Math.max(0, y)), bands));
    }
    case 'mountain': {
      const g = new THREE.ConeGeometry(1, 1, 7, 6);
      g.translate(0, 0.5, 0);
      return paintByHeight(g, (y) => {
        if (y > 0.62) return new THREE.Color('#f4f8ff');
        if (y > 0.54) return new THREE.Color('#c9d6e6');
        return new THREE.Color(y > 0.25 ? '#6f7d93' : '#56627a');
      });
    }
    case 'palm': {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 6; i++) {
        parts.push(
          part(new THREE.CylinderGeometry(0.2 - 0.014 * i, 0.24 - 0.014 * i, 1.05, 7), i % 2 ? '#8a6a45' : '#7a5c3c', [0.05 * i * i, 0.5 + i * 1.0, 0], [1, 1, 1], [0, 0, -Math.atan(0.1 * i)]),
        );
      }
      const topX = 0.05 * 25;
      const topY = 5.6;
      for (let i = 0; i < 9; i++) {
        parts.push(partQ(frond(3.6, 0.42), i % 2 ? '#2e9b45' : '#3fb356', [topX, topY, 0], (i / 9) * Math.PI * 2, 1.15 + (i % 3) * 0.28, [1, 1, 0.22]));
      }
      parts.push(part(new THREE.SphereGeometry(0.2, 8, 6), '#5a3a20', [topX + 0.15, topY - 0.15, 0.1]));
      parts.push(part(new THREE.SphereGeometry(0.2, 8, 6), '#5a3a20', [topX - 0.15, topY - 0.2, -0.1]));
      return merge(parts);
    }
    case 'jungle': {
      const parts: THREE.BufferGeometry[] = [
        part(new THREE.CylinderGeometry(0.45, 0.8, 4.2, 8), '#5a4030', [0, 2.1, 0]),
        part(new THREE.IcosahedronGeometry(2.4, 1), '#2f8a3c', [0, 5.6, 0], [1.2, 0.8, 1.2]),
        part(new THREE.IcosahedronGeometry(1.6, 1), '#3da34a', [1.9, 4.8, 0.5]),
        part(new THREE.IcosahedronGeometry(1.7, 1), '#277a34', [-1.8, 5.0, -0.6]),
        part(new THREE.IcosahedronGeometry(1.5, 1), '#4cb856', [0.2, 6.9, 0]),
      ];
      for (let i = 0; i < 3; i++) parts.push(partQ(frond(1.6, 0.9), '#5a4030', [0, 0.1, 0], (i / 3) * Math.PI * 2 + 0.5, 1.15, [0.5, 0.5, 0.5]));
      parts.push(part(new THREE.CapsuleGeometry(0.05, 1.6, 3, 5), '#3a7a30', [1.3, 3.9, 0.8]));
      parts.push(part(new THREE.CapsuleGeometry(0.05, 1.2, 3, 5), '#3a7a30', [-1.2, 4.1, -0.9]));
      parts.push(part(new THREE.CapsuleGeometry(0.05, 1.9, 3, 5), '#3a7a30', [-0.2, 3.7, 1.5]));
      return merge(parts);
    }
    case 'fern': {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 8; i++) {
        parts.push(partQ(frond(2.4, 0.34, 5), i % 2 ? '#3fae4a' : '#2f9440', [0, 0, 0], i * 0.8, 0.85 + (i % 3) * 0.18, [1, 1, 0.28]));
      }
      return merge(parts);
    }
    case 'ruin':
      return merge([
        part(new THREE.BoxGeometry(1.1, 4.5, 1.1), '#9b9a8a', [0, 2.25, 0]),
        part(new THREE.BoxGeometry(1.2, 0.35, 1.2), '#6d8a5a', [0, 4.55, 0]),
        part(new THREE.BoxGeometry(1.1, 3, 1.1), '#8d8c7c', [4, 1.5, 0.4]),
        part(new THREE.BoxGeometry(5.8, 0.9, 1.2), '#8d8c7c', [2, 4.9, 0.2], [1, 1, 1], [0, 0, 0.05]),
        part(new THREE.BoxGeometry(1.4, 0.9, 1.4), '#7a7a6c', [1.8, 0.45, 2.4], [1, 1, 1], [0, 0.6, 0]),
        part(new THREE.BoxGeometry(2.2, 0.16, 1.6), '#4f7a40', [2, 5.4, 0.2]),
        part(new THREE.BoxGeometry(1.2, 0.5, 1.2), '#6d8a5a', [4, 3.1, 0.4]),
      ]);
    case 'volcano': {
      const g = new THREE.CylinderGeometry(0.16, 1, 1, 10, 6, false);
      g.translate(0, 0.5, 0);
      return paintByHeight(g, (y) => {
        if (y > 0.94) return new THREE.Color('#ff7a30');
        if (y > 0.82) return new THREE.Color('#6a3226');
        return new THREE.Color(y > 0.4 ? '#3b2a26' : '#2c201e');
      });
    }
    case 'deadTree': {
      const parts: THREE.BufferGeometry[] = [part(new THREE.CylinderGeometry(0.18, 0.34, 3.4, 6), '#2a2020', [0, 1.7, 0])];
      for (let i = 0; i < 4; i++) {
        parts.push(partQ(stick(0.1, 0.04, 1.7), '#2a2020', [0, 1.9 + i * 0.35, 0], i * 1.7, 0.8 + (i % 2) * 0.3));
      }
      return merge(parts);
    }
    case 'lavaRock':
      return merge([
        part(new THREE.IcosahedronGeometry(1, 0), '#2c2226', [0, 0.6, 0], [1.5, 1, 1.2]),
        part(new THREE.IcosahedronGeometry(0.7, 0), '#3a2c30', [1.4, 0.4, 0.6]),
        part(new THREE.IcosahedronGeometry(0.6, 0), '#241a1e', [-1.2, 0.3, -0.5]),
      ]);
    case 'tomb': {
      const parts: THREE.BufferGeometry[] = [];
      const stone = ['#8a8e9c', '#767a88', '#9a9eab'];
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 2.1 + rnd(-0.3, 0.3);
        const z = rnd(-0.8, 0.8);
        const ry = rnd(-0.3, 0.3);
        const rz = rnd(-0.12, 0.12);
        if (i === 1) {
          parts.push(part(new THREE.BoxGeometry(0.2, 1.7, 0.2), pick(stone), [x, 0.85, z], [1, 1, 1], [0, ry, rz]));
          parts.push(part(new THREE.BoxGeometry(0.95, 0.2, 0.2), pick(stone), [x, 1.2, z], [1, 1, 1], [0, ry, rz]));
        } else {
          parts.push(part(new THREE.BoxGeometry(0.95, 1.2, 0.3), pick(stone), [x, 0.6, z], [1, 1, 1], [0, ry, rz]));
          parts.push(part(new THREE.SphereGeometry(0.475, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), pick(stone), [x, 1.2, z], [1, 1, 0.65], [0, ry, rz]));
        }
        parts.push(part(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#2c3a2a', [x, 0, z + 1.0], [0.9, 0.2, 1.3]));
      }
      return merge(parts);
    }
    case 'mansion': {
      const m = buildMansion();
      mansionWin = m.windows;
      return m.struct;
    }
    case 'hill':
    default: {
      const g = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      return paintByHeight(g, (y) => new THREE.Color(y > 0.6 ? '#5a8f4a' : '#3f7338'));
    }
  }
}

let mansionWin: THREE.BufferGeometry | null = null;
const windowMat = new THREE.MeshBasicMaterial({ vertexColors: true });

function buildMansion() {
  const S: THREE.BufferGeometry[] = [];
  const W: THREE.BufferGeometry[] = [];
  const wall = '#4c4760';
  const wall2 = '#413d55';
  const roofC = '#262033';
  const trim = '#2c2838';
  S.push(part(new THREE.BoxGeometry(10, 8, 7), wall, [0, 4, 0]));
  S.push(part(new THREE.ConeGeometry(7.9, 3.6, 4), roofC, [0, 9.8, 0], [1, 1, 0.78], [0, Math.PI / 4, 0]));
  S.push(part(new THREE.BoxGeometry(6, 5.5, 6), wall2, [-8, 2.75, 0.6]));
  S.push(part(new THREE.ConeGeometry(4.9, 2.8, 4), roofC, [-8, 6.9, 0.6], [1, 1, 1], [0, Math.PI / 4, 0]));
  S.push(part(new THREE.BoxGeometry(5, 6.8, 5.6), wall2, [7.6, 3.4, -0.4]));
  S.push(part(new THREE.ConeGeometry(4.2, 3.0, 4), roofC, [7.6, 8.3, -0.4], [1, 1, 1], [0, Math.PI / 4, 0]));
  S.push(part(new THREE.CylinderGeometry(1.7, 1.9, 12, 10), wall, [3.8, 6, 3.4]));
  S.push(part(new THREE.ConeGeometry(2.3, 5, 10), roofC, [3.8, 14.5, 3.4]));
  S.push(part(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 5), '#1c1824', [3.8, 17.8, 3.4]));
  S.push(part(new THREE.BoxGeometry(0.9, 3, 0.9), trim, [-2.8, 10.5, -1.2], [1, 1, 1], [0, 0, 0.1]));
  S.push(part(new THREE.BoxGeometry(0.9, 2.4, 0.9), trim, [2.2, 10.4, -1.6], [1, 1, 1], [0, 0, -0.08]));
  S.push(part(new THREE.BoxGeometry(4.2, 0.4, 3.2), '#5a566b', [0, 0.2, 4.7]));
  for (const x of [-1.8, 1.8]) S.push(part(new THREE.CylinderGeometry(0.16, 0.16, 3, 8), '#6a667c', [x, 1.9, 5.9]));
  S.push(part(new THREE.BoxGeometry(4.6, 0.3, 3.6), roofC, [0, 3.55, 4.7]));
  S.push(part(new THREE.BoxGeometry(1.7, 3, 0.2), '#14101a', [0, 1.5, 3.55]));
  const win = (x: number, y: number, z: number, w = 0.95, h = 1.5, green = false) =>
    W.push(partRGB(new THREE.BoxGeometry(w, h, 0.14), green ? [0.4, 0.95, 0.6] : [1.0, 0.78, 0.3], [x, y, z]));
  win(-3.4, 2.5, 3.53);
  win(-3.4, 5.8, 3.53);
  win(-1.3, 5.8, 3.53);
  win(1.3, 5.8, 3.53, 0.95, 1.5, true);
  win(3.8, 5, 5.22, 0.7, 1.1);
  win(3.8, 9, 5.19, 0.7, 1.1, true);
  win(-9.4, 3, 3.63);
  win(-6.6, 3, 3.63, 0.95, 1.5, true);
  win(6.2, 3.2, 2.43);
  win(9.0, 3.2, 2.43);
  win(6.2, 5.4, 2.43, 0.95, 1.5, true);
  win(9.0, 5.4, 2.43);
  return { struct: merge(S), windows: mergeGeometries(W, false)! };
}

const lavaCapGeo = new THREE.CircleGeometry(0.16, 12).rotateX(-Math.PI / 2).translate(0, 1.004, 0);
const lavaCapMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.42, 0.08) });

export function makeProp(kind: PropKind): THREE.Object3D {
  let geo = cache.get(kind);
  if (!geo) {
    geo = buildGeo(kind);
    cache.set(kind, geo);
  }
  const mesh = new THREE.Mesh(geo, propMat);
  let obj: THREE.Object3D = mesh;
  if (kind === 'volcano') {
    const grp = new THREE.Group();
    grp.add(mesh, new THREE.Mesh(lavaCapGeo, lavaCapMat));
    obj = grp;
  }
  if (kind === 'mansion') {
    const grp = new THREE.Group();
    grp.add(mesh, new THREE.Mesh(mansionWin!, windowMat));
    obj = grp;
  }
  obj.rotation.y = Math.random() * Math.PI * 2;
  switch (kind) {
    case 'mansion':
      obj.scale.setScalar(rnd(0.85, 1.05));
      break;
    case 'tomb':
      obj.scale.setScalar(rnd(0.9, 1.5));
      break;
    case 'pine':
    case 'pineSnow':
      obj.scale.setScalar(rnd(0.9, 1.8));
      break;
    case 'round':
      obj.scale.setScalar(rnd(0.9, 1.5));
      break;
    case 'cactus':
      obj.scale.setScalar(rnd(0.9, 1.7));
      break;
    case 'rock':
    case 'lavaRock':
      obj.scale.setScalar(rnd(0.8, 2.6));
      break;
    case 'chimney':
      obj.scale.setScalar(rnd(0.9, 1.3));
      break;
    case 'tank':
      obj.scale.setScalar(rnd(0.8, 1.2));
      break;
    case 'palm':
      obj.scale.setScalar(rnd(1.1, 1.8));
      break;
    case 'jungle':
      obj.scale.setScalar(rnd(1.2, 2.1));
      break;
    case 'fern':
      obj.scale.setScalar(rnd(0.9, 1.7));
      break;
    case 'ruin':
      obj.scale.setScalar(rnd(1.0, 1.7));
      break;
    case 'deadTree':
      obj.scale.setScalar(rnd(1.0, 1.9));
      break;
    case 'mesa':
      obj.scale.set(rnd(14, 28), rnd(18, 38), rnd(14, 26));
      break;
    case 'mountain':
      obj.scale.set(rnd(30, 60), rnd(30, 62), rnd(30, 60));
      break;
    case 'volcano': {
      const s = rnd(20, 34);
      obj.scale.set(s, rnd(34, 58), s);
      break;
    }
    case 'hill':
      obj.scale.set(rnd(26, 46), rnd(6, 14), rnd(20, 30));
      break;
  }
  return obj;
}

export const FAR_PROP: Record<string, PropKind | null> = {
  'Frosty Peaks': 'mountain',
  'Desert Express': 'mesa',
  'Jungle Ruins': 'hill',
  'Magma Rush': 'volcano',
  'Pine Forest': 'hill',
  'Haunted Manor': 'mansion',
};

/* ------------------------------------------------------------------ */
/* Jungle canopy (hangs over the track)                                */
/* ------------------------------------------------------------------ */

const canopyGeos: THREE.BufferGeometry[] = [];

export function createCanopy(): THREE.Mesh {
  if (!canopyGeos.length) {
    const greens = ['#2f8a3c', '#3da34a', '#277a34', '#4cb856', '#1f6a2c'];
    for (let v = 0; v < 3; v++) {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 16; i++) {
        parts.push(part(new THREE.IcosahedronGeometry(rnd(1.4, 2.6), 1), pick(greens), [rnd(-9.5, 9.5), rnd(9.8, 11.6), rnd(-9.5, 9.5)], [1.2, 0.7, 1.2]));
      }
      for (let i = 0; i < 9; i++) {
        const len = rnd(1.5, 3.0);
        const x = rnd(-8, 8);
        const z = rnd(-9, 9);
        parts.push(part(new THREE.CapsuleGeometry(0.06, len, 3, 5), '#3a8a34', [x, 10.2 - len / 2, z]));
        parts.push(part(new THREE.SphereGeometry(0.22, 6, 5), '#52b05a', [x, 10.2 - len, z], [1, 0.6, 1]));
      }
      canopyGeos.push(merge(parts));
    }
  }
  return new THREE.Mesh(pick(canopyGeos), propMat);
}

/* ------------------------------------------------------------------ */
/* Crystal cave (enclosed tunnel)                                      */
/* ------------------------------------------------------------------ */

let caveArch: THREE.BufferGeometry | null = null;
let caveMat: THREE.MeshStandardMaterial | null = null;
const caveWallGeo = new THREE.BoxGeometry(0.8, 3.6, 20);
const crystalMat = new THREE.MeshBasicMaterial({ vertexColors: true });
crystalMat.color.setRGB(1, 1, 1);
const crystalGeos = new Map<string, THREE.BufferGeometry>();
const stalGeo = new THREE.ConeGeometry(0.5, 2.6, 6).rotateX(Math.PI / 2).translate(0, 0, 1.3);
const stalMat = new THREE.MeshStandardMaterial({ color: 0x4a4852, roughness: 1, flatShading: true });
const CRYSTAL_COLORS = ['#5ef0ff', '#ff5ee8', '#7a8bff', '#7dffb0'];

function getCaveMat() {
  if (!caveMat) {
    const tex = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#6e6a72';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const v = 70 + Math.floor(Math.random() * 90);
        g.fillStyle = `rgba(${v},${v - 4},${v + 6},0.55)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 9, 2 + Math.random() * 5);
      }
      g.strokeStyle = 'rgba(15,12,20,0.55)';
      g.lineWidth = 2;
      for (let i = 0; i < 30; i++) {
        g.beginPath();
        let x = Math.random() * w;
        let y = Math.random() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += rnd(-18, 18);
          y += rnd(-18, 18);
          g.lineTo(x, y);
        }
        g.stroke();
      }
    });
    tex.repeat.set(6, 1);
    caveMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  }
  return caveMat;
}

function getCaveArch() {
  if (!caveArch) {
    const g = new THREE.CylinderGeometry(7.5, 7.5, 20, 32, 10, true, Math.PI / 2, Math.PI);
    g.rotateX(Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ang = Math.atan2(y, x);
      const k = 1 + 0.06 * Math.sin(ang * 3 + (z * Math.PI * 2) / 20) + 0.04 * Math.sin(ang * 5 - (z * Math.PI * 4) / 20 + 1.3);
      pos.setXY(i, x * k, y * k);
    }
    g.translate(0, 3.5, 0);
    g.computeVertexNormals();
    caveArch = g;
  }
  return caveArch;
}

/** Static rock shell for one 20 m segment of cave. */
export function createCaveShell(): THREE.Group {
  const mat = getCaveMat();
  const g = new THREE.Group();
  const arch = new THREE.Mesh(getCaveArch(), mat);
  arch.receiveShadow = false;
  g.add(arch);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(caveWallGeo, mat);
    w.position.set(s * 7.35, 1.8, 0);
    g.add(w);
  }
  return g;
}

function crystalGeo(color: string) {
  let g = crystalGeos.get(color);
  if (!g) {
    g = merge([
      part(new THREE.OctahedronGeometry(0.3), color, [0, 0, 0.5], [0.7, 0.7, 2.4]),
      part(new THREE.OctahedronGeometry(0.22), color, [0.34, 0.1, 0.3], [0.7, 0.7, 2.0], [0.3, 0.4, 0]),
      part(new THREE.OctahedronGeometry(0.2), color, [-0.3, -0.15, 0.25], [0.6, 0.6, 1.8], [-0.3, -0.3, 0]),
    ]);
    crystalGeos.set(color, g);
  }
  return g;
}

/** Glowing crystals and stalactites for one cave segment (rebuilt on regen). */
export function createCaveDecor(): THREE.Group {
  const g = new THREE.Group();
  const toCentre = new THREE.Vector3();
  for (let i = 0; i < 9; i++) {
    const a = rnd(-0.25, Math.PI + 0.25);
    const r = 7.15;
    const z = rnd(-9.5, 9.5);
    const m = new THREE.Mesh(crystalGeo(pick(CRYSTAL_COLORS)), crystalMat);
    m.position.set(Math.cos(a) * r, 3.5 + Math.sin(a) * r, z);
    toCentre.set(0, 3.5, z);
    m.lookAt(toCentre);
    m.rotateZ(Math.random() * Math.PI);
    m.scale.setScalar(rnd(0.8, 1.7));
    g.add(m);
  }
  for (let i = 0; i < 5; i++) {
    const a = rnd(0.7, Math.PI - 0.7);
    const r = 7.4;
    const z = rnd(-9.5, 9.5);
    const m = new THREE.Mesh(stalGeo, stalMat);
    m.position.set(Math.cos(a) * r, 3.5 + Math.sin(a) * r, z);
    toCentre.set(0, 3.5, z);
    m.lookAt(toCentre);
    m.scale.setScalar(rnd(0.7, 1.5));
    g.add(m);
  }
  return g;
}

const portalMat = new THREE.MeshStandardMaterial({ color: 0x5a5660, roughness: 1, flatShading: true });
const portalRing = new THREE.TorusGeometry(7.75, 0.95, 8, 32, Math.PI);
const portalCol = new THREE.BoxGeometry(1.9, 3.6, 1.7);

/** Rocky frame at the mouth of the cave. */
export function createPortal(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(portalRing, portalMat);
  ring.position.y = 3.5;
  g.add(ring);
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(portalCol, portalMat);
    c.position.set(s * 7.75, 1.8, 0);
    g.add(c);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Lava                                                                */
/* ------------------------------------------------------------------ */

let lavaTex: { map: THREE.CanvasTexture; emi: THREE.CanvasTexture } | null = null;
let lavaMat: THREE.MeshBasicMaterial | null = null;
const lavaGeo = new THREE.PlaneGeometry(16, 20).rotateX(-Math.PI / 2);

function getLavaTex() {
  if (!lavaTex) {
    const cracks: [number, number][][] = [];
    for (let i = 0; i < 26; i++) {
      let x = Math.random() * 256;
      let y = Math.random() * 256;
      const pts: [number, number][] = [[x, y]];
      for (let k = 0; k < 6; k++) {
        x += rnd(-40, 40);
        y += rnd(-40, 40);
        pts.push([x, y]);
      }
      cracks.push(pts);
    }
    const drawCracks = (g: CanvasRenderingContext2D) => {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const pts of cracks) {
        for (const [wdt, col] of [[9, '#ff5a10'], [5, '#ffb030'], [2, '#fff2a0']] as [number, string][]) {
          g.strokeStyle = col;
          g.lineWidth = wdt;
          g.beginPath();
          g.moveTo(pts[0][0], pts[0][1]);
          for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
          g.stroke();
        }
      }
    };
    const map = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#3a120a';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${30 + Math.random() * 40},${15 + Math.random() * 15},12,0.7)`;
        g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 3 + Math.random() * 6);
      }
      drawCracks(g);
    });
    const emi = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      drawCracks(g);
    });
    lavaTex = { map, emi };
  }
  return lavaTex;
}

export function createLavaStrip(): THREE.Mesh {
  if (!lavaMat) {
    const t = getLavaTex();
    t.map.repeat.set(2, 2);
    lavaMat = new THREE.MeshBasicMaterial({
      map: t.map,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
  }
  return new THREE.Mesh(lavaGeo, lavaMat);
}

/* ------------------------------------------------------------------ */
/* Rolling boulders / fireballs                                        */
/* ------------------------------------------------------------------ */

const boulderGeo = new THREE.IcosahedronGeometry(0.8, 1);
const boulderMats: Partial<Record<BoulderSkin, THREE.MeshStandardMaterial>> = {};

function boulderMat(skin: BoulderSkin) {
  let m = boulderMats[skin];
  if (!m) {
    if (skin === 'fire') {
      m = new THREE.MeshStandardMaterial({ color: 0x8a3012, emissive: 0xff5a10, emissiveIntensity: 0.7, roughness: 0.8, flatShading: true });
    } else if (skin === 'moss') {
      m = new THREE.MeshStandardMaterial({ color: 0x6f8a5a, roughness: 1, flatShading: true });
    } else {
      m = new THREE.MeshStandardMaterial({ color: 0x8d8478, roughness: 1, flatShading: true });
    }
    boulderMats[skin] = m;
  }
  return m;
}

export function createBoulder(skin: BoulderSkin): { group: THREE.Group; roll: THREE.Mesh } {
  const group = new THREE.Group();
  const roll = new THREE.Mesh(boulderGeo, boulderMat(skin));
  roll.position.y = 0.45; // sunk into the ground: no gap underneath, it clearly has to be jumped
  roll.castShadow = true;
  group.add(roll);
  return { group, roll };
}

/* ------------------------------------------------------------------ */
/* Boost pad                                                           */
/* ------------------------------------------------------------------ */

let padMat: THREE.MeshBasicMaterial | null = null;
const padGeo = new THREE.PlaneGeometry(1.9, 3.4).rotateX(-Math.PI / 2);

export function createPad(): THREE.Mesh {
  if (!padMat) {
    const tex = canvasTexture(128, 256, (g, w, h) => {
      g.fillStyle = '#1a6dff';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#0d4fd0';
      g.fillRect(0, 0, w, 10);
      g.fillRect(0, h - 10, w, 10);
      for (let i = 0; i < 3; i++) {
        const y = 52 + i * 68;
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.moveTo(w / 2, y - 34);
        g.lineTo(w - 14, y + 8);
        g.lineTo(w - 38, y + 18);
        g.lineTo(w / 2, y - 6);
        g.lineTo(38, y + 18);
        g.lineTo(14, y + 8);
        g.closePath();
        g.fill();
      }
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    padMat = new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  }
  return new THREE.Mesh(padGeo, padMat);
}

/* ------------------------------------------------------------------ */
/* Neon billboards                                                     */
/* ------------------------------------------------------------------ */

const WORDS: [string, string][] = [
  ['RAMEN', '#ff3d71'],
  ['METRO', '#38e1ff'],
  ['HOTEL', '#ffd23f'],
  ['ARCADE', '#a66bff'],
  ['SUSHI', '#3dff9a'],
  ['24H', '#ff8a3d'],
  ['NOODLE', '#ff4de1'],
  ['CINEMA', '#4dd0ff'],
];

let bbMats: THREE.MeshBasicMaterial[] | null = null;
const bbGeo = new THREE.PlaneGeometry(7, 3.5);

export function createBillboard(): THREE.Mesh {
  if (!bbMats) {
    bbMats = WORDS.map(([word, col]) => {
      const tex = canvasTexture(256, 128, (g, w, h) => {
        g.fillStyle = '#07081a';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = col;
        g.lineWidth = 6;
        g.strokeRect(10, 10, w - 20, h - 20);
        g.fillStyle = '#ffffff';
        g.font = '900 54px "Fredoka", "Arial Black", Impact, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(word, w / 2, h / 2 + 3);
      });
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: true });
      return m;
    });
  }
  const mats = bbMats;
  return new THREE.Mesh(bbGeo, mats[Math.floor(Math.random() * mats.length)]);
}

/* ------------------------------------------------------------------ */
/* Signal gantry (spans the three lanes)                               */
/* ------------------------------------------------------------------ */

const steelMat = new THREE.MeshStandardMaterial({ color: 0x555b66, metalness: 0.6, roughness: 0.45 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x15171f, roughness: 0.6 });
const sigGeo = new THREE.SphereGeometry(0.13, 10, 8);
const sigGreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 0.35) });
const sigRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.2, 0.2) });
const sigOff = new THREE.MeshBasicMaterial({ color: 0x1b2a1e });

export function createGantry(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-8.8, 8.8]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8, 0.35), steelMat);
    p.position.set(x, 4, 0);
    g.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(18, 0.42, 0.6), steelMat);
  beam.position.y = 8;
  g.add(beam);
  const truss = new THREE.Mesh(new THREE.BoxGeometry(18, 0.14, 0.14), steelMat);
  truss.position.set(0, 7.6, 0.22);
  g.add(truss);
  for (const x of [-2.4, 0, 2.4]) {
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), steelMat);
    rod.position.set(x, 7.55, 0);
    g.add(rod);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, 0.34), darkMat);
    head.position.set(x, 6.8, 0);
    g.add(head);
    const green = Math.random() < 0.6;
    const top = new THREE.Mesh(sigGeo, green ? sigOff : sigRed);
    top.position.set(x, 7.1, 0.18);
    g.add(top);
    const bottom = new THREE.Mesh(sigGeo, green ? sigGreen : sigOff);
    bottom.position.set(x, 6.55, 0.18);
    g.add(bottom);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Side road tile                                                      */
/* ------------------------------------------------------------------ */

let roadMat: THREE.MeshStandardMaterial | null = null;
const roadGeo = new THREE.PlaneGeometry(3.4, 20).rotateX(-Math.PI / 2);

export function createRoadTile(): THREE.Mesh {
  if (!roadMat) {
    const tex = canvasTexture(128, 256, (g, w, h) => {
      g.fillStyle = '#3c3f48';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        const v = 40 + Math.floor(Math.random() * 40);
        g.fillStyle = `rgba(${v},${v},${v + 4},0.6)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3);
      }
      g.fillStyle = '#e8e8ee';
      g.fillRect(6, 0, 5, h);
      g.fillRect(w - 11, 0, 5, h);
      g.fillStyle = '#ffd23f';
      for (const y of [14, 98, 182]) g.fillRect(w / 2 - 2, y, 4, 44);
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    roadMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.75,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
  }
  return new THREE.Mesh(roadGeo, roadMat);
}

/* ------------------------------------------------------------------ */
/* Bus crossing: a bus drives out of the wall and across the tracks    */
/* ------------------------------------------------------------------ */

export const BUS_LEN = 6.2;
/** Sideways metres travelled by the bus per metre the runner advances. */
export const BUS_K = 0.2;

export const crossLampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.05, 0.05) });
export function setCrossBlink(on: boolean) {
  crossLampMat.color.setRGB(on ? 1 : 0.3, on ? 0.12 : 0.05, on ? 0.1 : 0.05);
}

const mouthGeo = new THREE.PlaneGeometry(3.4, 3.1);
const mouthMat = new THREE.MeshBasicMaterial({ color: 0x07080d });
const frameMat = new THREE.MeshStandardMaterial({ color: 0xffc21f, roughness: 0.5, metalness: 0.2 });
const frameTop = new THREE.BoxGeometry(0.3, 0.35, 4.0);
const framePost = new THREE.BoxGeometry(0.3, 3.2, 0.32);
const lampPost = new THREE.CylinderGeometry(0.07, 0.09, 3.4, 8);
const lampBall = new THREE.SphereGeometry(0.2, 10, 8);
const lampBoxMat = new THREE.MeshStandardMaterial({ color: 0x20232d, roughness: 0.6, metalness: 0.5 });
const lampBox = new THREE.BoxGeometry(0.7, 0.34, 0.2);
const stopGeo = new THREE.PlaneGeometry(7.8, 0.3).rotateX(-Math.PI / 2);
const stopMat = new THREE.MeshBasicMaterial({ color: 0xf4f4ee, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });

export function createBusCrossing(variant: number, xc: number, dir: number, gates: boolean): { group: THREE.Group; bus: THREE.Object3D } {
  const group = new THREE.Group();
  const bus = createBus(BUS_LEN, variant, true);
  bus.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  bus.position.x = xc;
  group.add(bus);
  if (gates) {
    for (const s of [-1, 1]) {
      const mouth = new THREE.Mesh(mouthGeo, mouthMat);
      mouth.position.set(s * 9.27, 1.55, 0);
      mouth.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      group.add(mouth);
      const top = new THREE.Mesh(frameTop, frameMat);
      top.position.set(s * 9.2, 3.25, 0);
      group.add(top);
      for (const z of [-1.85, 1.85]) {
        const post = new THREE.Mesh(framePost, frameMat);
        post.position.set(s * 9.2, 1.6, z);
        group.add(post);
      }
      // blinking warning lamps on both sides of the tracks
      const pole = new THREE.Mesh(lampPost, lampBoxMat);
      pole.position.set(s * 4.9, 1.7, 1.6);
      group.add(pole);
      const box = new THREE.Mesh(lampBox, lampBoxMat);
      box.position.set(s * 4.9, 3.5, 1.6);
      group.add(box);
      for (const lx of [-0.2, 0.2]) {
        const ball = new THREE.Mesh(lampBall, crossLampMat);
        ball.position.set(s * 4.9 + lx, 3.5, 1.72);
        group.add(ball);
      }
    }
    for (const z of [-2.1, 2.1]) {
      const line = new THREE.Mesh(stopGeo, stopMat);
      line.position.set(0, 0.06, z);
      group.add(line);
    }
  }
  return { group, bus };
}

/* ------------------------------------------------------------------ */
/* Ghost                                                               */
/* ------------------------------------------------------------------ */

const ghostMat = new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.9 });
const ghostEyeMat = new THREE.MeshBasicMaterial({ color: 0x07080f });
const ghostHead = new THREE.SphereGeometry(0.62, 18, 14);
const ghostTorso = new THREE.CylinderGeometry(0.62, 0.86, 1.1, 18);
const ghostTail = new THREE.SphereGeometry(0.27, 10, 8);
const ghostEye = new THREE.SphereGeometry(1, 10, 8);
const ghostArm = new THREE.CapsuleGeometry(0.1, 0.5, 4, 8);

export function createGhost(): { group: THREE.Group; body: THREE.Group } {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 2.0;
  group.add(body);
  const head = new THREE.Mesh(ghostHead, ghostMat);
  head.position.y = 0.25;
  head.scale.set(1, 1.08, 1);
  body.add(head);
  const torso = new THREE.Mesh(ghostTorso, ghostMat);
  torso.position.y = -0.3;
  body.add(torso);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const t = new THREE.Mesh(ghostTail, ghostMat);
    t.position.set(Math.cos(a) * 0.72, -0.85 - (i % 2) * 0.08, Math.sin(a) * 0.72);
    body.add(t);
  }
  for (const x of [-1, 1]) {
    const eye = new THREE.Mesh(ghostEye, ghostEyeMat);
    eye.position.set(x * 0.22, 0.32, 0.6);
    eye.scale.set(0.11, 0.17, 0.07);
    body.add(eye);
    const arm = new THREE.Mesh(ghostArm, ghostMat);
    arm.position.set(x * 0.7, -0.05, 0.3);
    arm.rotation.set(0.9, 0, x * 1.1);
    body.add(arm);
  }
  const mouth = new THREE.Mesh(ghostEye, ghostEyeMat);
  mouth.position.set(0, -0.02, 0.6);
  mouth.scale.set(0.16, 0.22, 0.07);
  body.add(mouth);
  return { group, body };
}
