import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audio } from './audio';
import { drawBadge, ICON_COLORS, type IconKind } from './icons';
import {
  LANE_W,
  TRAIN_H,
  RAMP_LEN,
  TRAIN_COLORS,
  createTrain,
  createBus,
  createCar,
  BUS_COLORS,
  CAR_COLORS,
  createRamp,
  createLowBarrier,
  createHighBarrier,
  createCoinAssets,
  makeTrackTextures,
  makeGroundTextures,
  makeWallTextures,
  makeBuildingTexturePair,
  rnd,
  pick,
  clamp,
} from './assets';
import {
  CHARACTERS,
  GUARD,
  buildHuman,
  buildDog,
  poseHuman,
  poseDog,
  type HumanRig,
  type DogRig,
} from './characters';
import { Particles } from './particles';
import { THEMES, LEVEL_LEN, BASE_SPEED, MAX_SPEED, speedAt, levelAt, themeOfLevel, type Theme, type PropKind } from './themes';
import {
  makeProp,
  FAR_PROP,
  createBillboard,
  createGantry,
  createCanopy,
  createCaveShell,
  createCaveDecor,
  createPortal,
  createLavaStrip,
  createBoulder,
  createPad,
  createGhost,
  createRoadTile,
  createBusCrossing,
  setCrossBlink,
  BUS_LEN,
  BUS_K,
} from './props';
import { Weather } from './effects';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type Phase = 'menu' | 'playing' | 'paused' | 'dying' | 'over';
export type QualityPref = 'auto' | 'high' | 'low';

export interface HudState {
  score: number;
  coins: number;
  best: number;
  speed: number;
  kmh: number;
  mult: number;
  timers: Record<IconKind, number>;
  stumble: boolean;
  level: number;
  levelProgress: number;
  theme: string;
  accent: string;
}

export interface LevelInfo {
  level: number;
  name: string;
  twist: string;
  accent: string;
  bonus: number;
  start: boolean;
}

export interface RunResult {
  score: number;
  coins: number;
  distance: number;
  best: number;
  newBest: boolean;
  level: number;
  levelName: string;
  kmh: number;
}

export interface GameEvents {
  onHud: (h: HudState) => void;
  onPhase: (p: Phase) => void;
  onOver: (r: RunResult) => void;
  onLevel: (l: LevelInfo) => void;
}

export function levelInfo(level: number) {
  const t = themeOfLevel(level);
  return { name: t.name, twist: t.twist, accent: t.accent };
}

export function readStats() {
  let best = 0;
  let total = 0;
  let ch = 0;
  let maxLevel = 1;
  let q: QualityPref = 'auto';
  try {
    best = Number(localStorage.getItem('ms_best') || 0);
    total = Number(localStorage.getItem('ms_total') || 0);
    ch = Number(localStorage.getItem('ms_char') || 0);
    maxLevel = Math.max(1, Number(localStorage.getItem('ms_maxlevel') || 1));
    const sq = localStorage.getItem('ms_quality');
    if (sq === 'high' || sq === 'low' || sq === 'auto') q = sq;
  } catch {
    /* ignore */
  }
  return { best, total, ch: clamp(ch | 0, 0, CHARACTERS.length - 1), maxLevel: maxLevel | 0, q };
}

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

const SEG_L = 20;
const SEG_N = 14;
const SPAWN_AHEAD = 190;
const TRAFFIC_AHEAD = 195;
const GRAVITY = 32;
const JUMP_V = 11;
const JUMP_V_HIGH = 13;
const JET_Y = 4.6;
const ROLL_DUR = 0.62;
const DUR: Record<IconKind, number> = { magnet: 10, jetpack: 6.5, sneakers: 12, x2: 12 };

/** Things far ahead grow out of the ground instead of popping in (there is no fog to hide them). */
const rise = (ahead: number) => {
  const k = clamp((205 - ahead) / 45, 0, 1);
  return Math.max(0.001, k * k * (3 - 2 * k));
};

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function weighted<T>(items: [T, number][]): T {
  let tot = 0;
  for (const [, w] of items) tot += w;
  let r = Math.random() * tot;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

/* ------------------------------------------------------------------ */
/* Internal types                                                      */
/* ------------------------------------------------------------------ */

interface Obstacle {
  kind: 'train' | 'ramp' | 'low' | 'high' | 'boulder' | 'bus' | 'ghost';
  lane: number;
  d0: number;
  d1: number;
  vel: number;
  mesh: THREE.Object3D;
  hit: boolean;
  horn: boolean;
  roll?: THREE.Object3D;
  bus?: { obj: THREE.Object3D; xc: number; dir: number; k: number; half: number };
}
interface Vehicle {
  mesh: THREE.Object3D;
  d: number;
  vel: number;
  x: number;
  len: number;
  kind: 'road' | 'rail';
}
interface Coin {
  mesh: THREE.Mesh;
  d: number;
  x: number;
  y: number;
  fly: boolean;
}
interface Pickup {
  kind: IconKind;
  sprite: THREE.Sprite;
  d: number;
  x: number;
  y: number;
}
interface Bld {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  near: boolean;
  idx: number;
  side: number;
}
interface Seg {
  group: THREE.Group;
  index: number;
  lastZ: number;
  walls: THREE.Mesh[];
  blds: Bld[];
  lamps: THREE.Group[];
  trainHolders: THREE.Group[];
  props: THREE.Group[];
  bbs: (THREE.Mesh | null)[];
  gantry: THREE.Group | null;
  bridge: THREE.Group;
  cave: THREE.Group;
  caveDecor: THREE.Group | null;
  portals: THREE.Group[];
  lava: THREE.Mesh[];
  canopy: THREE.Mesh | null;
  roads: THREE.Mesh[];
}

type JetState = 'off' | 'fly' | 'land';

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

export class Game {
  private container: HTMLElement;
  private ev: GameEvents;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private ro: ResizeObserver;
  private raf = 0;
  private lastT = performance.now();
  private disposed = false;

  phase: Phase = 'menu';

  // quality
  private qualityPref: QualityPref = 'auto';
  private quality: 'high' | 'low' = 'high';
  private autoQ = true;
  private perfN = 0;
  private perfAcc = 0;

  // environment
  private hemi: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private skyGroup = new THREE.Group();
  private uTop = { value: new THREE.Color() };
  private uBottom = { value: new THREE.Color() };
  private sunMesh!: THREE.Mesh;
  private stars!: THREE.Points;
  private cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
  private cloudGroup = new THREE.Group();
  private lampMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
  private groundMat!: THREE.MeshStandardMaterial;
  private trackMats: THREE.MeshStandardMaterial[] = [];
  private scrollers: { tex: THREE.Texture[]; period: number }[] = [];
  private wallMats: THREE.MeshStandardMaterial[] = [];
  private wallGeo = new THREE.BoxGeometry(0.6, 2.6, SEG_L);
  private bldGeo = new THREE.BoxGeometry(1, 1, 1);
  private bTex = Array.from({ length: 4 }, () => makeBuildingTexturePair());
  private bridgeMat = new THREE.MeshStandardMaterial({ color: 0x8b8f99, roughness: 0.8 });
  private segs: Seg[] = [];
  private night = 0;
  private tmpC = new THREE.Color();
  private tmpP = new THREE.Vector3();
  private tmpL = new THREE.Vector3();
  private surgeT = 0;
  private surgeAmp = 0;
  private surgeCur = 0;
  private pads: { mesh: THREE.Mesh; d: number; x: number; used: boolean }[] = [];
  private traffic: Vehicle[] = [];
  private trafficT = [0.4, 1.0];
  private best = readStats().best;
  private maxLevel = readStats().maxLevel;
  private weather = new Weather();
  private weatherWanted: Theme['weather'] = 'none';
  private laneRate = 15;
  private menuFrom = 0;
  private menuTo = 0;
  private menuT = 1;

  // world state
  private distance = 0;
  private runStart = 0;
  private startLevel = 1;
  private level = 1;
  private runTime = 0;
  private speed = 0;
  private slow = 1;
  private time = 0;
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private pickups: Pickup[] = [];
  private spawnD = 0;
  private openLane = 0;
  private safeSpawns = 2;
  private nextPickupD = 450;
  private coinAssets = createCoinAssets();
  private badgeTex = new Map<IconKind, THREE.CanvasTexture>();
  private particles = new Particles();

  // player
  private human!: HumanRig;
  private charIdx = 0;
  private shadow: THREE.Mesh;
  private lane = 0;
  private laneFrom = 0;
  private px = 0;
  private py = 0;
  private vy = 0;
  private grounded = true;
  private coyote = 0;
  private jumpBuf = 0;
  private rollT = 0;
  private rollOnLand = false;
  private runPhase = 0;
  private jet: JetState = 'off';
  private timers: Record<IconKind, number> = { magnet: 0, jetpack: 0, sneakers: 0, x2: 0 };
  private stumbleT = 0;
  private graceT = 0;
  private invincT = 0;
  private hitAnim = 0;
  private dyingT = 0;
  private scoreF = 0;
  private coinCount = 0;
  private coinStreak = 0;
  private lastCoinT = 0;
  private hudT = 0;
  private shake = 0;
  private camRoll = 0;

  // chasers
  private guard: HumanRig;
  private dog: DogRig;
  private chasers = new THREE.Group();
  private guardZ = 60;
  private guardX = 0;

  // camera
  private camPos = new THREE.Vector3(3, 2.2, 6);
  private camLook = new THREE.Vector3(-1, 1.2, 0);
  private camCfg = { fov: 62, z: 8.4, y: 5.3 };
  private aspect = 1.6;

  // input
  private touch: { x: number; y: number; done: boolean } | null = null;

  constructor(container: HTMLElement, ev: GameEvents) {
    this.container = container;
    this.ev = ev;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const cv = this.renderer.domElement;
    cv.style.display = 'block';
    cv.style.width = '100%';
    cv.style.height = '100%';
    cv.style.touchAction = 'none';
    container.appendChild(cv);

    this.camera = new THREE.PerspectiveCamera(62, 1.6, 0.5, 900);

    // image based lighting for the PBR materials
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888899, 1);
    this.scene.add(this.hemi);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sunLight.position.set(-26, 34, 2);
    this.sunLight.target.position.set(0, 0, -14);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const sc = this.sunLight.shadow.camera;
    sc.left = -22;
    sc.right = 22;
    sc.top = 34;
    sc.bottom = -34;
    sc.near = 1;
    sc.far = 140;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.04;
    this.scene.add(this.sunLight, this.sunLight.target);

    this.buildSky();
    this.buildGround();
    this.buildDecor();

    this.scene.add(this.particles.mesh, this.weather.mesh);

    // player + extras
    this.charIdx = readStats().ch;
    this.mountHuman();
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    this.guard = buildHuman(GUARD, true);
    this.dog = buildDog();
    this.dog.root.position.set(1.0, 0, -0.9);
    this.chasers.add(this.guard.root);
    this.chasers.add(this.dog.root);
    this.chasers.visible = false;
    this.scene.add(this.chasers);

    // quality
    this.initQuality();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    window.addEventListener('keydown', this.onKey);
    cv.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.reset();
    this.refreshDecor();
    this.applyBlend(THEMES[0], THEMES[0], 0);
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                        */
  /* ---------------------------------------------------------------- */

  start(level = 1) {
    audio.unlock();
    const lv = clamp(Math.floor(level), 1, Math.max(1, this.maxLevel));
    this.reset();
    this.startLevel = lv;
    this.level = lv;
    this.runStart = this.distance - (lv - 1) * LEVEL_LEN;
    this.menuFrom = this.menuTo = (lv - 1) % THEMES.length;
    this.menuT = 1;
    this.refreshDecor();
    this.setPhase('playing');
    audio.startMusic();
    this.announce(lv, true, 0);
  }

  toMenu() {
    this.reset();
    audio.stopMusic();
    this.phase = 'menu';
    this.refreshDecor();
    this.setPhase('menu');
  }

  pause() {
    if (this.phase !== 'playing') return;
    this.setPhase('paused');
    audio.stopMusic();
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.lastT = performance.now();
    this.setPhase('playing');
    audio.startMusic();
  }

  /** Changes the world shown behind the menu. */
  previewLevel(level: number) {
    const idx = (clamp(level, 1, 999) - 1) % THEMES.length;
    if (idx === this.menuTo) return;
    this.menuFrom = this.menuTo;
    this.menuTo = idx;
    this.menuT = 0;
    this.refreshDecor();
  }

  setCharacter(i: number) {
    this.charIdx = clamp(i, 0, CHARACTERS.length - 1);
    try {
      localStorage.setItem('ms_char', String(this.charIdx));
    } catch {
      /* ignore */
    }
    this.scene.remove(this.human.root);
    this.mountHuman();
  }

  getQuality(): { pref: QualityPref; effective: 'high' | 'low' } {
    return { pref: this.qualityPref, effective: this.quality };
  }

  setQualityPref(p: QualityPref) {
    this.qualityPref = p;
    try {
      localStorage.setItem('ms_quality', p);
    } catch {
      /* ignore */
    }
    this.autoQ = p === 'auto';
    this.quality = p === 'auto' ? (this.isMobile() ? 'low' : 'high') : p;
    this.applyQuality();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    audio.stopMusic();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Quality                                                           */
  /* ---------------------------------------------------------------- */

  private isMobile() {
    return window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
  }

  private initQuality() {
    const url = new URLSearchParams(location.search).get('q');
    const stored = readStats().q;
    if (url === 'high' || url === 'low') {
      this.qualityPref = url;
      this.autoQ = false;
      this.quality = url;
    } else {
      this.qualityPref = stored;
      this.autoQ = stored === 'auto';
      this.quality = stored === 'auto' ? (this.isMobile() ? 'low' : 'high') : stored;
    }
    this.applyQuality();
  }

  private applyQuality() {
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, this.quality === 'high' ? 1.75 : 1.25));
    this.sunLight.castShadow = this.quality === 'high';
    if (this.shadow) this.shadow.visible = this.quality === 'low';
    this.resize();
  }

  private monitorPerf(raw: number) {
    if (!this.autoQ || this.quality !== 'high' || this.phase === 'paused') return;
    if (raw > 0.25) return;
    this.perfN++;
    if (this.perfN <= 70) return; // warm-up (shader compiles)
    this.perfAcc += raw;
    if (this.perfN - 70 >= 140) {
      const avg = this.perfAcc / 140;
      this.perfAcc = 0;
      this.perfN = 70;
      if (avg > 0.037) {
        this.quality = 'low';
        this.applyQuality();
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Setup                                                             */
  /* ---------------------------------------------------------------- */

  private mountHuman() {
    this.human = buildHuman(CHARACTERS[this.charIdx]);
    this.scene.add(this.human.root);
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.ev.onPhase(p);
    if (p === 'playing') this.emitHud();
  }

  private buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: this.uTop, bottom: this.uBottom },
        vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
          void main(){ float h = clamp(vPos.y, 0.0, 1.0); float t = pow(h, 0.5); gl_FragColor = vec4(mix(bottom, top, t), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`,
      }),
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.skyGroup.add(sky);

    this.sunMesh = new THREE.Mesh(
      new THREE.CircleGeometry(20, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false, depthWrite: false }),
    );
    this.sunMesh.position.set(-70, 95, -270);
    this.sunMesh.renderOrder = -9;
    this.skyGroup.add(this.sunMesh);


    const sg = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 380; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 0.9 + 0.08;
      const r = Math.sqrt(1 - e * e) * 280;
      sp.push(Math.cos(a) * r, e * 280, Math.sin(a) * r);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }),
    );
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.skyGroup.add(this.stars);

    const cgeo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 12; i++) {
      const cl = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(cgeo, this.cloudMat);
        m.position.set(k * 9 - n * 4, Math.random() * 3, Math.random() * 4);
        m.scale.set(rnd(8, 13), rnd(4, 6), rnd(5, 8));
        cl.add(m);
      }
      const a = Math.random() * Math.PI * 2;
      const rad = rnd(170, 240);
      cl.position.set(Math.cos(a) * rad, rnd(45, 95), Math.sin(a) * rad);
      cl.rotation.y = -a + Math.PI / 2;
      this.cloudGroup.add(cl);
    }
    this.skyGroup.add(this.cloudGroup);
    this.scene.add(this.skyGroup);
  }

  private buildGround() {
    const tt3 = makeTrackTextures(3);
    const tt1 = makeTrackTextures(1);
    const gt = makeGroundTextures();
    tt3.map.repeat.set(1, 900 / LANE_W);
    tt3.bump.repeat.copy(tt3.map.repeat);
    tt1.map.repeat.set(1, 900 / LANE_W);
    tt1.bump.repeat.copy(tt1.map.repeat);
    gt.map.repeat.set(560 / 4, 900 / 4);
    gt.bump.repeat.copy(gt.map.repeat);
    this.scrollers = [
      { tex: [tt3.map, tt3.bump, tt1.map, tt1.bump], period: LANE_W },
      { tex: [gt.map, gt.bump], period: 4 },
    ];

    this.groundMat = new THREE.MeshStandardMaterial({ map: gt.map, bumpMap: gt.bump, bumpScale: 2, roughness: 0.95, metalness: 0 });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(560, 900), this.groundMat);
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, 0, -420);
    g.receiveShadow = true;
    this.scene.add(g);

    const mkTrack = (w: number, map: THREE.Texture, bump: THREE.Texture, x: number) => {
      const mat = new THREE.MeshStandardMaterial({
        map,
        bumpMap: bump,
        bumpScale: 3,
        roughness: 0.9,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      this.trackMats.push(mat);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 900), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.02, -420);
      m.receiveShadow = true;
      this.scene.add(m);
    };
    mkTrack(LANE_W * 3, tt3.map, tt3.bump, 0);
    mkTrack(LANE_W, tt1.map, tt1.bump, -6.8);
    mkTrack(LANE_W, tt1.map, tt1.bump, 6.8);
  }

  private buildDecor() {
    this.wallMats = makeWallTextures().map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0 }));
    for (let i = 0; i < SEG_N; i++) {
      const seg = this.buildSegment(i);
      this.segs.push(seg);
      this.scene.add(seg.group);
    }
  }

  private buildSegment(index: number): Seg {
    const group = new THREE.Group();
    const walls: THREE.Mesh[] = [];
    const lamps: THREE.Group[] = [];
    const trainHolders: THREE.Group[] = [];
    const props: THREE.Group[] = [];
    const blds: Bld[] = [];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4f, roughness: 0.5, metalness: 0.6 });

    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(this.wallGeo, this.wallMats[0]);
      w.position.set(s * 9.6, 1.3, 0);
      w.receiveShadow = true;
      group.add(w);
      walls.push(w);

      const lamp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.4, 8), poleMat);
      pole.position.set(s * 8.4, 2.7, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.08), poleMat);
      arm.position.set(s * 7.75, 5.4, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.32), this.lampMat);
      head.position.set(s * 7.2, 5.33, 0);
      lamp.add(pole, arm, head);
      group.add(lamp);
      lamps.push(lamp);

      const holder = new THREE.Group();
      holder.position.set(s * 6.8, 0, 0);
      group.add(holder);
      trainHolders.push(holder);

      const ph = new THREE.Group();
      group.add(ph);
      props.push(ph);

      for (let k = 0; k < 3; k++) {
        const pair = pick(this.bTex);
        const map = pair.map.clone();
        map.needsUpdate = true;
const mat = new THREE.MeshStandardMaterial({
          map,
          roughness: 0.85,
          metalness: 0,
        });
        const mesh = new THREE.Mesh(this.bldGeo, mat);
        group.add(mesh);
        blds.push({ mesh, mat, near: k < 2, idx: k, side: s });
      }
    }

    const bridge = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 1.0, 3.2), this.bridgeMat);
    deck.position.y = 8.6;
    bridge.add(deck);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(24, 0.5, 0.2), this.bridgeMat);
    rail.position.set(0, 9.35, 1.5);
    bridge.add(rail);
    for (const x of [-10.8, 10.8]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.6, 1.6), this.bridgeMat);
      p.position.set(x, 4.3, 0);
      bridge.add(p);
    }
    bridge.visible = false;
    group.add(bridge);

    const roads: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const road = createRoadTile();
      road.position.set(s * 6.8, 0.035, 0);
      road.visible = false;
      group.add(road);
      roads.push(road);
    }

    const cave = createCaveShell();
    cave.visible = false;
    group.add(cave);
    const portals: THREE.Group[] = [];
    for (const z of [10, -10]) {
      const pt = createPortal();
      pt.position.z = z;
      pt.visible = false;
      group.add(pt);
      portals.push(pt);
    }
    const lava: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const lv = createLavaStrip();
      lv.position.set(s * 21, 0.04, 0);
      lv.visible = false;
      group.add(lv);
      lava.push(lv);
    }

    return {
      group,
      index,
      lastZ: 0,
      walls,
      blds,
      lamps,
      trainHolders,
      props,
      bbs: [null, null],
      gantry: null,
      bridge,
      cave,
      caveDecor: null,
      portals,
      lava,
      canopy: null,
      roads,
    };
  }

  /** Which theme the scenery at segment-centre z should use. */
  private decorTheme(z: number): Theme {
    if (this.phase === 'menu') return THEMES[this.menuTo];
    const r = this.distance - this.runStart - z;
    return THEMES[Math.floor(Math.max(0, r) / LEVEL_LEN) % THEMES.length];
  }

  private segZ(s: Seg) {
    const total = SEG_N * SEG_L;
    const lo = -(SEG_N - 3) * SEG_L;
    const raw = this.distance - (s.index + 0.5) * SEG_L;
    return ((((raw - lo) % total) + total) % total) + lo;
  }

  private refreshDecor() {
    for (const s of this.segs) {
      const z = this.segZ(s);
      s.group.position.z = z;
      s.lastZ = z;
      this.regenSegment(s, this.decorTheme(z), z);
    }
    this.seedTraffic();
  }

  /* ---------------------------------------------------------------- */
  /* Side traffic: buses, cars and passing trains                      */
  /* ---------------------------------------------------------------- */

  private clearTraffic() {
    for (const v of this.traffic) this.scene.remove(v.mesh);
    this.traffic = [];
  }

  private trafficSpeed(si: number) {
    const spd = speedAt(Math.max(0, this.distance - this.runStart));
    return si === 0 ? spd * 0.46 : -spd * 0.3;
  }

  private makeVehicle(si: number, d: number, th: Theme, vel: number): number {
    const road = th.side === 'road';
    let mesh: THREE.Object3D;
    let len: number;
    if (road) {
      if (Math.random() < 0.55) {
        len = 9;
        mesh = createBus(len, Math.floor(Math.random() * BUS_COLORS.length));
      } else {
        len = 3.9;
        mesh = createCar(Math.floor(Math.random() * CAR_COLORS.length));
      }
    } else {
      len = pick([12, 18]);
      mesh = createTrain(len, Math.floor(Math.random() * TRAIN_COLORS.length), false);
    }
    mesh.rotation.y = vel > 0 ? Math.PI : 0;
    const x = si === 0 ? -6.8 : 6.8;
    mesh.position.set(x, 0, this.distance - d);
    this.scene.add(mesh);
    this.traffic.push({ mesh, d, vel, x, len, kind: road ? 'road' : 'rail' });
    return len;
  }

  private seedTraffic() {
    this.clearTraffic();
    for (let si = 0; si < 2; si++) {
      let dd = this.distance + rnd(8, 30);
      while (dd < this.distance + TRAFFIC_AHEAD - 5) {
        const th = this.decorTheme(this.distance - dd);
        let len = 10;
        if (th.side !== 'none') len = this.makeVehicle(si, dd, th, this.trafficSpeed(si));
        dd += len + 16 + rnd(0, 26);
      }
    }
  }

  private updateTraffic(dt: number, frozen: boolean) {
    const dist = this.distance;
    const tv = this.traffic;
    for (let i = tv.length - 1; i >= 0; i--) {
      const v = tv[i];
      if (!frozen) v.d += v.vel * dt;
      const z = dist - v.d;
      if (z > 30 || z < -320) {
        this.scene.remove(v.mesh);
        tv.splice(i, 1);
        continue;
      }
      v.mesh.visible = this.decorTheme(z).side === v.kind;
      v.mesh.position.z = z;
      v.mesh.scale.y = rise(v.d - dist);
    }
    if (frozen) return;
    const camV = this.phase === 'menu' ? 6 : Math.max(this.speed, 12);
    for (let si = 0; si < 2; si++) {
      this.trafficT[si] -= dt;
      if (this.trafficT[si] > 0) continue;
      const th = this.decorTheme(-TRAFFIC_AHEAD);
      if (th.side === 'none' || tv.length > 18) {
        this.trafficT[si] = 0.7;
        continue;
      }
      const vel = this.trafficSpeed(si);
      const len = this.makeVehicle(si, dist + TRAFFIC_AHEAD, th, vel);
      this.trafficT[si] = (len + 16 + rnd(0, 22)) / Math.max(5, Math.abs(camV - vel));
    }
  }

  private regenSegment(seg: Seg, th: Theme, z: number) {
    const tunnel = th.tunnel;
    const wm = pick(this.wallMats);
    seg.walls.forEach((w) => {
      w.material = wm;
      w.visible = !tunnel;
    });
    seg.lamps.forEach((l) => {
      l.position.z = rnd(-6, 6);
      l.visible = !tunnel;
    });

    // crystal cave shell, mouth portals, lava rivers
    seg.cave.visible = tunnel;
    if (seg.caveDecor) {
      seg.group.remove(seg.caveDecor);
      seg.caveDecor = null;
    }
    if (tunnel) {
      seg.caveDecor = createCaveDecor();
      seg.group.add(seg.caveDecor);
    }
    seg.portals[0].visible = tunnel && !this.decorTheme(z + SEG_L).tunnel;
    seg.portals[1].visible = tunnel && !this.decorTheme(z - SEG_L).tunnel;
    seg.lava.forEach((l) => (l.visible = th.lava));
    seg.roads.forEach((r) => (r.visible = th.side === 'road'));

    // side trains / buses are now live traffic (see updateTraffic)
    seg.trainHolders.forEach((h) => {
      while (h.children.length) h.remove(h.children[0]);
    });

    // buildings
    const showB = th.bld !== 'none' && !tunnel;
    const neon = th.bld === 'neon';
    for (const b of seg.blds) {
      b.mesh.visible = showB;
      if (!showB) continue;
      const s = b.side;
      const w = b.near ? rnd(6, 10) : rnd(12, 18);
      const dep = b.near ? rnd(8, 9.2) : rnd(17, 19);
      const hmul = neon ? 1.3 : 1;
      const h = (b.near ? rnd(8, 26) : rnd(22, 60)) * hmul;
      const x = s * ((b.near ? 11.8 : 26) + w / 2 + rnd(0, 2));
      const z = b.near ? (b.idx === 0 ? -5 : 5) + rnd(-0.5, 0.5) : rnd(-1, 1);
      b.mesh.scale.set(w, h, dep);
      b.mesh.position.set(x, h / 2, z);
      const hue = th.bldHue[0] + Math.random() * (th.bldHue[1] - th.bldHue[0]);
      b.mat.color.setHSL(hue % 1, rnd(th.bldSat[0], th.bldSat[1]), rnd(th.bldLit[0], th.bldLit[1]));
      const m = b.mat.map!;
      m.repeat.set((w + dep) / 2 / 12.8, h / 12.8);
      m.offset.set(Math.random(), Math.random());
    }

    // billboards
    for (let si = 0; si < 2; si++) {
      const old = seg.bbs[si];
      if (old) seg.group.remove(old);
      seg.bbs[si] = null;
      const s = si === 0 ? -1 : 1;
      if (!showB || Math.random() > th.billboard) continue;
      const near = seg.blds.filter((b) => b.side === s && b.near);
      const b = pick(near);
      const bb = createBillboard();
      const hgt = b.mesh.scale.y;
      bb.position.set(b.mesh.position.x - s * (b.mesh.scale.x / 2 + 0.12), clamp(rnd(5, hgt - 2), 4, 14), b.mesh.position.z + rnd(-1.5, 1.5));
      bb.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      seg.group.add(bb);
      seg.bbs[si] = bb;
    }

    // props (trees, rocks, mountains, chimneys...)
    const kinds = Object.entries(th.props) as [PropKind, number][];
    for (let si = 0; si < 2; si++) {
      const s = si === 0 ? -1 : 1;
      const holder = seg.props[si];
      while (holder.children.length) holder.remove(holder.children[0]);
      const bs = seg.blds.filter((b) => b.side === s && b.near && b.mesh.visible);
      const reach = FAR_PROP[th.name] === 'mansion' ? 15.5 : 30;
      if (kinds.length) {
        for (let k = 0; k < 5; k++) {
          if (Math.random() > th.propDensity) continue;
          const kind = weighted(kinds);
          const m = makeProp(kind);
          if (kind === 'chimney' || kind === 'tank') {
            if (th.bld === 'none') {
              m.position.set(s * rnd(14, 30), 0, rnd(-9, 9));
            } else {
              if (!bs.length) continue;
              const b = pick(bs);
              m.scale.multiplyScalar(0.55);
              m.position.set(b.mesh.position.x + rnd(-b.mesh.scale.x * 0.25, b.mesh.scale.x * 0.25), b.mesh.scale.y, b.mesh.position.z + rnd(-1.5, 1.5));
            }
          } else if (th.bld === 'none') {
            m.position.set(s * rnd(10.8, reach), 0, rnd(-9.5, 9.5));
          } else {
            if (kind !== 'round') continue;
            m.position.set(s * rnd(10.3, 11.3), 0, rnd(-9, 9));
          }
          holder.add(m);
        }
      }
      const far = FAR_PROP[th.name];
      if (far === 'mansion') {
        if (Math.random() < 0.45) {
          const m = makeProp(far);
          m.position.set(s * (16 + 6.5 * m.scale.x + rnd(0, 6)), 0, rnd(-2, 2));
          m.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
          holder.add(m);
        }
      } else if (far) {
        for (let k = 0; k < 2; k++) {
          if (Math.random() < 0.85) {
            const m = makeProp(far);
            m.position.set(s * (m.scale.x * (far === 'hill' ? 0.8 : 1) + rnd(18, 40)), 0, rnd(-9, 9));
            holder.add(m);
          }
        }
      }
    }

    // overhead structures
    if (seg.gantry) seg.group.remove(seg.gantry);
    seg.gantry = null;
    seg.bridge.visible = false;
    const r = tunnel ? 1 : Math.random();
    if (r < 0.16) {
      const g = createGantry();
      g.position.z = rnd(-6, 6);
      seg.group.add(g);
      seg.gantry = g;
    } else if (r < 0.23) {
      seg.bridge.visible = true;
    }

    // hanging jungle canopy
    if (seg.canopy) {
      seg.group.remove(seg.canopy);
      seg.canopy = null;
    }
    if (th.canopy > 0 && Math.random() < th.canopy) {
      const c = createCanopy();
      seg.group.add(c);
      seg.canopy = c;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Reset                                                             */
  /* ---------------------------------------------------------------- */

  private clearWorld() {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const c of this.coins) this.scene.remove(c.mesh);
    for (const p of this.pickups) {
      this.scene.remove(p.sprite);
    }
    for (const p of this.pads) this.scene.remove(p.mesh);
    this.obstacles = [];
    this.coins = [];
    this.pickups = [];
    this.pads = [];
  }

  private reset() {
    this.clearWorld();
    this.runStart = this.distance;
    this.startLevel = 1;
    this.level = 1;
    this.runTime = 0;
    this.speed = 0;
    this.slow = 1;
    this.scoreF = 0;
    this.coinCount = 0;
    this.coinStreak = 0;
    this.lane = 0;
    this.laneFrom = 0;
    this.px = 0;
    this.py = 0;
    this.vy = 0;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.rollT = 0;
    this.rollOnLand = false;
    this.jet = 'off';
    this.timers = { magnet: 0, jetpack: 0, sneakers: 0, x2: 0 };
    this.stumbleT = 0;
    this.graceT = 0;
    this.invincT = 0;
    this.hitAnim = 0;
    this.dyingT = 0;
    this.shake = 0;
    this.surgeT = 0;
    this.surgeAmp = 0;
    this.surgeCur = 0;
    this.guardZ = 60;
    this.chasers.visible = false;
    this.openLane = 0;
    this.safeSpawns = 2;
    this.spawnD = this.distance + 70;
    this.nextPickupD = this.distance + 450;
    this.human.jet.visible = false;
  }

  /* ---------------------------------------------------------------- */
  /* Input                                                             */
  /* ---------------------------------------------------------------- */

  private onKey = (e: KeyboardEvent) => {
    const code = e.code;
    if (code === 'KeyP' || code === 'Escape') {
      if (this.phase === 'playing') this.pause();
      else if (this.phase === 'paused') this.resume();
      return;
    }
    if (this.phase !== 'playing') return;
    switch (code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLane(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveLane(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        if (!e.repeat) this.tryJump();
        break;
      case 'ArrowDown':
      case 'KeyS':
        if (!e.repeat) this.tryRoll();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.phase !== 'playing') return;
    this.touch = { x: e.clientX, y: e.clientY, done: false };
  };
  private onPointerMove = (e: PointerEvent) => {
    const t = this.touch;
    if (!t || t.done || this.phase !== 'playing') return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    const TH = 28;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
    t.done = true;
    if (Math.abs(dx) > Math.abs(dy)) this.moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) this.tryJump();
    else this.tryRoll();
  };
  private onPointerUp = () => {
    this.touch = null;
  };
  private onVisibility = () => {
    if (document.hidden) this.pause();
  };

  private moveLane(dir: number) {
    const n = clamp(this.lane + dir, -1, 1);
    if (n === this.lane) return;
    this.laneFrom = this.lane;
    this.lane = n;
    audio.lane();
  }

  private tryJump() {
    if (this.jet !== 'off') return;
    if (this.grounded || this.coyote > 0) {
      this.vy = this.timers.sneakers > 0 ? JUMP_V_HIGH : JUMP_V;
      this.grounded = false;
      this.coyote = 0;
      this.rollT = 0;
      this.rollOnLand = false;
      audio.jump();
      this.particles.emit(this.px, this.py + 0.05, 0, 6, 0xdddddd, 1.6, 0.14, 0.4, 0.8, 4);
    } else {
      this.jumpBuf = 0.14;
    }
  }

  private tryRoll() {
    if (this.jet !== 'off') return;
    if (this.grounded) {
      this.rollT = ROLL_DUR;
      audio.roll();
    } else {
      this.vy = -26;
      this.rollOnLand = true;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Main loop                                                         */
  /* ---------------------------------------------------------------- */

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = (now - this.lastT) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, raw));
    this.lastT = now;
    this.monitorPerf(raw);
    this.tick(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private tick(dt: number) {
    this.time += dt;
    const before = this.distance;
    switch (this.phase) {
      case 'menu':
        this.distance += 6 * dt;
        this.runStart = this.distance;
        this.runPhase += dt * 9;
        this.px = 0;
        this.py = 0;
        this.menuT = Math.min(1, this.menuT + dt * 1.1);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'dying':
        this.updateDying(dt);
        break;
      default:
        break;
    }
    const frozen = this.phase === 'paused' || this.phase === 'over';
    const scrolled = this.distance - before;
    this.particles.update(frozen ? 0 : dt, scrolled);
    this.weather.update(frozen ? 0 : dt, scrolled, this.weatherWanted, this.time);
    this.updateTraffic(dt, frozen);
    setCrossBlink(Math.sin(this.time * 12) > 0);
    this.updateEnv();
    this.updateDecor();
    this.syncWorld();
    this.updateActors(dt);
    this.updateCamera(dt);
  }

  /* ---------------------------------------------------------------- */
  /* Playing                                                           */
  /* ---------------------------------------------------------------- */

  private isInvincible() {
    return this.jet !== 'off' || this.invincT > 0;
  }

  private multiplier() {
    return this.timers.x2 > 0 ? 2 : 1;
  }

  private announce(level: number, start: boolean, bonus: number) {
    const info = levelInfo(level);
    this.ev.onLevel({ level, name: info.name, twist: info.twist, accent: info.accent, bonus, start });
  }

  private levelUp(lv: number) {
    this.level = lv;
    const bonus = 250 * (lv - 1);
    this.scoreF += bonus;
    audio.levelUp();
    this.shake = Math.max(this.shake, 0.25);
    this.surgeT = 2;
    this.surgeAmp = 0.2;
    const col = new THREE.Color(themeOfLevel(lv).accent).getHex();
    this.particles.emit(this.px, this.py + 1.2, 0, 18, col, 6, 0.16, 0.8, 3, 6);
    if (lv > this.maxLevel) {
      this.maxLevel = lv;
      try {
        localStorage.setItem('ms_maxlevel', String(lv));
      } catch {
        /* ignore */
      }
    }
    this.announce(lv, false, bonus);
  }

  private updatePlaying(dt: number) {
    this.runTime += dt;
    const runDist = this.distance - this.runStart;
    const lv = levelAt(runDist);
    if (lv > this.level) this.levelUp(lv);

    // timers
    (['magnet', 'sneakers', 'x2'] as const).forEach((k) => {
      if (this.timers[k] > 0) {
        this.timers[k] = Math.max(0, this.timers[k] - dt);
        if (this.timers[k] === 0) audio.powerEnd();
      }
    });
    if (this.jet === 'fly') {
      this.timers.jetpack = Math.max(0, this.timers.jetpack - dt);
      if (this.timers.jetpack <= 0) this.jet = 'land';
    }
    this.stumbleT = Math.max(0, this.stumbleT - dt);
    this.graceT = Math.max(0, this.graceT - dt);
    this.invincT = Math.max(0, this.invincT - dt);
    this.hitAnim = Math.max(0, this.hitAnim - dt * 2.5);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    if (this.rollT > 0) this.rollT = Math.max(0, this.rollT - dt);

    // speed: smooth, continuous acceleration with distance
    const base = speedAt(runDist);
    this.slow = Math.min(1, this.slow + dt * 0.45);
    const intro = Math.min(1, 0.45 + this.runTime * 0.55);
    this.surgeT = Math.max(0, this.surgeT - dt);
    this.surgeCur += ((this.surgeT > 0 ? this.surgeAmp : 0) - this.surgeCur) * (1 - Math.exp(-dt * 4));
    this.speed = base * this.slow * intro * (1 + this.surgeCur) * (this.jet !== 'off' ? 1.12 : 1);
    const spd = this.speed;
    this.distance += spd * dt;
    this.scoreF += spd * dt * this.multiplier();
    this.runPhase += dt * (6 + spd * 0.28);

    // oncoming trains
    for (const o of this.obstacles) {
      if (o.vel) {
        o.d0 -= o.vel * dt;
        o.d1 -= o.vel * dt;
      }
      if (!o.horn) {
        const rel = o.d0 - this.distance;
        if (o.kind === 'train' && o.vel && rel < 110) {
          o.horn = true;
          audio.horn();
        } else if (o.kind === 'bus' && rel < 90) {
          o.horn = true;
          audio.busHorn();
        } else if (o.kind === 'ghost' && rel < 80) {
          o.horn = true;
          audio.ghostWail();
        }
      }
    }

    this.ensureSpawn();

    // lateral movement
    const tx = this.lane * LANE_W;
    this.px += (tx - this.px) * (1 - Math.exp(-dt * this.laneRate));
    if (Math.abs(tx - this.px) < 0.005) this.px = tx;

    // collisions (before vertical resolution)
    if (!this.isInvincible()) {
      const dEnd = this.distance;
      const dStart = dEnd - spd * dt;
      const n = Math.max(1, Math.ceil((dEnd - dStart) / 0.6));
      for (let i = 1; i <= n; i++) {
        this.distance = dStart + ((dEnd - dStart) * i) / n;
        this.checkCollisions();
        if (this.phase !== 'playing') return;
      }
      this.distance = dEnd;
    }

    this.updateVertical(dt, spd);
    this.updateCoins(dt);
    this.updatePickups();
    this.updatePads();
    this.cleanup();

    // chasers
    if (this.stumbleT > 0) {
      this.chasers.visible = true;
      this.guardZ += (4.2 - this.guardZ) * (1 - Math.exp(-dt * 4));
    } else if (this.chasers.visible) {
      this.guardZ += (40 - this.guardZ) * (1 - Math.exp(-dt * 1.6));
      if (this.guardZ > 30) this.chasers.visible = false;
    }

    // fx
    if (this.jet !== 'off') {
      if (Math.random() < 0.4) this.particles.emit(this.px, this.py + 0.5, 0.6, 1, 0xe8e8e8, 0.8, 0.16, 0.5, -2, 0);
    }
    if (this.timers.sneakers > 0 && this.grounded && Math.random() < 0.5) {
      this.particles.emit(this.px, 0.1, 0.3, 1, 0xffc933, 0.6, 0.12, 0.35, 0.5, 2);
    }

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.08;
      this.emitHud();
    }
  }

  private updateVertical(dt: number, spd: number) {
    const prevPy = this.py;
    const wasGrounded = this.grounded;

    if (this.jet === 'fly') {
      const sup = this.supportAt(this.px, this.distance, 99);
      const ty = Math.max(JET_Y, sup + 1.8);
      this.py += (ty - this.py) * (1 - Math.exp(-dt * 4));
      this.vy = 0;
      this.grounded = false;
      this.rollT = 0;
      return;
    }
    if (this.jet === 'land') {
      const ty = Math.max(
        this.supportAt(this.px, this.distance, 99),
        this.supportAt(this.px, this.distance + spd * 0.55, 99),
      );
      if (this.py > ty) this.py = Math.max(ty, this.py - 9 * dt);
      else this.py = Math.min(ty, this.py + 14 * dt);
      this.vy = 0;
      this.grounded = false;
      if (Math.abs(this.py - ty) < 0.03) {
        this.py = ty;
        this.jet = 'off';
        this.invincT = 1.1;
        this.grounded = true;
        this.human.jet.visible = false;
        this.particles.emit(this.px, this.py + 0.1, 0, 10, 0xdddddd, 2.4, 0.16, 0.5, 1, 4);
      }
      return;
    }

    this.vy -= GRAVITY * dt;
    this.py += this.vy * dt;
    const ground = this.supportAt(this.px, this.distance, prevPy);
    if (this.py <= ground) {
      const impact = -this.vy;
      this.py = ground;
      this.vy = 0;
      this.grounded = true;
      if (!wasGrounded) {
        if (impact > 7) {
          audio.land();
          this.particles.emit(this.px, this.py + 0.05, 0, 8, 0xd8d2c8, 2.2, 0.16, 0.45, 1, 4);
        }
        if (this.rollOnLand) {
          this.rollOnLand = false;
          this.rollT = ROLL_DUR;
          audio.roll();
        }
        if (this.jumpBuf > 0) this.tryJump();
      }
    } else {
      this.grounded = false;
      if (wasGrounded) this.coyote = 0.1;
    }
  }

  /** Highest walkable surface under (x,d) that is reachable from height py. */
  private supportAt(x: number, d: number, py: number): number {
    let h = 0;
    for (let i = 0; i < this.obstacles.length; i++) {
      const o = this.obstacles[i];
      if (o.kind !== 'train' && o.kind !== 'ramp') continue;
      if (d < o.d0 || d > o.d1) continue;
      if (Math.abs(x - o.lane * LANE_W) > 1.15) continue;
      let top: number;
      let tol: number;
      if (o.kind === 'train') {
        top = TRAIN_H;
        tol = 0.45;
      } else {
        top = (TRAIN_H * (d - o.d0)) / (o.d1 - o.d0);
        tol = 0.9;
      }
      if (top <= py + tol && top > h) h = top;
    }
    return h;
  }

  private checkCollisions() {
    const d = this.distance;
    const px = this.px;
    const py = this.py;
    const headY = py + (this.rollT > 0 ? 0.75 : 1.75);
    for (let i = 0; i < this.obstacles.length; i++) {
      const o = this.obstacles[i];
      if (o.hit) continue;
      if (d + 0.35 < o.d0 || d - 0.35 > o.d1) continue;
      const dx = Math.abs(px - o.lane * LANE_W);
      if (o.kind === 'train') {
        if (dx > 1.2 || py >= TRAIN_H - 0.45) continue;
        const front = d - o.d0 < 0.9 && dx < 0.9;
        this.hitObstacle(o, front ? 'front' : 'side');
      } else if (o.kind === 'ramp') {
        if (dx > 1.1) continue;
        const h = TRAIN_H * clamp((d - o.d0) / (o.d1 - o.d0), 0, 1);
        if (py < h - 0.9) this.hitObstacle(o, 'side');
      } else if (o.kind === 'boulder') {
        if (dx > 1.05) continue;
        if (py < 1.15) this.hitObstacle(o, 'barrier');
      } else if (o.kind === 'bus') {
        if (!o.bus) continue;
        if (Math.abs(px - this.busX(o)) > o.bus.half + 0.25) continue;
        if (py < 2.6) this.hitObstacle(o, 'barrier');
      } else if (o.kind === 'ghost') {
        if (dx > 1.0) continue;
        if (headY > 1.15 && py < 2.15) this.hitObstacle(o, 'barrier');
      } else if (o.kind === 'low') {
        if (dx > 1.15) continue;
        if (py < 0.82) this.hitObstacle(o, 'barrier');
      } else {
        if (dx > 1.15) continue;
        if (headY > 1.3 && py < 2.0) this.hitObstacle(o, 'barrier');
      }
      if (this.phase !== 'playing') return;
    }
  }

  private hitObstacle(o: Obstacle, kind: 'front' | 'side' | 'barrier') {
    o.hit = true;
    if (kind === 'front') {
      this.die();
      return;
    }
    if (this.graceT > 0) return;
    if (this.stumbleT > 0) {
      this.die();
      return;
    }
    // first mistake: stumble, the guard gets close
    this.stumbleT = 5;
    this.graceT = 0.6;
    this.slow = 0.55;
    this.shake = 0.55;
    this.hitAnim = 1;
    if (kind === 'side') this.lane = this.laneFrom;
    audio.stumble();
    this.particles.emit(this.px, this.py + 0.9, 0, 14, 0xff5a4a, 3.2, 0.18, 0.5, 1.5, 8);
  }

  private die() {
    if (this.phase !== 'playing') return;
    this.dyingT = 0;
    this.shake = 1;
    this.chasers.visible = true;
    this.guardZ = Math.min(this.guardZ, 6);
    audio.crash();
    audio.stopMusic();
    this.particles.emit(this.px, this.py + 0.9, 0, 30, 0xffe066, 5, 0.2, 0.9, 2, 9);
    this.particles.emit(this.px, this.py + 0.9, 0, 18, 0xffffff, 4, 0.16, 0.7, 2, 9);
    this.setPhase('dying');
    this.emitHud();
  }

  private updateDying(dt: number) {
    this.dyingT += dt;
    this.speed = Math.max(0, this.speed - 55 * dt);
    this.distance += this.speed * dt;
    this.hitAnim = 0;
    if (this.py > 0.01 || this.vy !== 0) {
      this.vy -= GRAVITY * dt;
      const g = this.supportAt(this.px, this.distance, this.py);
      this.py = Math.max(g, this.py + this.vy * dt);
      if (this.py <= g) this.vy = 0;
    }
    this.guardZ += (1.9 - this.guardZ) * (1 - Math.exp(-dt * 5));
    this.runPhase += dt * 6;
    if (this.dyingT > 1.5) this.finish();
  }

  private finish() {
    let best = 0;
    let total = 0;
    try {
      best = Number(localStorage.getItem('ms_best') || 0);
      total = Number(localStorage.getItem('ms_total') || 0);
    } catch {
      /* ignore */
    }
    const score = Math.floor(this.scoreF);
    const newBest = score > best;
    if (newBest) best = score;
    total += this.coinCount;
    this.best = best;
    try {
      localStorage.setItem('ms_best', String(best));
      localStorage.setItem('ms_total', String(total));
    } catch {
      /* ignore */
    }
    this.phase = 'over';
    this.ev.onOver({
      score,
      coins: this.coinCount,
      distance: Math.max(0, Math.floor(this.distance - this.runStart - (this.startLevel - 1) * LEVEL_LEN)),
      best,
      newBest,
      level: this.level,
      levelName: themeOfLevel(this.level).name,
      kmh: Math.round(speedAt(this.distance - this.runStart) * 3.6),
    });
    this.ev.onPhase('over');
  }

  /* ---------------------------------------------------------------- */
  /* Coins & pickups                                                   */
  /* ---------------------------------------------------------------- */

  private updateCoins(dt: number) {
    const px = this.px;
    const cy = this.py + 0.95;
    const d = this.distance;
    const magnet = this.timers.magnet > 0;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      const dz = c.d - d;
      if (magnet && !c.fly && dz > -1 && dz < 11) c.fly = true;
      if (c.fly) {
        const k = 1 - Math.exp(-dt * 11);
        c.d += (d - c.d) * k;
        c.x += (px - c.x) * k;
        c.y += (cy - c.y) * k;
      }
      if (Math.abs(c.d - d) < 0.9 && Math.abs(c.x - px) < 1.0 && Math.abs(c.y - cy) < 1.25) {
        this.collectCoin(c);
        this.scene.remove(c.mesh);
        this.coins.splice(i, 1);
      } else if (dz < -14) {
        this.scene.remove(c.mesh);
        this.coins.splice(i, 1);
      }
    }
  }

  private collectCoin(c: Coin) {
    this.coinCount++;
    this.scoreF += 10 * this.multiplier();
    this.coinStreak = this.time - this.lastCoinT < 0.45 ? this.coinStreak + 1 : 0;
    this.lastCoinT = this.time;
    audio.coin(this.coinStreak);
    this.particles.emit(this.px, c.y, 0, 4, 0xffd23f, 2.2, 0.1, 0.35, 1, 6);
  }

  private updatePickups() {
    const cy = this.py + 0.95;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const dz = p.d - this.distance;
      if (Math.abs(dz) < 1.1 && Math.abs(p.x - this.px) < 1.2 && Math.abs(p.y - cy) < 1.5) {
        this.activate(p.kind);
        this.scene.remove(p.sprite);
        this.pickups.splice(i, 1);
      } else if (dz < -14) {
        this.scene.remove(p.sprite);
        this.pickups.splice(i, 1);
      }
    }
  }

  private activate(kind: IconKind) {
    audio.power();
    this.shake = Math.max(this.shake, 0.12);
    if (kind === 'jetpack') {
      this.jet = 'fly';
      this.timers.jetpack = DUR.jetpack;
      this.rollT = 0;
      this.rollOnLand = false;
      this.vy = 0;
      this.spawnSkyCoins();
    } else {
      this.timers[kind] = DUR[kind];
    }
    const col = new THREE.Color(ICON_COLORS[kind]).getHex();
    this.particles.emit(this.px, this.py + 0.9, 0, 26, col, 4.2, 0.18, 0.7, 1.5, 4);
  }

  private spawnSkyCoins() {
    const spacing = 3.2;
    const total = DUR.jetpack * Math.max(this.speed, BASE_SPEED) * 1.12 - 18;
    const n = Math.max(10, Math.floor(total / spacing));
    const pattern = [0, -1, 0, 1];
    for (let i = 0; i < n; i++) {
      const lane = pattern[Math.floor(i / 9) % 4];
      this.addCoin(this.distance + 20 + i * spacing, lane * LANE_W, JET_Y + 0.95);
    }
  }

  private addCoin(d: number, x: number, y: number) {
    const mesh = new THREE.Mesh(this.coinAssets.geo, this.coinAssets.mats);
    mesh.position.set(x, y, this.distance - d);
    this.scene.add(mesh);
    this.coins.push({ mesh, d, x, y, fly: false });
  }

  private addPickup(kind: IconKind, d: number, lane: number) {
    let tex = this.badgeTex.get(kind);
    if (!tex) {
      tex = new THREE.CanvasTexture(drawBadge(kind, 128));
      tex.colorSpace = THREE.SRGBColorSpace;
      this.badgeTex.set(kind, tex);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(1.6, 1.6, 1);
    const x = lane * LANE_W;
    sprite.position.set(x, 1.3, this.distance - d);
    this.scene.add(sprite);
    this.pickups.push({ kind, sprite, d, x, y: 1.3 });
  }

  /* ---------------------------------------------------------------- */
  /* Level generation                                                  */
  /* ---------------------------------------------------------------- */

  private ensureSpawn() {
    while (this.spawnD < this.distance + SPAWN_AHEAD) this.spawnPattern();
  }

  private addTrain(lane: number, d0: number, len: number, vel = 0) {
    const mesh = createTrain(len, Math.floor(Math.random() * TRAIN_COLORS.length));
    mesh.position.set(lane * LANE_W, 0, this.distance - (d0 + len / 2));
    this.scene.add(mesh);
    this.obstacles.push({ kind: 'train', lane, d0, d1: d0 + len, vel, mesh, hit: false, horn: false });
  }

  private addRamp(lane: number, d0: number) {
    const mesh = createRamp();
    mesh.position.set(lane * LANE_W, 0, this.distance - (d0 + RAMP_LEN / 2));
    this.scene.add(mesh);
    this.obstacles.push({ kind: 'ramp', lane, d0, d1: d0 + RAMP_LEN, vel: 0, mesh, hit: false, horn: false });
  }

  private addBarrier(kind: 'low' | 'high', lane: number, d0: number) {
    const mesh = kind === 'low' ? createLowBarrier() : createHighBarrier();
    mesh.position.set(lane * LANE_W, 0, this.distance - (d0 + 0.4));
    this.scene.add(mesh);
    this.obstacles.push({ kind, lane, d0, d1: d0 + 0.8, vel: 0, mesh, hit: false, horn: false });
  }

  private coinLine(lane: number, d: number, n: number, y = 0.95, spacing = 2.4) {
    for (let i = 0; i < n; i++) this.addCoin(d + i * spacing, lane * LANE_W, y);
  }

  private coinArc(lane: number, dCenter: number, n = 5, spacing = 1.7, peak = 2.1) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const y = 0.95 + (peak - 0.95) * Math.sin(Math.PI * t);
      this.addCoin(dCenter + (i - (n - 1) / 2) * spacing, lane * LANE_W, y);
    }
  }

  private spawnPattern() {
    const d = this.spawnD;
    const runDist = d - this.runStart;
    const L = levelAt(runDist);
    const diff = Math.min(1, runDist / 4500);
    const cand = [-1, 0, 1].filter((l) => Math.abs(l - this.openLane) <= 1);
    const open = pick(cand);
    this.openLane = open;
    const others = [-1, 0, 1].filter((l) => l !== open);
    let end: number;
    let gapMul = 1;

    if (this.safeSpawns > 0) {
      this.safeSpawns--;
      end = this.patCoins(d, open);
    } else {
      const table: [string, number][] = [
        ['coins', L >= 5 ? 0.08 : 0.13],
        ['barriers', 0.32],
        ['trains', 0.3],
      ];
      if (L >= 2) table.push(['ramp', 0.2]);
      if (L >= 4) table.push(['rhythm', 0.16]);
      if (L >= 7) table.push(['gauntlet', 0.15]);
      const lvTheme = themeOfLevel(L);
      if (L >= 6) table.push(['boulders', lvTheme.boulder === 'ghost' ? 0.36 : 0.2]);
      if (L >= 2 && lvTheme.crossing) table.push(['bus', 0.26]);
      const kind = weighted(table);
      switch (kind) {
        case 'coins':
          end = this.patCoins(d, open);
          break;
        case 'barriers':
          end = this.patBarriers(d, open, others, L, diff);
          break;
        case 'ramp':
          end = this.patRamp(d, open, others);
          break;
        case 'rhythm':
          end = this.patRhythm(d, open, runDist);
          break;
        case 'gauntlet':
          end = this.patGauntlet(d, open, others, runDist);
          break;
        case 'boulders':
          end = this.patBoulders(d, open, others, runDist);
          gapMul = 1.25;
          break;
        case 'bus':
          end = this.patBus(d, open);
          gapMul = 1.1;
          break;
        default: {
          const moving = L >= 3 && Math.random() < 0.4;
          end = this.patTrains(d, open, others, L, diff, moving ? speedAt(runDist) * 0.32 + 3 : 0);
          if (moving) gapMul = 1.3;
        }
      }
    }

    if (d > this.nextPickupD && runDist > 150) {
      const kinds: IconKind[] = ['magnet', 'magnet', 'sneakers', 'sneakers', 'x2', 'x2', 'jetpack'];
      this.addPickup(pick(kinds), d + 3, open);
      this.nextPickupD = d + 380 + Math.random() * 420;
    }

    if (L >= 3 && !this.safeSpawns && Math.random() < 0.28) this.addPad(open, d - 10);

    const reaction = 1.7 - 0.75 * diff;
    const gap = Math.max(16, speedAt(runDist) * reaction) * gapMul;
    this.spawnD = end + gap + Math.random() * 5;
  }

  private patCoins(d: number, lane: number): number {
    const n = 8 + Math.floor(Math.random() * 8);
    let l = lane;
    for (let i = 0; i < n; i++) {
      if (i > 0 && i % 6 === 0 && Math.random() < 0.55) l = clamp(l + (Math.random() < 0.5 ? -1 : 1), -1, 1);
      this.addCoin(d + i * 2.4, l * LANE_W, 0.95);
    }
    return d + n * 2.4;
  }

  private patBarriers(d: number, open: number, others: number[], L: number, diff: number): number {
    const kind: 'low' | 'high' = L >= 2 && Math.random() < 0.42 ? 'high' : 'low';
    const lanes = [...others];
    if (Math.random() < 0.18 + diff * 0.3) lanes.push(open);
    for (const l of lanes) {
      this.addBarrier(kind, l, d);
      if (kind === 'low') this.coinArc(l, d + 0.4);
      else this.coinLine(l, d - 3, 4, 0.6, 2);
    }
    if (!lanes.includes(open)) this.coinLine(open, d - 6, 7);
    return d + 1;
  }

  private patTrains(d: number, open: number, others: number[], L: number, diff: number, vel: number): number {
    const lens = L >= 7 ? [12, 18, 24, 30, 36] : [12, 18, 24];
    const two = diff > 0.08 && Math.random() < 0.5;
    const trainLanes = two ? others : [pick(others)];
    let end = d;
    for (const l of trainLanes) {
      const len = pick(lens);
      this.addTrain(l, d, len, vel);
      end = Math.max(end, d + len);
    }
    if (!two) {
      const spare = others.find((l) => !trainLanes.includes(l))!;
      if (Math.random() < 0.7 && !vel) {
        this.addBarrier('low', spare, d + 4);
        this.coinArc(spare, d + 4.4);
        if (end - d > 16) {
          this.addBarrier('low', spare, d + 14);
          this.coinArc(spare, d + 14.4);
        }
      } else if (!vel) {
        this.coinLine(spare, d, Math.floor((end - d) / 2.4));
      }
    }
    if (!vel) this.coinLine(open, d - 2, Math.floor((end - d) / 2.4) + 1);
    else this.coinLine(open, d - 2, 8);
    return end;
  }

  private patRamp(d: number, open: number, others: number[]): number {
    const L = pick(others);
    const T = others.find((l) => l !== L)!;
    const trainLen = 24 + Math.floor(Math.random() * 3) * 6;
    this.addRamp(L, d);
    this.addTrain(L, d + RAMP_LEN, trainLen);
    for (let i = 0; i < 4; i++) {
      const off = 1.2 + i * 2;
      this.addCoin(d + off, L * LANE_W, (TRAIN_H * off) / RAMP_LEN + 0.95);
    }
    const roofN = Math.floor((trainLen - 3) / 2.2);
    for (let i = 0; i < roofN; i++) this.addCoin(d + RAMP_LEN + 1.5 + i * 2.2, L * LANE_W, TRAIN_H + 0.95);

    const mode = Math.random();
    if (mode < 0.45) {
      this.addTrain(T, d + RAMP_LEN, pick([12, 18, 24]));
    } else if (mode < 0.8) {
      this.addBarrier('low', T, d + 7);
      this.coinArc(T, d + 7.4);
      this.addBarrier('low', T, d + 20);
      this.coinArc(T, d + 20.4);
    } else {
      this.coinLine(T, d + 2, 10);
    }
    this.coinLine(open, d, Math.floor((RAMP_LEN + trainLen) / 2.4));
    return d + RAMP_LEN + trainLen;
  }

  /** Rows that span all lanes: jump / roll / jump... timed to the current speed. */
  private patRhythm(d: number, open: number, runDist: number): number {
    const step = clamp(speedAt(runDist) * 0.95, 16, 38);
    const seq: ('low' | 'high')[] = pick([
      ['low', 'low', 'low'],
      ['low', 'high', 'low'],
      ['high', 'low', 'high', 'low'],
      ['low', 'low', 'high'],
    ] as ('low' | 'high')[][]);
    seq.forEach((k, i) => {
      const dd = d + i * step;
      for (const l of [-1, 0, 1]) this.addBarrier(k, l, dd);
      if (k === 'low') this.coinArc(open, dd + 0.4);
      else this.coinLine(open, dd - 3, 4, 0.6, 2);
    });
    return d + (seq.length - 1) * step + 1;
  }

  /** Two long trains block the sides while the open lane is a barrier course. */
  private patGauntlet(d: number, open: number, others: number[], runDist: number): number {
    const step = clamp(speedAt(runDist) * 0.95, 16, 36);
    const seq: ('low' | 'high')[] = pick([
      ['low', 'high', 'low'],
      ['high', 'low', 'high'],
      ['low', 'low', 'high'],
    ] as ('low' | 'high')[][]);
    const start = 8;
    const len = Math.round(start + (seq.length - 1) * step + 8);
    for (const l of others) this.addTrain(l, d, len);
    seq.forEach((k, i) => {
      const dd = d + start + i * step;
      this.addBarrier(k, open, dd);
      if (k === 'low') this.coinArc(open, dd + 0.4);
      else this.coinLine(open, dd - 3, 4, 0.6, 2);
    });
    return d + len;
  }

  private patBoulders(d: number, open: number, others: number[], runDist: number): number {
    const skin = themeOfLevel(levelAt(runDist)).boulder;
    const vel = speedAt(runDist) * 0.25 + 4;
    const lanes = Math.random() < 0.4 ? others : [pick(others)];
    const rows = Math.random() < 0.5 ? 2 : 1;
    let end = d;
    for (let r = 0; r < rows; r++) {
      const dd = d + r * 16;
      for (const l of lanes) {
        if (skin === 'ghost') this.addGhost(l, dd, vel);
        else this.addBoulder(l, dd, vel, skin);
      }
      end = dd + 2;
    }
    this.coinLine(open, d - 4, 10);
    return end;
  }

  private addBoulder(lane: number, d0: number, vel: number, skin: 'rock' | 'moss' | 'fire') {
    const { group, roll } = createBoulder(skin);
    group.position.set(lane * LANE_W, 0, this.distance - (d0 + 0.8));
    this.scene.add(group);
    this.obstacles.push({ kind: 'boulder', lane, d0, d1: d0 + 1.6, vel, mesh: group, hit: false, horn: false, roll });
  }

  private addGhost(lane: number, d0: number, vel: number) {
    const { group, body } = createGhost();
    group.position.set(lane * LANE_W, 0, this.distance - (d0 + 0.6));
    this.scene.add(group);
    this.obstacles.push({ kind: 'ghost', lane, d0, d1: d0 + 1.2, vel, mesh: group, hit: false, horn: false, roll: body });
  }

  /** Lateral position of a crossing bus: it is a function of the runner's progress, so it is always fair. */
  private busX(o: Obstacle) {
    const b = o.bus!;
    return b.xc - b.dir * b.k * ((o.d0 + o.d1) / 2 - this.distance);
  }

  private addBusCrossing(dc: number, xc: number, dir: number, gates: boolean) {
    const { group, bus } = createBusCrossing(Math.floor(Math.random() * BUS_COLORS.length), xc, dir, gates);
    group.position.z = this.distance - dc;
    this.scene.add(group);
    this.obstacles.push({
      kind: 'bus',
      lane: 0,
      d0: dc - 1.35,
      d1: dc + 1.35,
      vel: 0,
      mesh: group,
      hit: false,
      horn: false,
      bus: { obj: bus, xc, dir, k: BUS_K, half: BUS_LEN / 2 },
    });
  }

  private patBus(d: number, open: number): number {
    const dc = d + 4;
    if (open === 0) {
      if (Math.random() < 0.4) {
        // squeeze: one bus from each side, only the middle lane is free
        this.addBusCrossing(dc, -5.4, 1, true);
        this.addBusCrossing(dc, 5.4, -1, false);
      } else {
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.addBusCrossing(dc, -dir * 5.4, dir, true);
      }
    } else {
      const dir = open > 0 ? 1 : -1;
      const wide = Math.random() < 0.6;
      this.addBusCrossing(dc, -dir * (wide ? 3.0 : 5.4), dir, true);
    }
    this.coinLine(open, dc - 16, 12);
    return dc + 2;
  }

  private addPad(lane: number, d: number) {
    const mesh = createPad();
    mesh.position.set(lane * LANE_W, 0.05, this.distance - d);
    this.scene.add(mesh);
    this.pads.push({ mesh, d, x: lane * LANE_W, used: false });
  }

  private updatePads() {
    for (let i = this.pads.length - 1; i >= 0; i--) {
      const p = this.pads[i];
      const dz = p.d - this.distance;
      if (!p.used && Math.abs(dz) < 1.7 && Math.abs(p.x - this.px) < 1.1 && this.py < 1.0) {
        p.used = true;
        this.surgeT = 2.6;
        this.surgeAmp = 0.32;
        this.scoreF += 25 * this.multiplier();
        this.shake = Math.max(this.shake, 0.15);
        audio.boost();
        this.particles.emit(this.px, 0.3, 0, 18, 0x7ad8ff, 5, 0.14, 0.6, 1.0, 2);
      }
      if (dz < -14) {
        this.scene.remove(p.mesh);
        this.pads.splice(i, 1);
      }
    }
  }

  private cleanup() {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      if (this.obstacles[i].d1 < this.distance - 16) {
        this.scene.remove(this.obstacles[i].mesh);
        this.obstacles.splice(i, 1);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Visual updates                                                    */
  /* ---------------------------------------------------------------- */

  private syncWorld() {
    const d = this.distance;
    for (const o of this.obstacles) {
      const z = d - (o.d0 + o.d1) / 2;
      o.mesh.position.z = z;
      o.mesh.scale.y = rise(-z);
      if (o.bus) o.bus.obj.position.x = this.busX(o);
      if (o.roll) {
        if (o.kind === 'ghost') {
          o.roll.position.y = 2.0 + Math.sin(this.time * 3 + o.d0) * 0.14;
          o.roll.rotation.z = Math.sin(this.time * 2 + o.d0) * 0.12;
        } else o.roll.rotation.x = z / 0.8;
      }
    }
    for (const p of this.pads) p.mesh.position.z = d - p.d;
    const spin = this.time * 3.2;
    for (const c of this.coins) {
      c.mesh.position.set(c.x, c.y, d - c.d);
      c.mesh.rotation.y = spin;
    }
    for (const p of this.pickups) {
      p.sprite.position.set(p.x, p.y + Math.sin(this.time * 3 + p.d) * 0.18, d - p.d);
    }
  }

  private updateActors(dt: number) {
    const h = this.human;
    h.root.position.set(this.px, this.py, 0);
    const lean = clamp((this.px - this.lane * LANE_W) * 0.16, -0.4, 0.4);
    const dead = this.phase === 'dying' || this.phase === 'over' ? clamp(this.dyingT * 3.2, 0, 1) : 0;
    poseHuman(h, {
      phase: this.runPhase,
      air: !this.grounded && this.jet === 'off',
      roll: this.rollT > 0 ? 1 - this.rollT / ROLL_DUR : -1,
      lean,
      jet: this.jet !== 'off',
      dead,
      hit: this.hitAnim,
    });
    h.jet.visible = this.jet !== 'off';
    if (h.jet.visible) {
      for (const f of h.flames) f.scale.set(1, 0.7 + Math.random() * 0.7, 1);
    }

    // blob shadow (low quality only)
    if (this.shadow.visible) {
      const g = this.supportAt(this.px, this.distance, 99);
      const hgt = Math.max(0, this.py - g);
      this.shadow.position.set(this.px, g + 0.04, 0);
      this.shadow.scale.setScalar(1 / (1 + hgt * 0.22));
      (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.35 / (1 + hgt * 0.15);
    }


    // chasers
    if (this.chasers.visible) {
      this.guardX += (this.px - this.guardX) * (1 - Math.exp(-dt * 4));
      this.chasers.position.set(this.guardX, 0, this.guardZ);
      const gp = this.runPhase * 0.95;
      poseHuman(this.guard, { phase: gp, air: false, roll: -1, lean: 0, jet: false, dead: 0, hit: 0 });
      poseDog(this.dog, gp * 1.3 + 1);
    }
  }

  private updateCamera(dt: number) {
    const tp = this.tmpP;
    const tl = this.tmpL;
    let rate = 6;
    if (this.phase === 'menu') {
      rate = 2.6;
      if (this.aspect < 1) {
        tp.set(2.4, 2.2, 6.6);
        tl.set(0, 0.5, 0);
      } else {
        tp.set(2.7, 2.1, 5.2);
        tl.set(-1.7, 1.3, 0);
      }
    } else {
      const { z, y } = this.camCfg;
      const jetUp = this.jet !== 'off' ? 0.35 : 0.2;
      tp.set(this.px * 0.55, y + this.py * jetUp, z);
      tl.set(this.px * 0.4, 1.5 + this.py * 0.35, -10);
    }
    const k = 1 - Math.exp(-dt * rate);
    this.camPos.lerp(tp, k);
    this.camLook.lerp(tl, k);

    this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * this.shake * 0.7;
    this.camera.position.copy(this.camPos);
    if (this.phase === 'playing' && this.grounded) {
      this.camera.position.y += Math.sin(this.runPhase * 2) * 0.035;
    }
    if (s > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camLook);
    const rollTarget = this.phase === 'playing' ? clamp((this.px - this.lane * LANE_W) * 0.018, -0.05, 0.05) : 0;
    this.camRoll += (rollTarget - this.camRoll) * (1 - Math.exp(-dt * 8));
    this.camera.rotateZ(this.camRoll);

    const sp = this.phase === 'playing' ? clamp((this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED), 0, 1) : 0;
    const fov = this.phase === 'menu' ? 50 : this.camCfg.fov + sp * 3 + (this.jet !== 'off' ? 2 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 4));
      this.camera.updateProjectionMatrix();
    }
    this.skyGroup.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.cloudGroup.rotation.y += dt * 0.004;
  }

  private updateDecor() {
    const total = SEG_N * SEG_L;
    const lo = -(SEG_N - 3) * SEG_L;
    for (const s of this.segs) {
      const z = this.segZ(s);
      if (z < s.lastZ - total * 0.5) this.regenSegment(s, this.decorTheme(z), z);
      s.lastZ = z;
      s.group.position.z = z;
      const k = clamp((z - lo) / 50, 0, 1);
      s.group.scale.y = Math.max(0.001, k * k * (3 - 2 * k));
    }
    for (const sc of this.scrollers) {
      const off = (this.distance / sc.period) % 1;
      for (const t of sc.tex) t.offset.y = off;
    }
  }

  private updateEnv() {
    if (this.phase === 'menu') {
      this.applyBlend(THEMES[this.menuFrom], THEMES[this.menuTo], smooth(this.menuT));
      return;
    }
    const t = Math.max(0, this.distance - this.runStart) / LEVEL_LEN;
    const i = Math.floor(t);
    const f = smooth((t - i - 0.8) / 0.2);
    this.applyBlend(THEMES[i % THEMES.length], THEMES[(i + 1) % THEMES.length], f);
  }

  private applyBlend(A: Theme, B: Theme, f: number) {
    const L = (a: number, b: number) => a + (b - a) * f;
    this.uTop.value.copy(A.top).lerp(B.top, f);
    this.uBottom.value.copy(A.bottom).lerp(B.bottom, f);
    this.hemi.color.copy(A.hemiSky).lerp(B.hemiSky, f);
    this.hemi.groundColor.copy(A.hemiGround).lerp(B.hemiGround, f);
    this.hemi.intensity = L(A.hemiI, B.hemiI);
    this.sunLight.color.copy(A.sun).lerp(B.sun, f);
    this.sunLight.intensity = L(A.sunI, B.sunI);
    (this.sunMesh.material as THREE.MeshBasicMaterial).color.copy(A.sunCol).lerp(B.sunCol, f);
    this.sunMesh.position.y = L(A.sunY, B.sunY);
    this.night = L(A.stars, B.stars);
    (this.stars.material as THREE.PointsMaterial).opacity = this.night;
    this.cloudMat.color.copy(this.uBottom.value).lerp(this.tmpC.set(0xffffff), 0.55 * (1 - this.night * 0.8));
    this.groundMat.color.copy(A.ground).lerp(B.ground, f);
    for (const m of this.trackMats) m.color.copy(A.ballast).lerp(B.ballast, f);
    for (const m of this.wallMats) m.color.copy(A.wall).lerp(B.wall, f);

    const nearB = f > 0.5;
    this.weatherWanted = nearB ? B.weather : A.weather;
    this.laneRate = nearB ? B.laneRate : A.laneRate;
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    if (this.aspect < 1) this.camCfg = { fov: 76, z: 11.2, y: 6.6 };
    else if (this.aspect < 1.4) this.camCfg = { fov: 66, z: 9.4, y: 5.7 };
    else this.camCfg = { fov: 62, z: 8.4, y: 5.3 };
    this.camera.updateProjectionMatrix();
  }

  private emitHud() {
    const t = this.timers;
    const th = themeOfLevel(this.level);
    const runDist = Math.max(0, this.distance - this.runStart);
    this.ev.onHud({
      score: Math.floor(this.scoreF),
      coins: this.coinCount,
      best: this.best,
      speed: this.speed,
      kmh: Math.round(this.speed * 3.6),
      mult: this.multiplier(),
      timers: {
        magnet: t.magnet / DUR.magnet,
        jetpack: t.jetpack / DUR.jetpack,
        sneakers: t.sneakers / DUR.sneakers,
        x2: t.x2 / DUR.x2,
      },
      stumble: this.stumbleT > 0,
      level: this.level,
      levelProgress: (runDist % LEVEL_LEN) / LEVEL_LEN,
      theme: th.name,
      accent: th.accent,
    });
  }
}
