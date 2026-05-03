import { CELLS_PER_ARM, HOME_COLUMN_LENGTH, TOKENS_PER_PLAYER } from "@ludo/shared";

export interface CellPos {
  x: number;
  y: number;
  id: string;
  seatIndex?: number;
}

export interface BoardLayout {
  track: CellPos[];
  homes: CellPos[][];
  yards: CellPos[][];
  center: { x: number; y: number };
  viewBox: string;
  cellSize: number;
}

/**
 * Compute (x, y) positions for every cell on a parametric S-seat Ludo board.
 *
 * Arms are evenly spaced clockwise. Seat 1 arm points up (north).
 * For S=4 the layout forms a cross; for S≥5 a star.
 */
export function computeBoardLayout(S: number): BoardLayout {
  // Inner radius: circumradius of a regular S-gon with side 3
  const R = 1.5 / Math.sin(Math.PI / S);
  const ARM_ROWS = CELLS_PER_ARM === 13 ? 6 : Math.floor(CELLS_PER_ARM / 2);

  const track: CellPos[] = [];
  const homes: CellPos[][] = [];
  const yards: CellPos[][] = [];

  for (let a = 0; a < S; a++) {
    const seat = a + 1;
    // Arm angle: seat 1 points up (-π/2), clockwise
    const θ = -Math.PI / 2 + (a * (2 * Math.PI)) / S;
    const dx = Math.cos(θ);
    const dy = Math.sin(θ);
    // Perpendicular: visual-right when facing outward (in SVG y-down)
    const px = -Math.sin(θ);
    const py = Math.cos(θ);

    const armStart = a * CELLS_PER_ARM; // 0-indexed base for this arm

    // Track: 13 cells per arm
    // Right column going outward (cells 1–6)
    for (let row = 0; row < ARM_ROWS; row++) {
      track.push({
        x: (R + row) * dx + px,
        y: (R + row) * dy + py,
        id: `T/${armStart + row + 1}`,
      });
    }

    // Tip cell (cell 7): center column, outermost row
    track.push({
      x: (R + ARM_ROWS - 1) * dx,
      y: (R + ARM_ROWS - 1) * dy,
      id: `T/${armStart + ARM_ROWS + 1}`,
    });

    // Left column going inward (cells 8–13)
    for (let row = ARM_ROWS - 1; row >= 0; row--) {
      track.push({
        x: (R + row) * dx - px,
        y: (R + row) * dy - py,
        id: `T/${armStart + ARM_ROWS + 2 + (ARM_ROWS - 1 - row)}`,
      });
    }

    // Home column (4 cells going outward from center)
    const homeCol: CellPos[] = [];
    for (let i = 0; i < HOME_COLUMN_LENGTH; i++) {
      homeCol.push({
        x: (R + i) * dx,
        y: (R + i) * dy,
        id: `H/${seat}/${i + 1}`,
        seatIndex: seat,
      });
    }
    homes.push(homeCol);

    // Yard (4 token spots in a 2×2 grid between arms)
    const yardAngle = θ + Math.PI / S;
    const ydx = Math.cos(yardAngle);
    const ydy = Math.sin(yardAngle);
    const ypx = -Math.sin(yardAngle);
    const ypy = Math.cos(yardAngle);
    const yardR = R + 2.5;
    const yardCells: CellPos[] = [];
    for (let j = 0; j < TOKENS_PER_PLAYER; j++) {
      const col = ((j % 2) - 0.5) * 1.2;
      const row = (Math.floor(j / 2) - 0.5) * 1.2;
      yardCells.push({
        x: yardR * ydx + col * ypx + row * ydx,
        y: yardR * ydy + col * ypy + row * ydy,
        id: `Y/${seat}/${j + 1}`,
        seatIndex: seat,
      });
    }
    yards.push(yardCells);
  }

  // Compute viewBox from extents
  const all = [...track, ...homes.flat(), ...yards.flat()];
  const margin = 2;
  const minX = Math.min(...all.map((c) => c.x)) - margin;
  const minY = Math.min(...all.map((c) => c.y)) - margin;
  const maxX = Math.max(...all.map((c) => c.x)) + margin;
  const maxY = Math.max(...all.map((c) => c.y)) + margin;

  // Cell size scales inversely with S for readability
  const cellSize = S <= 5 ? 0.4 : 0.35;

  return {
    track,
    homes,
    yards,
    center: { x: 0, y: 0 },
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    cellSize,
  };
}

/** Map seat index (1-based) to a CSS color. */
const SEAT_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#eab308", // yellow
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
] as const;

export function seatColor(seatIndex: number): string {
  return SEAT_COLORS[(seatIndex - 1) % SEAT_COLORS.length] ?? "#888";
}

/** Map PlayerColor name to a CSS hex color. */
const PLAYER_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  purple: "#a855f7",
  orange: "#f97316",
  cyan: "#06b6d4",
  pink: "#ec4899",
};

export function playerColorHex(color: string): string {
  return PLAYER_COLORS[color] ?? "#888";
}
