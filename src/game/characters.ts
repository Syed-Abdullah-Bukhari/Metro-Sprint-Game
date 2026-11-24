import * as THREE from 'three';

export type HairStyle = 'cap' | 'ponytail' | 'afro' | 'beanie' | 'guard';

export interface Palette {
  name: string;
  jacket: number;
  pants: number;
  cap: number;
  skin: number;
  shoes: number;
  pack: number;
  hair: number;
  style: HairStyle;
}

export const CHARACTERS: Palette[] = [
  { name: 'Rex', jacket: 0x2f6bff, pants: 0x2a2f45, cap: 0xff4d4d, skin: 0xf2c29b, shoes: 0xffffff, pack: 0xffc233, hair: 0x2a1b12, style: 'cap' },
  { name: 'Nova', jacket: 0xff4f8b, pants: 0x3a2f5b, cap: 0x2ee6c5, skin: 0xc68a62, shoes: 0xffe14d, pack: 0x7a5cff, hair: 0x14141c, style: 'ponytail' },
  { name: 'Kai', jacket: 0x22c55e, pants: 0x1f2937, cap: 0xfacc15, skin: 0x8d5a3b, shoes: 0xff7a1a, pack: 0x1f2937, hair: 0x0e0e12, style: 'afro' },
  { name: 'Mia', jacket: 0xa855f7, pants: 0x1e293b, cap: 0xf97316, skin: 0xf5d0b0, shoes: 0x38bdf8, pack: 0xf43f5e, hair: 0x8a4b1f, style: 'beanie' },
];

export const GUARD: Palette = {
  name: 'Guard',
  jacket: 0x23407a,
  pants: 0x1a2340,
  cap: 0x1a2340,
  skin: 0xe0b090,
  shoes: 0x111111,
  pack: 0x23407a,
  hair: 0x222222,
  style: 'guard',
};

export interface HumanRig {
  root: THREE.Group;
  rig: THREE.Group;
  torso: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  head: THREE.Group;
  pack: THREE.Object3D;
  tail: THREE.Object3D | null;
  jet: THREE.Group;
  flames: THREE.Mesh[];
  shoeMat: THREE.MeshToonMaterial;
}

/* ---------- materials: cel-shaded clothes, glossy bits ---------- */

const toonGrad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([85, 160, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const toon = (c: number) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonGrad });
const std = (c: number, rough = 0.62, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0b0d1a, side: THREE.BackSide });

interface Opt {
  scale?: [number, number, number];
  rot?: [number, number, number];
  outline?: boolean;
  cast?: boolean;
}

/** Adds a mesh (with an optional inverted-hull cartoon outline) to a parent. */
function mk(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  o: Opt = {},
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (o.scale) m.scale.set(...o.scale);
  if (o.rot) m.rotation.set(...o.rot);
  m.castShadow = o.cast ?? true;
  parent.add(m);
  if (o.outline !== false) {
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const s = o.scale ?? [1, 1, 1];
    const r = geo.boundingSphere!.radius * Math.max(s[0], s[1], s[2]);
    const k = 1 + Math.min(0.4, 0.03 / Math.max(0.05, r));
    const ol = new THREE.Mesh(geo, OUTLINE);
    ol.position.copy(m.position);
    ol.rotation.copy(m.rotation);
    ol.scale.copy(m.scale).multiplyScalar(k);
    parent.add(ol);
  }
  return m;
}

function starGeo() {
  const sh = new THREE.Shape();
  const n = 5;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.045 : 0.1;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false });
}

const G = {
  chest: new THREE.CapsuleGeometry(0.27, 0.2, 6, 16),
  band: new THREE.CylinderGeometry(0.31, 0.31, 0.08, 18),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  head: new THREE.SphereGeometry(0.31, 30, 22),
  upper: new THREE.CapsuleGeometry(0.1, 0.12, 4, 10),
  fore: new THREE.CapsuleGeometry(0.09, 0.12, 4, 10),
  thigh: new THREE.CapsuleGeometry(0.14, 0.1, 4, 10),
  shin: new THREE.CapsuleGeometry(0.12, 0.12, 4, 10),
  shoe: new THREE.CapsuleGeometry(0.15, 0.2, 4, 10),
  pack: new THREE.CapsuleGeometry(0.17, 0.22, 4, 10),
  cuff: new THREE.CylinderGeometry(0.115, 0.115, 0.07, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  dome: new THREE.SphereGeometry(0.34, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
  hair: new THREE.SphereGeometry(0.325, 22, 12, 0, Math.PI, Math.PI * 0.1, Math.PI * 0.55),
  brimBack: new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20, 1, false, -Math.PI / 2, Math.PI),
  brimFront: new THREE.CylinderGeometry(0.33, 0.33, 0.04, 20, 1, false, Math.PI / 2, Math.PI),
  mouth: new THREE.TorusGeometry(0.07, 0.014, 6, 14, Math.PI),
  tank: new THREE.CylinderGeometry(0.11, 0.11, 0.62, 12),
  tankTip: new THREE.CylinderGeometry(0.04, 0.11, 0.14, 12),
  torus: new THREE.TorusGeometry(0.325, 0.035, 8, 28),
  ponyTail: new THREE.CapsuleGeometry(0.075, 0.34, 4, 8),
  star: starGeo(),
  flame: (() => {
    const g = new THREE.ConeGeometry(0.1, 0.55, 10);
    g.rotateX(Math.PI);
    return g;
  })(),
  flameIn: (() => {
    const g = new THREE.ConeGeometry(0.055, 0.34, 8);
    g.rotateX(Math.PI);
    return g;
  })(),
};

export function buildHuman(p: Palette, guard = false): HumanRig {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  rig.position.y = 0.9;
  root.add(rig);
  const Y = (y: number) => y - 0.9;

  const jacket = toon(p.jacket);
  const pants = toon(p.pants);
  const skin = toon(p.skin);
  const shoeMat = toon(p.shoes);
  const capM = toon(p.cap);
  const capD = toon(p.cap);
  capD.side = THREE.DoubleSide;
  const packM = toon(p.pack);
  const darkM = toon(0x14161f);
  const whiteM = toon(0xf3f5fb);
  const hairM = toon(p.hair);
  hairM.side = THREE.DoubleSide;
  const accent = toon(guard ? 0xf2c230 : p.cap);
  const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeB = new THREE.MeshBasicMaterial({ color: 0x10121c });
  const blush = new THREE.MeshBasicMaterial({ color: 0xff7a8a, transparent: true, opacity: 0.45 });

  const torso = new THREE.Group();
  torso.position.set(0, Y(0.85), 0);
  rig.add(torso);

  // jacket, waistband, hood, zip
  mk(torso, G.chest, jacket, [0, 0.36, 0], { scale: [1.25, 1, 0.82] });
  mk(torso, G.band, accent, [0, 0.1, 0], { scale: [1.27, 1, 0.86], outline: false });
  mk(torso, G.sphere, jacket, [0, 0.7, 0.15], { scale: [0.23, 0.15, 0.17], outline: false });
  mk(torso, G.box, whiteM, [0, 0.36, -0.356], { scale: [0.026, 0.52, 0.02], outline: false, cast: false });
  // backpack with star badge
  const pack = new THREE.Group();
  pack.position.set(0, 0.38, 0.35);
  torso.add(pack);
  mk(pack, G.pack, packM, [0, 0, 0], { scale: [1.2, 1, 0.72] });
  mk(pack, G.box, accent, [0, -0.16, 0.11], { scale: [0.3, 0.14, 0.06], outline: false });
  const star = mk(pack, G.star, accent, [0, 0.04, 0.12], { outline: false, cast: false });
  star.rotation.y = 0;
  for (const x of [-1, 1]) mk(pack, G.box, darkM, [x * 0.17, 0.05, -0.1], { scale: [0.05, 0.4, 0.04], outline: false, cast: false });

  // ---- head ----
  const head = new THREE.Group();
  head.position.set(0, 0.99, 0);
  torso.add(head);
  mk(head, G.head, skin, [0, 0, 0], { scale: [1, 1.04, 1] });
  for (const x of [-1, 1]) {
    mk(head, G.sphere, skin, [x * 0.31, -0.01, 0], { scale: [0.035, 0.065, 0.055], outline: false });
    // eyes with highlight
    mk(head, G.sphere, eyeW, [x * 0.115, 0.03, -0.268], { scale: [0.07, 0.08, 0.03], outline: false, cast: false });
    mk(head, G.sphere, eyeB, [x * 0.115, 0.025, -0.292], { scale: [0.043, 0.05, 0.02], outline: false, cast: false });
    mk(head, G.sphere, eyeW, [x * 0.125, 0.045, -0.306], { scale: [0.014, 0.014, 0.01], outline: false, cast: false });
    mk(head, G.box, hairM, [x * 0.115, 0.125, -0.274], { scale: [0.11, 0.022, 0.02], rot: [0, 0, x * -0.18], outline: false, cast: false });
    mk(head, G.sphere, blush, [x * 0.2, -0.07, -0.25], { scale: [0.06, 0.04, 0.02], outline: false, cast: false });
  }
  mk(head, G.sphere, skin, [0, -0.04, -0.31], { scale: [0.045, 0.04, 0.045], outline: false, cast: false });
  mk(head, G.mouth, eyeB, [0, -0.095, -0.28], { rot: [0, 0, Math.PI], scale: [1, 1, 0.5], outline: false, cast: false });

  let tail: THREE.Object3D | null = null;
  switch (p.style) {
    case 'cap': {
      mk(head, G.hair, hairM, [0, 0, 0], { rot: [0, Math.PI, 0], outline: false });
      mk(head, G.dome, capD, [0, 0.055, 0], { scale: [1, 1.06, 1] });
      mk(head, G.brimBack, capD, [0, 0.08, 0.22], { rot: [-0.16, 0, 0], outline: false });
      break;
    }
    case 'ponytail': {
      mk(head, G.hair, hairM, [0, 0.02, 0], { rot: [0, Math.PI, 0], scale: [1.02, 1.04, 1.02], outline: false });
      mk(head, G.sphere, hairM, [0, 0.2, -0.02], { scale: [0.3, 0.17, 0.3], outline: false });
      const band = mk(head, G.torus, accent, [0, 0.12, -0.02], { rot: [Math.PI / 2 - 0.25, 0, 0], outline: false });
      band.scale.set(1, 1, 1);
      const t = new THREE.Group();
      t.position.set(0, 0.2, 0.3);
      mk(t, G.sphere, accent, [0, 0, 0], { scale: [0.07, 0.07, 0.07], outline: false });
      mk(t, G.ponyTail, hairM, [0, -0.22, 0.05], { outline: true });
      head.add(t);
      tail = t;
      break;
    }
    case 'afro': {
      mk(head, G.sphere, hairM, [0, 0.12, 0.05], { scale: [0.4, 0.37, 0.4] });
      // sunglasses pushed up on the forehead
      mk(head, G.box, accent, [-0.12, 0.2, -0.3], { scale: [0.15, 0.08, 0.03], outline: false });
      mk(head, G.box, accent, [0.12, 0.2, -0.3], { scale: [0.15, 0.08, 0.03], outline: false });
      mk(head, G.box, darkM, [0, 0.2, -0.3], { scale: [0.1, 0.02, 0.03], outline: false });
      mk(head, G.torus, whiteM, [0, 0.0, 0.0], { rot: [Math.PI / 2, 0, 0], scale: [1.0, 1.0, 1.0], outline: false });
      break;
    }
    case 'beanie': {
      mk(head, G.hair, hairM, [0, 0.0, 0], { rot: [0, Math.PI, 0], scale: [1.04, 1.1, 1.04], outline: false });
      mk(head, G.sphere, hairM, [0, -0.25, 0.22], { scale: [0.3, 0.42, 0.14] });
      mk(head, G.dome, capM, [0, 0.06, 0], { scale: [1.04, 1.1, 1.04] });
      mk(head, G.torus, accent, [0, 0.07, 0], { rot: [Math.PI / 2, 0, 0], scale: [1.07, 1.07, 1.7], outline: false });
      mk(head, G.sphere, whiteM, [0, 0.43, 0], { scale: [0.1, 0.1, 0.1] });
      break;
    }
    case 'guard': {
      mk(head, new THREE.CylinderGeometry(0.33, 0.35, 0.18, 20), capM, [0, 0.22, 0]);
      mk(head, G.brimFront, darkM, [0, 0.13, -0.24], { rot: [0.12, 0, 0], outline: false });
      mk(head, G.box, accent, [0, 0.22, -0.35], { scale: [0.11, 0.09, 0.02], outline: false });
      mk(head, G.hair, hairM, [0, 0, 0], { rot: [0, Math.PI, 0], outline: false });
      break;
    }
  }

  // ---- arms (shoulder -> elbow) ----
  const mkArm = (x: number) => {
    const a = new THREE.Group();
    a.position.set(x, 0.62, 0);
    mk(a, G.sphere, jacket, [0, 0, 0], { scale: [0.135, 0.135, 0.135], outline: false });
    mk(a, G.upper, jacket, [0, -0.15, 0]);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    mk(elbow, G.fore, jacket, [0, -0.14, 0]);
    mk(elbow, G.cuff, whiteM, [0, -0.3, 0], { outline: false });
    mk(elbow, G.sphere, skin, [0, -0.38, 0], { scale: [0.105, 0.105, 0.105] });
    a.add(elbow);
    torso.add(a);
    return { a, elbow };
  };
  const aL = mkArm(-0.47);
  const aR = mkArm(0.47);

  // ---- legs (hip -> knee) ----
  const mkLeg = (x: number) => {
    const l = new THREE.Group();
    l.position.set(x, Y(0.85), 0);
    mk(l, G.thigh, pants, [0, -0.17, 0]);
    const knee = new THREE.Group();
    knee.position.set(0, -0.3, 0);
    mk(knee, G.shin, pants, [0, -0.15, 0]);
    mk(knee, G.cuff, whiteM, [0, -0.3, 0], { scale: [1.15, 0.7, 1.15], outline: false });
    mk(knee, G.shoe, shoeMat, [0, -0.38, -0.06], { rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.72] });
    mk(knee, G.sphere, whiteM, [0, -0.38, -0.2], { scale: [0.13, 0.1, 0.1], outline: false });
    mk(knee, G.box, whiteM, [0, -0.455, -0.06], { scale: [0.28, 0.04, 0.4], outline: false });
    l.add(knee);
    rig.add(l);
    return { l, knee };
  };
  const lL = mkLeg(-0.17);
  const lR = mkLeg(0.17);

  // jetpack (hidden until needed)
  const jet = new THREE.Group();
  jet.position.set(0, 0.36, 0.55);
  jet.visible = false;
  const flames: THREE.Mesh[] = [];
  const tankM = std(0xb9c2d3, 0.55, 0.15);
  const tipM = std(0xe63946, 0.4);
  const flameM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.55, 0.1) });
  const flameIn = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.92, 0.45) });
  for (const x of [-0.15, 0.15]) {
    mk(jet, G.tank, tankM, [x, 0, 0], { outline: false });
    mk(jet, G.tankTip, tipM, [x, 0.38, 0], { outline: false });
    const f = new THREE.Mesh(G.flame, flameM);
    f.position.set(x, -0.58, 0);
    jet.add(f);
    const fi = new THREE.Mesh(G.flameIn, flameIn);
    fi.position.set(x, -0.5, 0);
    jet.add(fi);
    flames.push(f, fi);
  }
  torso.add(jet);

  if (guard) root.scale.setScalar(1.08);

  return {
    root,
    rig,
    torso,
    legL: lL.l,
    legR: lR.l,
    kneeL: lL.knee,
    kneeR: lR.knee,
    armL: aL.a,
    armR: aR.a,
    elbowL: aL.elbow,
    elbowR: aR.elbow,
    head,
    pack,
    tail,
    jet,
    flames,
    shoeMat,
  };
}

export interface Pose {
  phase: number;
  air: boolean;
  /** -1 when not rolling, otherwise 0..1 progress */
  roll: number;
  lean: number;
  jet: boolean;
  dead: number;
  hit: number;
}

export function poseHuman(h: HumanRig, p: Pose) {
  const { rig, torso, legL, legR, kneeL, kneeR, armL, armR, elbowL, elbowR } = h;
  rig.scale.setScalar(1);
  rig.position.y = 0.9;
  rig.rotation.set(0, 0, 0);
  torso.rotation.set(0, 0, 0);
  armL.rotation.z = 0;
  armR.rotation.z = 0;
  h.head.rotation.set(0, 0, 0);
  h.pack.position.y = 0.38;
  let tailSwing = 0.5;

  if (p.dead > 0) {
    rig.rotation.x = p.dead * 1.35;
    rig.position.y = 0.9 - p.dead * 0.5;
    legL.rotation.x = 0.4;
    legR.rotation.x = -0.3;
    kneeL.rotation.x = -0.5;
    kneeR.rotation.x = -0.2;
    armL.rotation.x = 2.4 * p.dead;
    armR.rotation.x = 1.9 * p.dead;
    elbowL.rotation.x = 0.3;
    elbowR.rotation.x = 0.3;
    armL.rotation.z = 0.5 * p.dead;
    armR.rotation.z = -0.5 * p.dead;
    if (h.tail) h.tail.rotation.x = 0.9;
    return;
  }

  if (p.roll >= 0) {
    rig.scale.setScalar(0.64);
    rig.position.y = 0.56;
    rig.rotation.x = -p.roll * Math.PI * 2;
    legL.rotation.x = 1.5;
    legR.rotation.x = 1.5;
    kneeL.rotation.x = -2.0;
    kneeR.rotation.x = -2.0;
    armL.rotation.x = 1.3;
    armR.rotation.x = 1.3;
    elbowL.rotation.x = 1.3;
    elbowR.rotation.x = 1.3;
  } else if (p.jet) {
    rig.rotation.x = -0.45;
    legL.rotation.x = 0.35 + Math.sin(p.phase * 0.3) * 0.1;
    legR.rotation.x = -0.1 + Math.sin(p.phase * 0.3 + 1) * 0.1;
    kneeL.rotation.x = -0.4;
    kneeR.rotation.x = -0.6;
    armL.rotation.x = 0.4;
    armR.rotation.x = 0.4;
    elbowL.rotation.x = 0.3;
    elbowR.rotation.x = 0.3;
    armL.rotation.z = 0.35;
    armR.rotation.z = -0.35;
    tailSwing = 1.1;
  } else if (p.air) {
    legL.rotation.x = 1.0;
    legR.rotation.x = -0.55;
    kneeL.rotation.x = -0.9;
    kneeR.rotation.x = -1.3;
    armL.rotation.x = 2.5;
    armR.rotation.x = 2.1;
    elbowL.rotation.x = 0.35;
    elbowR.rotation.x = 0.5;
    armL.rotation.z = 0.2;
    armR.rotation.z = -0.2;
    torso.rotation.x = -0.08;
    tailSwing = 0.9;
  } else {
    const s = Math.sin(p.phase);
    const c = Math.cos(p.phase);
    legL.rotation.x = s * 1.0;
    legR.rotation.x = -s * 1.0;
    kneeL.rotation.x = -(0.15 + 1.05 * Math.max(0, c));
    kneeR.rotation.x = -(0.15 + 1.05 * Math.max(0, -c));
    armL.rotation.x = -s * 0.95;
    armR.rotation.x = s * 0.95;
    elbowL.rotation.x = 1.05 + 0.35 * Math.max(0, s);
    elbowR.rotation.x = 1.05 + 0.35 * Math.max(0, -s);
    const bob = Math.abs(c);
    rig.position.y = 0.9 + bob * 0.08;
    torso.rotation.x = -0.14;
    torso.rotation.y = s * 0.12;
    h.head.rotation.y = -s * 0.05;
    h.pack.position.y = 0.38 + bob * 0.025;
    tailSwing = 0.5 + 0.3 * Math.sin(p.phase * 2 + 0.6);
  }
  if (h.tail) {
    h.tail.rotation.x = tailSwing;
    h.tail.rotation.z = Math.sin(p.phase) * 0.25 - p.lean * 1.5;
  }
  if (p.hit > 0) {
    rig.rotation.x -= p.hit * 0.55;
    armL.rotation.x += p.hit * 1.2;
    armR.rotation.x += p.hit * 1.2;
  }
  rig.rotation.z = p.lean;
  rig.rotation.y = -p.lean * 0.9;
}

/* ------------------------------------------------------------------ */
/* Dog                                                                 */
/* ------------------------------------------------------------------ */

export interface DogRig {
  root: THREE.Group;
  legs: THREE.Group[];
  tail: THREE.Group;
}

export function buildDog(): DogRig {
  const root = new THREE.Group();
  const fur = toon(0x9a6a3a);
  const dark = toon(0x4b2f1a);
  const black = std(0x111111, 0.4);
  const bodyG = new THREE.CapsuleGeometry(0.2, 0.55, 4, 10);
  mk(root, bodyG, fur, [0, 0.62, 0], { rot: [Math.PI / 2, 0, 0] });
  const head = new THREE.Group();
  head.position.set(0, 0.86, -0.64);
  root.add(head);
  mk(head, new THREE.SphereGeometry(0.2, 14, 10), fur, [0, 0, 0]);
  mk(head, new THREE.CapsuleGeometry(0.09, 0.1, 4, 8), dark, [0, -0.06, -0.2], { rot: [Math.PI / 2, 0, 0] });
  mk(head, new THREE.SphereGeometry(0.04, 8, 6), black, [0, -0.02, -0.33], { outline: false });
  for (const x of [-1, 1]) {
    mk(head, new THREE.BoxGeometry(0.09, 0.2, 0.07), dark, [x * 0.13, 0.2, 0.04], { rot: [0, 0, x * 0.25] });
    mk(head, new THREE.SphereGeometry(0.025, 6, 5), black, [x * 0.09, 0.05, -0.17], { outline: false });
  }
  const legs: THREE.Group[] = [];
  for (const [x, z] of [
    [-0.14, -0.32],
    [0.14, -0.32],
    [-0.14, 0.32],
    [0.14, 0.32],
  ]) {
    const l = new THREE.Group();
    l.position.set(x, 0.42, z);
    mk(l, new THREE.CapsuleGeometry(0.06, 0.28, 4, 8), fur, [0, -0.2, 0]);
    root.add(l);
    legs.push(l);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.74, 0.5);
  mk(tail, new THREE.CapsuleGeometry(0.04, 0.3, 4, 6), dark, [0, 0, 0.18], { rot: [Math.PI / 2, 0, 0] });
  tail.rotation.x = 0.7;
  root.add(tail);
  return { root, legs, tail };
}

export function poseDog(d: DogRig, phase: number) {
  const s = Math.sin(phase);
  d.legs[0].rotation.x = s * 1.0;
  d.legs[1].rotation.x = -s * 1.0;
  d.legs[2].rotation.x = -s * 1.0;
  d.legs[3].rotation.x = s * 1.0;
  d.root.position.y = Math.abs(Math.cos(phase)) * 0.1;
  d.tail.rotation.z = Math.sin(phase * 1.5) * 0.4;
}
