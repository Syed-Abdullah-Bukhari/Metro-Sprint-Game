/* Tiny WebAudio synth: sound effects + a looping chiptune-ish beat. No audio files needed. */

const ROOTS = [110, 87.31, 130.81, 98];
const CHORDS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [261.63, 329.63, 392],
  [196, 246.94, 293.66],
];
const ARP = [0, 1, 2, 1, 2, 1, 0, 1];
const BASS_STEPS = [0, 3, 6, 8, 11, 14];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noiseBuf!: AudioBuffer;
  muted = false;
  private timer: number | null = null;
  private nextT = 0;
  private step = 0;
  private bpm = 132;

  constructor() {
    try {
      this.muted = localStorage.getItem('ms_muted') === '1';
    } catch {
      /* ignore */
    }
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(ctx.destination);
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.75;
      this.sfx.connect(this.master);
      this.music = ctx.createGain();
      this.music.gain.value = 0.2;
      this.music.connect(this.master);
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.ensure();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem('ms_muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) this.master.gain.value = m ? 0 : 0.8;
  }

  private toneAt(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slide: number,
    dest: AudioNode,
  ) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(25, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noiseAt(
    t: number,
    dur: number,
    vol: number,
    f0: number,
    f1: number,
    type: BiquadFilterType,
    dest: AudioNode,
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slide = 0, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.toneAt(freq, ctx.currentTime + delay, dur, type, vol, slide, this.sfx);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'lowpass', delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.noiseAt(ctx.currentTime + delay, dur, vol, f0, f1, type, this.sfx);
  }

  /* ---------------- SFX ---------------- */
  coin(streak = 0) {
    const base = 880 * Math.pow(2, Math.min(streak, 7) / 12);
    this.tone(base, 0.09, 'square', 0.12);
    this.tone(base * 1.5, 0.18, 'square', 0.12, 0, 0.07);
  }
  jump() {
    this.tone(320, 0.2, 'sine', 0.3, 2.4);
    this.noise(0.12, 0.12, 1800, 4000, 'highpass');
  }
  roll() {
    this.noise(0.35, 0.3, 2500, 300, 'lowpass');
  }
  lane() {
    this.noise(0.1, 0.12, 3000, 1200, 'bandpass');
  }
  land() {
    this.tone(120, 0.1, 'sine', 0.3, 0.5);
  }
  stumble() {
    this.tone(150, 0.3, 'sawtooth', 0.28, 0.4);
    this.noise(0.25, 0.4, 1200, 200, 'lowpass');
  }
  crash() {
    this.noise(0.7, 0.7, 2500, 80, 'lowpass');
    this.tone(110, 0.6, 'sawtooth', 0.35, 0.25);
    this.tone(70, 0.8, 'square', 0.25, 0.4, 0.05);
  }
  power() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.25, 0, i * 0.055));
  }
  click() {
    this.tone(660, 0.07, 'triangle', 0.2);
  }
  horn() {
    this.tone(196, 0.8, 'sawtooth', 0.2, 0.96);
    this.tone(247, 0.8, 'sawtooth', 0.16, 0.96);
    this.tone(98, 0.8, 'square', 0.1, 0.96);
    this.noise(0.8, 0.08, 900, 300, 'lowpass');
  }
  busHorn() {
    for (const t of [0, 0.42]) {
      this.tone(330, 0.3, 'square', 0.13, 0, t);
      this.tone(262, 0.3, 'square', 0.11, 0, t);
    }
  }
  ghostWail() {
    this.tone(520, 1.1, 'sine', 0.14, 0.5);
    this.tone(780, 1.1, 'sine', 0.07, 0.55, 0.1);
    this.noise(1.0, 0.06, 1500, 400, 'bandpass');
  }
  boost() {
    this.noise(0.55, 0.32, 400, 7000, 'bandpass');
    this.tone(280, 0.45, 'sawtooth', 0.14, 3.4);
    this.tone(560, 0.35, 'triangle', 0.1, 2.2, 0.05);
  }
  levelUp() {
    [392, 523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
      this.tone(f, 0.22, 'square', 0.13, 0, i * 0.075);
      this.tone(f / 2, 0.22, 'triangle', 0.18, 0, i * 0.075);
    });
    this.noise(0.5, 0.18, 800, 6000, 'highpass', 0.05);
  }
  powerEnd() {
    [784, 523].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.18, 0, i * 0.09));
  }

  /* ---------------- Music ---------------- */
  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.timer !== null) return;
    this.nextT = ctx.currentTime + 0.08;
    this.step = 0;
    this.timer = window.setInterval(() => this.pump(), 28);
  }

  stopMusic() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private pump() {
    const ctx = this.ctx;
    if (!ctx) return;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextT < ctx.currentTime + 0.14) {
      this.scheduleStep(this.step, this.nextT);
      this.nextT += stepDur;
      this.step++;
    }
  }

  private scheduleStep(step: number, t: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const m = this.music;
    // kick
    if (s % 4 === 0) {
      const ctx = this.ctx!;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g);
      g.connect(m);
      o.start(t);
      o.stop(t + 0.2);
    }
    // snare
    if (s === 4 || s === 12) this.noiseAt(t, 0.12, 0.5, 3000, 1200, 'bandpass', m);
    // hat
    if (s % 2 === 1) this.noiseAt(t, 0.04, 0.22, 7000, 7000, 'highpass', m);
    // bass
    if (BASS_STEPS.includes(s)) this.toneAt(ROOTS[bar], t, 0.17, 'sawtooth', 0.32, 0, m);
    // arp
    if (s % 2 === 0) {
      const idx = ARP[(s / 2) | 0];
      this.toneAt(CHORDS[bar][idx] * 2, t, 0.12, 'square', 0.1, 0, m);
    }
  }
}

export const audio = new AudioEngine();
