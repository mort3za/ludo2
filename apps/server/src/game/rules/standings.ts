/**
 * Add a seat to the standings array (immutable).
 * If the seat is already in standings, returns unchanged.
 */
export function updateStandings(standings: number[], seatIndex: number): number[] {
  if (standings.includes(seatIndex)) return standings;
  return [...standings, seatIndex];
}

/**
 * Check if the game is over: all initially-active seats are placed.
 */
export function isGameOver(standings: number[], initialActiveCount: number): boolean {
  return standings.length >= initialActiveCount;
}
