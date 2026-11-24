import * as THREE from 'three';
import type { WeatherKind } from './themes';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ */
/* Weather: plain snow / rain / dust / leaves. Nothing glows, nothing  */
/* flies close to the camera, so the track always stays readable.      */
/* ------------------------------------------------------------------ */

const WN = 520;
const CAP: Record<WeatherKind, number> = { none: 0, snow: 480, rain: 320, dust: 170, leaves: 100 };
const WCOL: Record<WeatherKind, [number, number, number, number]> = {
  none: [1, 1, 1, 0],
  snow: [0.96, 0.98, 1.0, 0.9],
  rain: [0.62, 0.76, 0.95, 0.42],
  dust: [0.9, 0.74, 0.5, 0.28],
  leaves: [0.95, 0.55, 0.15, 0.9],
};
const Z_NEAR = 2;
const Z_FAR = -58;

export class Weather {
  readonly mesh: THREE.InstancedMesh;
  private pos = new Float32Array(WN * 3);
  private seed = new Float32Array(WN);
  private dummy = new THREE.Object3D();
  private col = new THREE.Color();
  private mode: WeatherKind = 'none';
  private amount = 0;

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, WN);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    for (let i = 0; i < WN; i++) {
      this.pos[i * 3] = rnd(-17, 17);
      this.pos[i * 3 + 1] = rnd(0, 15);
      this.pos[i * 3 + 2] = rnd(Z_FAR, Z_NEAR);
      this.seed[i] = Math.random();
      this.mesh.setColorAt(i, this.col.set(0xffffff));
    }
  }

  private setMode(m: WeatherKind) {
    this.mode = m;
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    const c = WCOL[m];
    for (let i = 0; i < WN; i++) this.mesh.setColorAt(i, this.col.setRGB(c[0], c[1], c[2]));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    mat.opacity = c[3];
  }

  update(dt: number, scroll: number, wanted: WeatherKind, time: number) {
    if (wanted !== this.mode) {
      this.amount = Math.max(0, this.amount - dt * 0.9);
      if (this.amount === 0) this.setMode(wanted);
    } else {
      this.amount = Math.min(1, this.amount + dt * 0.5);
    }
    if (this.mode === 'none' || this.amount <= 0) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    const show = Math.floor(CAP[this.mode] * this.amount);
    const d = this.dummy;
    for (let i = 0; i < WN; i++) {
      d.rotation.set(0, 0, 0);
      if (i >= show) {
        d.scale.set(0, 0, 0);
        d.position.set(0, -50, 0);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        continue;
      }
      let x = this.pos[i * 3];
      let y = this.pos[i * 3 + 1];
      let z = this.pos[i * 3 + 2] + scroll;
      const s = this.seed[i];
      switch (this.mode) {
        case 'snow':
          y -= (2.0 + s * 1.8) * dt;
          x += (1.3 + Math.sin(time * 0.8 + s * 20) * 0.55) * dt;
          d.scale.set(0.09, 0.09, 0.09);
          break;
        case 'rain':
          y -= (24 + s * 8) * dt;
          d.scale.set(0.014, 0.65, 0.014);
          break;
        case 'dust':
          x += (4 + s * 3) * dt;
          y += Math.sin(time * 0.9 + s * 10) * 0.35 * dt;
          d.scale.set(0.12, 0.05, 0.34);
          break;
        case 'leaves':
          y -= (0.9 + s * 0.7) * dt;
          x += (Math.sin(time * 1.6 + s * 30) * 1.2 + 0.8) * dt;
          d.scale.set(0.17, 0.03, 0.12);
          d.rotation.set(time * 2 + s * 10, time * 1.5 + s * 5, 0);
          break;
        default:
          break;
      }
      if (z > Z_NEAR) z -= Z_NEAR - Z_FAR;
      if (x > 17) x -= 34;
      else if (x < -17) x += 34;
      if (y < 0) y += 15;
      else if (y > 15) y -= 15;
      if (this.mode === 'dust') y = Math.min(7, Math.max(0.2, y));
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      d.position.set(x, y, z);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
