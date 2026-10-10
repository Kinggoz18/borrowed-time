/**
 * Background music: two looping tracks (public/audio, docs/CREDITS.md), one for the day and one for
 * the night, on the music bus and apart from the sound effects. Always on, every screen: the track
 * follows the hour of the island and the sheet, never a tap, and changes with an equal-power
 * crossfade. Mute is gain 0 on the bus, not a stop, so the loop never restarts.
 */
import { graph } from "./audio-graph";

export type MusicScene = "day" | "night";
export type MusicFormat = "ogg" | "m4a";

/** Seconds the old track takes to fade out while the new one fades in. */
export const FADE_S = 4;
export const TRACKS: Record<MusicScene, string> = { day: "day", night: "night" };

/** Ogg Vorbis where the browser plays it (Android, desktop), AAC in .m4a otherwise (iOS Safari). */
export function pickFormat(canPlay: (mime: string) => string): MusicFormat {
  return canPlay('audio/ogg; codecs="vorbis"') !== "" ? "ogg" : "m4a";
}
export const trackUrl = (scene: MusicScene, format: MusicFormat, base = "/"): string => `${base}audio/${TRACKS[scene]}.${format}`;

/** Equal-power fade curves: gain in and gain out sum to constant power. */
export function fadeCurve(n: number, rising: boolean): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    c[i] = rising ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
  }
  return c;
}

interface Lane {
  gain: GainNode;
  src: AudioBufferSourceNode | null;
}

export class Music {
  scene: MusicScene = "day";
  private started = false;
  private playing: MusicScene | null = null;
  private buffers = new Map<MusicScene, Promise<AudioBuffer | null>>();
  private lanes = new Map<MusicScene, Lane>();
  private token = 0;

  get running(): boolean {
    return this.started;
  }

  /** The track that is (or is fading) in. */
  get current(): MusicScene | null {
    return this.playing;
  }

  /** First user gesture: open the graph and start the current track. */
  start(): void {
    const ctx = graph.ensure();
    if (!ctx) return;
    this.started = true;
    void this.play(this.scene, 1.2);
    // the other track loads in the background so the first dusk crossfades without a wait
    void this.load(this.scene === "day" ? "night" : "day");
  }

  /** Switch tracks (a no-op when it is already playing). Safe before the first gesture: it only records the scene. */
  set(scene: MusicScene): void {
    this.scene = scene;
    if (this.started) void this.play(scene, FADE_S);
  }

  stop(): void {
    this.started = false;
    this.token++;
    for (const [, lane] of this.lanes) {
      try {
        lane.src?.stop();
      } catch {
        /* already ended */
      }
      lane.src = null;
    }
    this.playing = null;
  }

  private load(scene: MusicScene): Promise<AudioBuffer | null> {
    let p = this.buffers.get(scene);
    if (p) return p;
    p = (async () => {
      const ctx = graph.ensure();
      if (!ctx) return null;
      try {
        const fmt = pickFormat((m) => new Audio().canPlayType(m));
        const res = await fetch(trackUrl(scene, fmt, import.meta.env.BASE_URL));
        if (!res.ok) throw new Error(`music ${scene}: ${res.status}`);
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        this.buffers.delete(scene); // try again on the next switch
        return null;
      }
    })();
    this.buffers.set(scene, p);
    return p;
  }

  private lane(scene: MusicScene): Lane | null {
    const ctx = graph.ctx;
    const bus = graph.musicGain;
    if (!ctx || !bus) return null;
    let l = this.lanes.get(scene);
    if (!l) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(bus);
      l = { gain, src: null };
      this.lanes.set(scene, l);
    }
    return l;
  }

  private async play(scene: MusicScene, fade: number): Promise<void> {
    if (this.playing === scene) return;
    const token = ++this.token;
    this.playing = scene;
    const buf = await this.load(scene);
    const ctx = graph.ctx;
    if (!buf || !ctx || token !== this.token) {
      if (!buf && token === this.token) this.playing = null; // retry on the next set()/start()
      return;
    }
    const incoming = this.lane(scene);
    if (!incoming) return;
    const now = ctx.currentTime;
    if (!incoming.src) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(incoming.gain);
      src.start(now);
      incoming.src = src;
    }
    const n = 64;
    incoming.gain.gain.cancelScheduledValues(now);
    incoming.gain.gain.setValueCurveAtTime(fadeCurve(n, true), now, fade);
    for (const [name, lane] of this.lanes) {
      if (name === scene || !lane.src) continue;
      lane.gain.gain.cancelScheduledValues(now);
      lane.gain.gain.setValueCurveAtTime(fadeCurve(n, false), now, fade);
      const old = lane.src;
      lane.src = null;
      setTimeout(() => {
        try {
          old.stop();
        } catch {
          /* already ended */
        }
      }, fade * 1000 + 200);
    }
  }
}

export const music = new Music();
