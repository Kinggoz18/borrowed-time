/**
 * Capped particle pool (plan §5: 300 max, 150 on the low tier, radius clamped, smoke budget
 * 3 new puffs a frame). Struct of arrays, no allocation per frame.
 */
export const KIND_FIRE = 0;
export const KIND_SMOKE = 1;
export const KIND_SPARK = 2;
export const KIND_ARROW = 3;
export const MAX_RADIUS = 14;
export const SMOKE_PER_FRAME = 3;

export class ParticlePool {
  readonly cap: number;
  count = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly life: Float32Array;
  readonly max: Float32Array;
  readonly r: Float32Array;
  readonly grow: Float32Array;
  readonly kind: Uint8Array;
  private smokeThisFrame = 0;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.r = new Float32Array(cap);
    this.grow = new Float32Array(cap);
    this.kind = new Uint8Array(cap);
  }

  /** Returns false when the pool is full or the smoke budget for this frame is spent. */
  spawn(kind: number, x: number, y: number, vx: number, vy: number, lifeS: number, r: number, grow = 0): boolean {
    if (this.count >= this.cap) return false;
    if (kind === KIND_SMOKE) {
      if (this.smokeThisFrame >= SMOKE_PER_FRAME) return false;
      this.smokeThisFrame++;
    }
    const k = this.count++;
    this.kind[k] = kind;
    this.x[k] = x;
    this.y[k] = y;
    this.vx[k] = vx;
    this.vy[k] = vy;
    this.life[k] = lifeS;
    this.max[k] = lifeS;
    this.r[k] = Math.min(MAX_RADIUS, r);
    this.grow[k] = grow;
    return true;
  }

  step(dtS: number): void {
    this.smokeThisFrame = 0;
    let k = 0;
    while (k < this.count) {
      this.life[k] -= dtS;
      if (this.life[k] <= 0) {
        this.removeAt(k);
        continue;
      }
      this.x[k] += this.vx[k] * dtS;
      this.y[k] += this.vy[k] * dtS;
      if (this.kind[k] === KIND_ARROW) this.vy[k] += 60 * dtS;
      this.r[k] = Math.min(MAX_RADIUS, this.r[k] + this.grow[k] * dtS);
      k++;
    }
  }

  private removeAt(k: number): void {
    const last = --this.count;
    if (k === last) return;
    this.x[k] = this.x[last];
    this.y[k] = this.y[last];
    this.vx[k] = this.vx[last];
    this.vy[k] = this.vy[last];
    this.life[k] = this.life[last];
    this.max[k] = this.max[last];
    this.r[k] = this.r[last];
    this.grow[k] = this.grow[last];
    this.kind[k] = this.kind[last];
  }
}
