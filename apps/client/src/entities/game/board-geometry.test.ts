import { startSquare } from "@ludo/shared";
import { describe, expect, it } from "vitest";
import { computeBoardLayout } from "./board-geometry";

function getTrackPoint(id: string) {
  return computeBoardLayout(4).track.find((cell) => cell.id === id);
}

describe("computeBoardLayout", () => {
  it("places the four start squares on the outer-edge A cells", () => {
    expect(getTrackPoint(startSquare(1, 4))).toMatchObject({ x: 1, y: -6 });
    expect(getTrackPoint(startSquare(2, 4))).toMatchObject({ x: 6, y: 1 });
    expect(getTrackPoint(startSquare(3, 4))).toMatchObject({ x: -1, y: 6 });
    expect(getTrackPoint(startSquare(4, 4))).toMatchObject({ x: -6, y: -1 });
  });

  it("leaves the inner ring at distance 1 empty so arm-to-arm transitions don't overlap", () => {
    const layout = computeBoardLayout(4);
    const innerCells = [...layout.track, ...layout.homes.flat()].filter(
      (cell) => Math.abs(cell.x) <= 1 && Math.abs(cell.y) <= 1,
    );
    expect(innerCells, "no track or home cell should sit inside the central goal area").toEqual([]);

    const innerHomeEnds = new Set(
      layout.homes
        .flat()
        .filter((cell) => Math.max(Math.abs(cell.x), Math.abs(cell.y)) === 2)
        .map((cell) => `${cell.x},${cell.y}`),
    );
    expect(innerHomeEnds).toEqual(new Set(["0,-2", "2,0", "0,2", "-2,0"]));
  });

  it("moves each yard into its corner quadrant", () => {
    const layout = computeBoardLayout(4);

    expect(layout.yards[0]?.every((cell) => cell.x > 0 && cell.y < 0)).toBe(true);
    expect(layout.yards[1]?.every((cell) => cell.x > 0 && cell.y > 0)).toBe(true);
    expect(layout.yards[2]?.every((cell) => cell.x < 0 && cell.y > 0)).toBe(true);
    expect(layout.yards[3]?.every((cell) => cell.x < 0 && cell.y < 0)).toBe(true);
  });

  it("gives every track cell a unique position so movement never visually stalls at arm transitions", () => {
    const layout = computeBoardLayout(4);
    const seen = new Map<string, string>();
    for (const cell of layout.track) {
      const key = `${cell.x},${cell.y}`;
      const prev = seen.get(key);
      expect(prev, `${cell.id} and ${prev} both render at (${key})`).toBeUndefined();
      seen.set(key, cell.id);
    }
    expect(seen.size).toBe(layout.track.length);
  });

  it("ensures geometric continuity for S=4 track and entry/home", () => {
    const layout = computeBoardLayout(4);

    const dist = (c1: { x: number; y: number }, c2: { x: number; y: number }) =>
      Math.sqrt((c1.x - c2.x) ** 2 + (c1.y - c2.y) ** 2);

    // 1. Check that track cells are sequentially adjacent
    for (let i = 0; i < layout.track.length - 1; i++) {
      const d = dist(layout.track[i]!, layout.track[i + 1]!);
      expect(
        d,
        `track ${layout.track[i]!.id} and ${layout.track[i + 1]!.id} are adjacent`,
      ).toBeLessThanOrEqual(1.5);
    }

    // 2. Check track wrap-around
    const wrapDist = dist(layout.track[layout.track.length - 1]!, layout.track[0]!);
    expect(wrapDist, "track wrap-around is adjacent").toBeLessThanOrEqual(1.5);

    // 3. Check entry-square transitions to home-column
    // For seat 1: entry is T/44 -> turns into H/1/1
    const entry1 = layout.track.find((c) => c.id === "T/44")!;
    const home1 = layout.homes[0]!.find((c) => c.id === "H/1/1")!;
    expect(dist(entry1, home1), "Seat 1 entry to home is adjacent").toBeLessThanOrEqual(1.5);

    // For seat 2: entry is T/11 -> turns into H/2/1
    const entry2 = layout.track.find((c) => c.id === "T/11")!;
    const home2 = layout.homes[1]!.find((c) => c.id === "H/2/1")!;
    expect(dist(entry2, home2), "Seat 2 entry to home is adjacent").toBeLessThanOrEqual(1.5);

    // For seat 3: entry is T/22 -> turns into H/3/1
    const entry3 = layout.track.find((c) => c.id === "T/22")!;
    const home3 = layout.homes[2]!.find((c) => c.id === "H/3/1")!;
    expect(dist(entry3, home3), "Seat 3 entry to home is adjacent").toBeLessThanOrEqual(1.5);

    // For seat 4: entry is T/33 -> turns into H/4/1
    const entry4 = layout.track.find((c) => c.id === "T/33")!;
    const home4 = layout.homes[3]!.find((c) => c.id === "H/4/1")!;
    expect(dist(entry4, home4), "Seat 4 entry to home is adjacent").toBeLessThanOrEqual(1.5);
  });

  it("ensures geometric continuity for S=6 track and entry/home", () => {
    const layout = computeBoardLayout(6);

    const dist = (c1: { x: number; y: number }, c2: { x: number; y: number }) =>
      Math.sqrt((c1.x - c2.x) ** 2 + (c1.y - c2.y) ** 2);

    for (let i = 0; i < layout.track.length - 1; i++) {
      const d = dist(layout.track[i]!, layout.track[i + 1]!);
      expect(
        d,
        `track S=6 ${layout.track[i]!.id} and ${layout.track[i + 1]!.id} are adjacent`,
      ).toBeLessThanOrEqual(1.5);
    }

    const wrapDist = dist(layout.track[layout.track.length - 1]!, layout.track[0]!);
    expect(wrapDist, "track S=6 wrap-around is adjacent").toBeLessThanOrEqual(1.5);

    // Seat 1 entry: T/66 -> H/1/1
    const entry1 = layout.track.find((c) => c.id === "T/66")!;
    const home1 = layout.homes[0]!.find((c) => c.id === "H/1/1")!;
    expect(dist(entry1, home1), "Seat 1 S=6 entry to home is adjacent").toBeLessThanOrEqual(2.5);
  });
});
