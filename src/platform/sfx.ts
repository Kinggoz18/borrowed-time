/**
 * Sound hooks. Cues are tiny Web Audio voices on the sfx bus (pitch/volume jitter, voice cap).
 * Background music lives on a separate bus; see `music.ts`.
 */
import { cueJitter, graph } from "./audio-graph";
import { music, type Music, type MusicScene } from "./music";

export type Cue = "tap" | "build" | "upgrade" | "borrow" | "repay" | "coin" | "dusk" | "horn" | "held" | "lost" | "seize" | "tierUp" | "levelUp" | "deny";

const NOTES: Record<Cue, { f: number[]; d: number; type: OscillatorType; gain: number }> = {
  tap: { f: [660], d: 0.05, type: "triangle", gain: 0.12 },
  build: { f: [196, 247, 294], d: 0.09, type: "square", gain: 0.06 },
  upgrade: { f: [294, 370, 440, 587], d: 0.08, type: "triangle", gain: 0.12 },
  borrow: { f: [880, 660, 990], d: 0.12, type: "sine", gain: 0.14 },
  repay: { f: [523, 659, 784], d: 0.1, type: "sine", gain: 0.14 },
  coin: { f: [988, 1319], d: 0.07, type: "triangle", gain: 0.1 },
  dusk: { f: [392, 330], d: 0.4, type: "sine", gain: 0.16 },
  horn: { f: [110, 104, 98], d: 0.35, type: "sawtooth", gain: 0.07 },
  held: { f: [392, 523, 659, 784], d: 0.12, type: "triangle", gain: 0.14 },
  lost: { f: [330, 262, 196], d: 0.22, type: "sine", gain: 0.14 },
  seize: { f: [262, 247, 233], d: 0.25, type: "sine", gain: 0.12 },
  tierUp: { f: [262, 330, 392, 523, 659, 784], d: 0.14, type: "triangle", gain: 0.14 },
  levelUp: { f: [523, 784], d: 0.12, type: "triangle", gain: 0.12 },
  deny: { f: [180, 150], d: 0.08, type: "square", gain: 0.05 },
};

export class Sfx {
  enabled = true;
  /** Every cue that played, newest last: the e2e tests read it to prove the hooks fire. */
  readonly played: Cue[] = [];
  readonly music: Music = music;
  play(cue: Cue): void {
    this.played.push(cue);
    if (this.played.length > 200) this.played.shift();
    if (!this.enabled || !graph.sfxOn) return;
    try {
      const ctx = graph.ensure();
      const bus = graph.sfxGain;
      if (!ctx || !bus) return;
      const n = NOTES[cue];
      const t0 = ctx.currentTime;
      const j = cueJitter(cue, this.played.length);
      const stops: Array<() => void> = [];
      n.f.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = n.type;
        o.frequency.value = f * j.pitch;
        const t = t0 + i * n.d * 0.8;
        const amp = n.gain * j.vol;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + n.d + 0.02);
        stops.push(() => {
          try {
            o.stop();
          } catch {
            /* already ended */
          }
        });
      });
      const stop = () => stops.forEach((s) => s());
      graph.acquire(stop);
      const last = t0 + n.f.length * n.d + 0.05;
      setTimeout(() => graph.release(stop), Math.max(50, (last - t0) * 1000));
    } catch {
      /* no audio on this device: the game is fully playable without it */
    }
  }

  duck(on: boolean): void {
    graph.duck(on);
  }

  setScene(scene: MusicScene): void {
    this.music.set(scene);
  }

  setMixer(s: { sound: boolean; music: boolean; sfxVol: number; musicVol: number }): void {
    this.enabled = s.sound;
    graph.sfxOn = s.sound;
    graph.musicOn = s.music;
    graph.sfxVol = s.sfxVol;
    graph.musicVol = s.musicVol;
    graph.applyGains();
  }

  /** Open the graph and start the music loop. Mute is gain 0, not a stop. */
  unlock(): void {
    graph.ensure();
    this.music.start();
  }

  suspend(): void {
    graph.suspend();
  }

  resume(): void {
    graph.resume();
  }
}

export type Buzz = "light" | "medium" | "heavy";
export class Haptics {
  enabled = true;
  async buzz(kind: Buzz): Promise<void> {
    if (!this.enabled) return;
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { Haptics: H, ImpactStyle } = await import("@capacitor/haptics");
        await H.impact({ style: kind === "light" ? ImpactStyle.Light : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Heavy });
      } else navigator.vibrate?.(kind === "light" ? 8 : kind === "medium" ? 20 : 40);
    } catch {
      /* haptics are a nicety */
    }
  }
}
