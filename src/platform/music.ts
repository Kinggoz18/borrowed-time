/**
 * Background score. Always on, every screen. Scene follows the time of day and the sheet,
 * never a tap. Loops are synthesised from `score.ts` on the music bus.
 */
import { graph } from "./audio-graph";
import { LOOP_S, STINGER, score, type Inst, type MusicScene, type Note } from "./score";

export class Music {
  scene: MusicScene = "menu";
  era = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private loopT = 0;
  private surf: AudioBufferSourceNode | null = null;
  private drone: OscillatorNode[] = [];
  private pending: Array<() => void> = [];

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    const ctx = graph.ensure();
    if (!ctx) return;
    this.cut();
    this.stopHold();
    this.hold();
    this.loopT = ctx.currentTime;
    this.arm();
  }

  set(scene: MusicScene, era = this.era): void {
    if (this.scene === scene && this.era === era && this.timer) return;
    this.scene = scene;
    this.era = Math.max(0, Math.min(3, era));
    this.start();
  }

  sting(): void {
    const ctx = graph.ensure();
    if (!ctx || !graph.musicGain) return;
    for (const n of STINGER) this.voice(n, ctx.currentTime + n.t);
  }

  private arm(): void {
    if (this.timer) {
      this.tick();
      return;
    }
    this.timer = setInterval(() => this.tick(), 180);
    this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.cut();
    this.stopHold();
  }

  private tick(): void {
    const ctx = graph.ctx;
    if (!ctx || !graph.musicGain) return;
    const notes = score(this.era, this.scene);
    const now = ctx.currentTime;
    while (this.loopT + LOOP_S < now) this.loopT += LOOP_S;
    while (this.loopT < now + 1.2) {
      const origin = this.loopT;
      for (const n of notes) {
        if (n.dur >= LOOP_S - 0.01) continue;
        const when = origin + n.t;
        if (when + n.dur <= now) continue;
        this.voice(n, when);
      }
      this.loopT += LOOP_S;
    }
  }

  private hold(): void {
    const ctx = graph.ctx;
    const bus = graph.musicGain;
    if (!ctx || !bus) return;
    this.stopHold();
    const notes = score(this.era, this.scene).filter((n) => n.dur >= LOOP_S - 0.01);
    for (const n of notes) {
      if (n.inst === "surf" || n.inst === "hiss") {
        const src = ctx.createBufferSource();
        src.buffer = noise(ctx);
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = n.inst === "surf" ? "bandpass" : "highpass";
        f.frequency.value = n.inst === "surf" ? 380 : 1200;
        f.Q.value = n.inst === "surf" ? 0.7 : 0.4;
        const g = ctx.createGain();
        g.gain.value = n.gain;
        src.connect(f).connect(g).connect(bus);
        src.start();
        this.surf = src;
      } else {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = n.freq;
        g.gain.value = n.gain;
        o.connect(g).connect(bus);
        o.start();
        this.drone.push(o);
      }
    }
  }

  private stopHold(): void {
    try {
      this.surf?.stop();
    } catch {
      /* already stopped */
    }
    this.surf = null;
    for (const o of this.drone) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
    this.drone = [];
  }

  private cut(): void {
    for (const stop of this.pending) {
      try {
        stop();
      } catch {
        /* already ended */
      }
    }
    this.pending = [];
  }

  private voice(n: Note, when: number): void {
    const ctx = graph.ctx;
    const bus = graph.musicGain;
    if (!ctx || !bus) return;
    const stops: Array<() => void> = [];
    const halt = (node: { stop: (t?: number) => void }) => {
      stops.push(() => {
        try {
          node.stop();
        } catch {
          /* already ended */
        }
      });
    };
    if (n.inst === "drum") {
      const o = ctx.createOscillator();
      const ng = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(n.freq, when);
      o.frequency.exponentialRampToValueAtTime(30, when + n.dur);
      ng.gain.setValueAtTime(n.gain, when);
      ng.gain.exponentialRampToValueAtTime(0.0001, when + n.dur);
      o.connect(ng).connect(bus);
      o.start(when);
      o.stop(when + n.dur + 0.02);
      halt(o);
      const src = ctx.createBufferSource();
      src.buffer = noise(ctx);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 800;
      const noisy = ctx.createGain();
      noisy.gain.setValueAtTime(n.gain * 0.5, when);
      noisy.gain.exponentialRampToValueAtTime(0.0001, when + n.dur * 0.6);
      src.connect(f).connect(noisy).connect(bus);
      src.start(when);
      src.stop(when + n.dur);
      halt(src);
      this.pending.push(() => stops.forEach((s) => s()));
      return;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(n.gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + n.dur);
    g.connect(bus);
    const o = ctx.createOscillator();
    o.type = wave(n.inst);
    o.frequency.value = n.freq;
    o.detune.value = n.detune;
    if (n.inst === "fiddle" || n.inst === "gurdy") {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = n.inst === "fiddle" ? 5.4 : 6.2;
      lg.gain.value = n.inst === "fiddle" ? 14 : 9;
      lfo.connect(lg).connect(o.detune);
      lfo.start(when);
      lfo.stop(when + n.dur + 0.02);
      halt(lfo);
    }
    o.connect(g);
    o.start(when);
    o.stop(when + n.dur + 0.03);
    halt(o);
    this.pending.push(() => stops.forEach((s) => s()));
  }
}

function wave(inst: Inst): OscillatorType {
  if (inst === "fiddle" || inst === "gurdy" || inst === "brass") return "sawtooth";
  if (inst === "harpsichord" || inst === "tick") return "square";
  if (inst === "lute" || inst === "whistle" || inst === "box") return "triangle";
  return "sine";
}

const noiseCache = new WeakMap<AudioContext, AudioBuffer>();
function noise(ctx: AudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (buf) return buf;
  const n = Math.floor(ctx.sampleRate * 1.5);
  buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = 123456789;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    d[i] = (s / 0xffffffff) * 2 - 1;
  }
  noiseCache.set(ctx, buf);
  return buf;
}

export const music = new Music();
