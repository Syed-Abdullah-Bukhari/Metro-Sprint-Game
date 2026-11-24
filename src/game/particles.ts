import * as THREE from 'three';

/** A small pool of cube particles rendered with a single InstancedMesh. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private N: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private grav: Float32Array;
  private cursor = 0;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  constructor(N = 260) {
    this.N = N;
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.maxLife = new Float32Array(N).fill(1);
    this.size = new Float32Array(N);
    this.grav = new Float32Array(N);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < N; i++) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.set(0xffffff));
    }
  }

  emit(
    x: number,
    y: number,
    z: number,
    n: number,
    hex: number,
    speed: number,
    size: number,
    life: number,
    up = 0,
    grav = 9,
  ) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.N;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.2;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.2;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - e * e);
      const sp = speed * (0.35 + Math.random() * 0.65);
      this.vel[i * 3] = Math.cos(a) * r * sp;
      this.vel[i * 3 + 1] = e * sp + up;
      this.vel[i * 3 + 2] = Math.sin(a) * r * sp;
      this.life[i] = life * (0.6 + Math.random() * 0.4);
      this.maxLife[i] = this.life[i];
      this.size[i] = size * (0.6 + Math.random() * 0.6);
      this.grav[i] = grav;
      this.mesh.setColorAt(i, this.color.set(hex));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** `scroll` is how far the world moved toward the camera this frame. */
  update(dt: number, scroll: number) {
    const d = this.dummy;
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        d.scale.set(0, 0, 0);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt + scroll;
      if (this.pos[i * 3 + 1] < 0.02) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3 + 1] *= -0.3;
      }
      const f = this.life[i] / this.maxLife[i];
      d.position.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      d.scale.setScalar(this.size[i] * Math.min(1, f * 1.6));
      d.rotation.set(f * 6, f * 4, 0);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
