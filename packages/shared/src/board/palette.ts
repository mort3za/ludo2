import { COLOR_PRIORITY, MIN_SEATS, MAX_SEATS } from "../constants/board.js";

/**
 * Draw `S` unique colors from the 8-color palette using Fisher-Yates
 * shuffle with an injected RNG (returns [0, 1)).
 *
 * Colors are drawn from `COLOR_PRIORITY` so that for S ≤ 4,
 * the classic red/blue/green/yellow are always selected (though
 * shuffled among themselves).
 */
export function drawPalette(S: number, rng: () => number): string[] {
  if (S < MIN_SEATS || S > MAX_SEATS) {
    throw new Error(`S must be between ${MIN_SEATS} and ${MAX_SEATS}, got ${S}`);
  }

  const pool = [...COLOR_PRIORITY].slice(0, S);

  // Fisher-Yates: shuffle the S selected colors
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool;
}
