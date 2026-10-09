/**
 * Seeded xorshift32, identical to the prototype's `makeRng`, with its state kept as a plain
 * number so it can live inside a saved island and be replayed exactly.
 */
export function seedState(seed: number): number {
  return seed >>> 0 || 1;
}

/** Advances the state once. Returns the value in [0, 1) and the next state. */
export function step(s: number): [number, number] {
  s ^= s << 13;
  s >>>= 0;
  s ^= s >> 17;
  s ^= s << 5;
  s >>>= 0;
  return [s / 4294967296, s];
}

/** A stateful wrapper for bots and tests. */
export class Rng {
  s: number;
  constructor(seed: number) {
    this.s = seedState(seed);
  }
  next = (): number => {
    const [v, s] = step(this.s);
    this.s = s;
    return v;
  };
}

export type Roll = () => number;
