import { parseCell, yard } from "@ludo/shared";
import type { Token } from "@ludo/shared";

export interface MoveResult {
  tokens: Token[];
  captured: string | null;
}

/**
 * Apply a move: update the token's position and handle capture.
 *
 * Capture rules:
 * - Only single opponent tokens can be captured
 * - Never capture own-color tokens
 * - Captured token returns to its seat's yard (next available slot)
 *
 * Returns a new tokens array (immutable) and the captured token ID (if any).
 */
export function applyMove(
  tokens: Token[],
  tokenId: string,
  destination: string,
  _seat: number,
  S: number,
  colorToSeat: Record<string, number>,
): MoveResult {
  const parsed = parseCell(destination);

  // Clone tokens for immutability
  let newTokens = tokens.map((t) => ({ ...t }));

  // Move the token
  const movingToken = newTokens.find((t) => t.id === tokenId);
  if (!movingToken) throw new Error(`Token not found: ${tokenId}`);

  const movingColor = movingToken.color;
  movingToken.cell = destination;

  // Capture check — only on track cells
  if (parsed.kind !== "track") {
    return { tokens: newTokens, captured: null };
  }

  // Find opponent tokens on the destination
  const opponents = newTokens.filter(
    (t) => t.id !== tokenId && t.cell === destination && t.color !== movingColor,
  );

  // Only capture if there's exactly one opponent (blocks are immune)
  if (opponents.length !== 1) {
    return { tokens: newTokens, captured: null };
  }

  const captured = opponents[0]!;
  const capturedSeat = colorToSeat[captured.color];
  if (capturedSeat === undefined) {
    throw new Error(`No seat mapping for color: ${captured.color}`);
  }

  // Find next available yard slot for the captured token's seat
  const occupiedSlots = new Set(
    newTokens
      .filter((t) => {
        const p = parseCell(t.cell);
        return p.kind === "yard" && p.seat === capturedSeat;
      })
      .map((t) => parseCell(t.cell))
      .filter((p) => p.kind === "yard")
      .map((p) => (p as { kind: "yard"; seat: number; slot: number }).slot),
  );

  let slot = 1;
  while (occupiedSlots.has(slot)) slot++;
  captured.cell = yard(capturedSeat, slot);

  return { tokens: newTokens, captured: captured.id };
}
