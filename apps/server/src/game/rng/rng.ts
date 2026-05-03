/** RNG seam — all game randomness flows through this interface. */
export interface Rng {
  /** Returns a float in [0, 1). */
  random(): number;
  /** Returns an integer in [1, sides]. */
  rollDie(sides: number): number;
}

/**
 * Create a deterministic RNG from a numeric seed (mulberry32).
 * Use for reproducible tests and replay verification.
 */
export function createSeededRng(seed: number): Rng {
  let s = seed | 0;

  function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }

  return {
    random: next,
    rollDie(sides: number): number {
      return Math.floor(next() * sides) + 1;
    },
  };
}

/**
 * Create a cryptographically-strong RNG for production use.
 * Uses crypto.getRandomValues under the hood.
 */
export function createCryptoRng(): Rng {
  return {
    random(): number {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0]! / 0x100000000;
    },
    rollDie(sides: number): number {
      return Math.floor(this.random() * sides) + 1;
    },
  };
}
