/**
 * Shared Web Audio graph: music and sfx buses into a compressor then a limiter.
 * Voice cap and ducking live here so cues can't clip the score.
 */
export const MAX_VOICES = 8;
export const DUCK_GAIN = 0.32;

export interface VoiceSlot {
  t: number;
  stop: () => void;
}

/** Steal the oldest voice when the cap is hit. Pure, so tests don't need an AudioContext. */
export function takeVoice(voices: VoiceSlot[], max: number, now: number, stop: () => void): VoiceSlot[] {
  const next: VoiceSlot = { t: now, stop };
  if (voices.length < max) return [...voices, next];
  let oldest = 0;
  for (let i = 1; i < voices.length; i++) if (voices[i]!.t < voices[oldest]!.t) oldest = i;
  voices[oldest]!.stop();
  return voices.filter((_, i) => i !== oldest).concat(next);
}

/** Stable pitch/volume jitter from the cue name and play count — not the island RNG. */
export function cueJitter(cue: string, n: number): { pitch: number; vol: number } {
  let h = 2166136261;
  const s = cue + ":" + n;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  const u = (h >>> 0) / 4294967296;
  const v = ((h >>> 11) >>> 0) / 4294967296;
  return { pitch: 0.97 + u * 0.06, vol: 0.88 + v * 0.24 };
}

export class AudioGraph {
  ctx: AudioContext | null = null;
  musicGain: GainNode | null = null;
  duckGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  musicOn = true;
  sfxOn = true;
  musicVol = 0.65;
  sfxVol = 0.75;
  private ducks = 0;
  private voices: VoiceSlot[] = [];
  private hidden = false;

  get duckCount(): number {
    return this.ducks;
  }

  ensure(): AudioContext | null {
    try {
      this.ctx ??= new AudioContext();
      if (!this.musicGain) this.wire();
      if (this.ctx.state === "suspended" && !this.hidden) void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private wire(): void {
    const ctx = this.ctx!;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 6;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.22;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -1.8;
    limit.knee.value = 0.2;
    limit.ratio.value = 20;
    limit.attack.value = 0.003;
    limit.release.value = 0.05;
    this.musicGain = ctx.createGain();
    this.duckGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.duckGain.gain.value = 1;
    this.musicGain.connect(this.duckGain).connect(comp);
    this.sfxGain.connect(comp);
    comp.connect(limit).connect(ctx.destination);
    this.applyGains();
  }

  applyGains(): void {
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? this.musicVol : 0;
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxOn ? this.sfxVol : 0;
    if (this.duckGain) this.duckGain.gain.setTargetAtTime(this.ducks > 0 ? DUCK_GAIN : 1, this.ctx?.currentTime ?? 0, 0.05);
  }

  duck(on: boolean): void {
    this.ducks = Math.max(0, this.ducks + (on ? 1 : -1));
    this.applyGains();
  }

  acquire(stop: () => void): void {
    const now = this.ctx?.currentTime ?? 0;
    this.voices = takeVoice(this.voices, MAX_VOICES, now, stop);
  }

  release(stop: () => void): void {
    this.voices = this.voices.filter((v) => v.stop !== stop);
  }

  suspend(): void {
    this.hidden = true;
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    this.hidden = false;
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }
}

export const graph = new AudioGraph();
