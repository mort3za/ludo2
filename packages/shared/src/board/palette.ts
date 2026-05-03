import { COLOR_PALETTE, MIN_SEATS, MAX_SEATS } from "../constants/board.js";

/**
 * Draw `S` unique colors from the 8-color palette using Fisher-Yates
 * shuffle with an injected RNG (returns [0, 1)).
 */
export function drawPalette(S: number, rng: () => number): string[] {
  if (S < MIN_SEATS || S > MAX_SEATS) {
    throw new Error(`S must be between ${MIN_SEATS} and ${MAX_SEATS}, got ${S}`);
  }

  const pool = [...COLOR_PALETTE];

  // Fisher-Yates: shuffle first S elements
  for (let i = 0; i < S; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool.slice(0, S);
}
