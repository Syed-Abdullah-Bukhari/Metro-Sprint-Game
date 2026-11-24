import * as THREE from 'three';

const C = (s: string) => new THREE.Color(s);

export type PropKind =
  | 'pine'
  | 'pineSnow'
  | 'round'
  | 'cactus'
  | 'rock'
  | 'chimney'
  | 'tank'
  | 'mountain'
  | 'mesa'
  | 'hill'
  | 'palm'
  | 'jungle'
  | 'fern'
  | 'ruin'
  | 'volcano'
  | 'deadTree'
  | 'lavaRock'
  | 'mansion'
  | 'tomb';
/** Only plain, non-glowing weather: no fog, no sparks, no glowing particles. */
export type WeatherKind = 'none' | 'snow' | 'rain' | 'dust' | 'leaves';
export type BldMode = 'city' | 'neon' | 'none';
export type BoulderSkin = 'rock' | 'moss' | 'fire' | 'ghost';
/** What drives past on the two side strips: buses and cars, trains, or nothing. */
export type SideKind = 'road' | 'rail' | 'none';

export interface Theme {
  name: string;
  twist: string;
  accent: string;
  // sky + light (everything is evenly lit so the track is always easy to read)
  top: THREE.Color;
  bottom: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiI: number;
  sun: THREE.Color;
  sunI: number;
  sunCol: THREE.Color;
  sunY: number;
  stars: number; // 0..1, purely decorative stars in the sky
  // ground tints (multiplied with light textures)
  ground: THREE.Color;
  ballast: THREE.Color;
  wall: THREE.Color;
  // decor
  bld: BldMode;
  bldHue: [number, number];
  bldSat: [number, number];
  bldLit: [number, number];
  billboard: number; // probability per side per segment
  props: Partial<Record<PropKind, number>>;
  propDensity: number;
  weather: WeatherKind;
  laneRate: number;
  // special worlds
  tunnel: boolean; // enclosed cave
  lava: boolean; // lava rivers beside the track
  canopy: number; // chance of hanging jungle canopy per segment
  boulder: BoulderSkin;
  side: SideKind; // moving traffic on the side strips
  crossing: boolean; // buses cross the tracks
}

const D = {
  tunnel: false,
  lava: false,
  canopy: 0,
  boulder: 'rock' as BoulderSkin,
  side: 'road' as SideKind,
  crossing: false,
};

export const THEMES: Theme[] = [
  {
    ...D,
    name: 'Sunny Downtown',
    twist: 'Trains, barriers and coins. Buses roll down the street!',
    accent: '#ffd23f',
    top: C('#2f8fe8'), bottom: C('#cdeeff'), hemiSky: C('#ffffff'), hemiGround: C('#8a92a3'),
    hemiI: 1.0, sun: C('#fff4dc'), sunI: 2.0, sunCol: C('#fff6c8'), sunY: 95, stars: 0,
    ground: C('#5e5e5e'), ballast: C('#a4a4a4'), wall: C('#ffffff'),
    bld: 'city', bldHue: [0, 1], bldSat: [0.12, 0.38], bldLit: [0.55, 0.74], billboard: 0.2,
    props: { round: 1 }, propDensity: 0.3, weather: 'none', laneRate: 15,
    crossing: true,
  },
  {
    ...D,
    name: 'Golden Hour',
    twist: 'Buses cross the tracks! Wait for a gap. Roll under overhead bars.',
    accent: '#ff9d5c',
    top: C('#6a5aa8'), bottom: C('#ffc09a'), hemiSky: C('#ffe0c8'), hemiGround: C('#7a6a80'),
    hemiI: 1.0, sun: C('#ffb070'), sunI: 2.2, sunCol: C('#ff9a5a'), sunY: 30, stars: 0,
    ground: C('#6e5e50'), ballast: C('#b49c88'), wall: C('#ffe2cc'),
    bld: 'city', bldHue: [0.0, 0.14], bldSat: [0.3, 0.5], bldLit: [0.5, 0.7], billboard: 0.3,
    props: { round: 1 }, propDensity: 0.3, weather: 'none', laneRate: 15,
    crossing: true,
  },
  {
    ...D,
    name: 'Crystal Cave',
    twist: 'Underground! Oncoming trains thunder through the cave.',
    accent: '#5ef0ff',
    top: C('#222840'), bottom: C('#3a4262'), hemiSky: C('#c0cbf0'), hemiGround: C('#5e5e78'),
    hemiI: 1.15, sun: C('#dfe6ff'), sunI: 1.5, sunCol: C('#cfd6ff'), sunY: 120, stars: 0,
    ground: C('#5c5a6a'), ballast: C('#a8a4b6'), wall: C('#8a8a9c'),
    bld: 'none', bldHue: [0.55, 0.62], bldSat: [0.1, 0.2], bldLit: [0.3, 0.4], billboard: 0,
    props: {}, propDensity: 0, weather: 'none', laneRate: 15,
    tunnel: true, side: 'none',
  },
  {
    ...D,
    name: 'Neon Rain',
    twist: 'Rainy streets: buses cross the tracks, trains come head-on!',
    accent: '#38e1ff',
    top: C('#1d2b66'), bottom: C('#5468b0'), hemiSky: C('#a8b8f0'), hemiGround: C('#3a4066'),
    hemiI: 1.05, sun: C('#b8c4ff'), sunI: 1.6, sunCol: C('#dfe6ff'), sunY: 110, stars: 0.35,
    ground: C('#5a5e78'), ballast: C('#9ca2c4'), wall: C('#9aa0d0'),
    bld: 'neon', bldHue: [0.5, 0.92], bldSat: [0.35, 0.65], bldLit: [0.36, 0.5], billboard: 0.7,
    props: {}, propDensity: 0, weather: 'rain', laneRate: 15,
    crossing: true,
  },
  {
    ...D,
    name: 'Frosty Peaks',
    twist: 'Snowfall! Icy rails make lane changes slide. Grab the boost pads!',
    accent: '#9fe8ff',
    top: C('#4f9fe0'), bottom: C('#eaf5ff'), hemiSky: C('#f2f8ff'), hemiGround: C('#9fb4cc'),
    hemiI: 1.0, sun: C('#fff8ee'), sunI: 1.7, sunCol: C('#fffbe0'), sunY: 80, stars: 0,
    ground: C('#d4dfeb'), ballast: C('#e2e9f2'), wall: C('#d6e4f2'),
    bld: 'none', bldHue: [0.55, 0.62], bldSat: [0.1, 0.2], bldLit: [0.6, 0.8], billboard: 0,
    props: { pineSnow: 1 }, propDensity: 0.85, weather: 'snow', laneRate: 10, side: 'rail',
  },
  {
    ...D,
    name: 'Pine Forest',
    twist: 'Deep pine forest with falling leaves. Trains pass on the next track!',
    accent: '#7be495',
    top: C('#5f9fc8'), bottom: C('#cfe8dc'), hemiSky: C('#e6f6ee'), hemiGround: C('#4f6e50'),
    hemiI: 1.0, sun: C('#fff4d0'), sunI: 1.9, sunCol: C('#fff6d0'), sunY: 70, stars: 0,
    ground: C('#4a6e3c'), ballast: C('#a8b898'), wall: C('#8aa890'),
    bld: 'none', bldHue: [0.3, 0.4], bldSat: [0.2, 0.3], bldLit: [0.4, 0.5], billboard: 0,
    props: { pine: 1.6, round: 0.6, rock: 0.4 }, propDensity: 1, weather: 'leaves', laneRate: 15, side: 'rail',
  },
  {
    ...D,
    name: 'Jungle Ruins',
    twist: 'Rolling boulders! Jump them. Vines hang overhead.',
    accent: '#9bff6a',
    top: C('#2f8f6a'), bottom: C('#a8d8b0'), hemiSky: C('#e0ffe0'), hemiGround: C('#2c4a2c'),
    hemiI: 1.0, sun: C('#fff2c0'), sunI: 1.9, sunCol: C('#fff0b0'), sunY: 70, stars: 0,
    ground: C('#3a6a30'), ballast: C('#8a9a70'), wall: C('#7a9a70'),
    bld: 'none', bldHue: [0.3, 0.4], bldSat: [0.2, 0.3], bldLit: [0.4, 0.5], billboard: 0,
    props: { palm: 1.1, jungle: 1.5, fern: 1.4, ruin: 0.4 }, propDensity: 1, weather: 'none', laneRate: 15,
    canopy: 0.3, boulder: 'moss', side: 'none',
  },
  {
    ...D,
    name: 'Desert Express',
    twist: 'Dusty desert! Buses cross the road. Rhythm rows ahead!',
    accent: '#ffb347',
    top: C('#3b90d9'), bottom: C('#ffdcaa'), hemiSky: C('#fff0d8'), hemiGround: C('#a0805a'),
    hemiI: 1.05, sun: C('#fff0cc'), sunI: 2.4, sunCol: C('#fff2b0'), sunY: 105, stars: 0,
    ground: C('#c28f55'), ballast: C('#e8c9a0'), wall: C('#e0b88a'),
    bld: 'none', bldHue: [0.05, 0.1], bldSat: [0.3, 0.4], bldLit: [0.5, 0.6], billboard: 0,
    props: { cactus: 1, rock: 1.2 }, propDensity: 0.55, weather: 'dust', laneRate: 15,
    crossing: true,
  },
  {
    ...D,
    name: 'Haunted Manor',
    twist: 'Ghosts drift down the tracks: roll under them!',
    accent: '#a98bff',
    top: C('#232a52'), bottom: C('#7a88b0'), hemiSky: C('#b4c2f2'), hemiGround: C('#3e4658'),
    hemiI: 1.0, sun: C('#c8d2ff'), sunI: 1.7, sunCol: C('#e4ecff'), sunY: 85, stars: 0.6,
    ground: C('#44564a'), ballast: C('#9490aa'), wall: C('#7a7690'),
    bld: 'none', bldHue: [0.7, 0.8], bldSat: [0.2, 0.3], bldLit: [0.3, 0.4], billboard: 0,
    props: { tomb: 1.4, deadTree: 1.0 }, propDensity: 0.9, weather: 'none', laneRate: 15,
    boulder: 'ghost', side: 'none',
  },
  {
    ...D,
    name: 'Magma Rush',
    twist: 'Fireballs roll down the tracks! Jump or dodge.',
    accent: '#ff7a2a',
    top: C('#4a1210'), bottom: C('#d8602c'), hemiSky: C('#ffb080'), hemiGround: C('#4a2a24'),
    hemiI: 1.0, sun: C('#ffa060'), sunI: 1.8, sunCol: C('#ff7a40'), sunY: 45, stars: 0,
    ground: C('#5a3a30'), ballast: C('#a48272'), wall: C('#8a5a48'),
    bld: 'none', bldHue: [0.02, 0.05], bldSat: [0.3, 0.4], bldLit: [0.2, 0.3], billboard: 0,
    props: { deadTree: 0.8, lavaRock: 1.3 }, propDensity: 0.75, weather: 'none', laneRate: 15,
    lava: true, boulder: 'fire', side: 'rail',
  },
  {
    ...D,
    name: 'Industrial Dusk',
    twist: 'Long gauntlets of trains and barriers. Stay sharp!',
    accent: '#ff6b3d',
    top: C('#3c3070'), bottom: C('#ff9a6c'), hemiSky: C('#ffc4a0'), hemiGround: C('#4f3a62'),
    hemiI: 1.0, sun: C('#ff9a5a'), sunI: 2.2, sunCol: C('#ff7a3a'), sunY: 26, stars: 0.1,
    ground: C('#54464c'), ballast: C('#a89098'), wall: C('#9a7a78'),
    bld: 'city', bldHue: [0.02, 0.1], bldSat: [0.08, 0.2], bldLit: [0.4, 0.55], billboard: 0.3,
    props: { chimney: 0.5, tank: 0.5, rock: 0.6 }, propDensity: 0.35, weather: 'none', laneRate: 15, side: 'rail',
  },
  {
    ...D,
    name: 'Cyber Void',
    twist: 'Maximum chaos. Buses, trains, everything. How far can you go?',
    accent: '#ff3df2',
    top: C('#1c0a46'), bottom: C('#6a30b0'), hemiSky: C('#c8a0ff'), hemiGround: C('#40306a'),
    hemiI: 1.05, sun: C('#e0b0ff'), sunI: 1.6, sunCol: C('#ffb0f4'), sunY: 70, stars: 0.5,
    ground: C('#4c4268'), ballast: C('#9484c8'), wall: C('#8a6ac0'),
    bld: 'neon', bldHue: [0.76, 0.96], bldSat: [0.6, 0.9], bldLit: [0.4, 0.55], billboard: 0.8,
    props: {}, propDensity: 0, weather: 'none', laneRate: 15,
    crossing: true,
  },
];

/** A new level (new world, new hazards) every LEVEL_LEN metres. */
export const LEVEL_LEN = 600;
export const BASE_SPEED = 18;
export const MAX_SPEED = 56;
const TAU = 2800;

/** Speed climbs quickly at first (about +8 u/s per level) and then eases towards MAX_SPEED. */
export const speedAt = (runDist: number) => MAX_SPEED - (MAX_SPEED - BASE_SPEED) * Math.exp(-Math.max(0, runDist) / TAU);
export const levelAt = (runDist: number) => Math.floor(Math.max(0, runDist) / LEVEL_LEN) + 1;
export const themeOfLevel = (level: number) => THEMES[(level - 1) % THEMES.length];
