import { startSquare } from "@ludo/shared";
import { describe, expect, it } from "vitest";
import { computeBoardLayout } from "./board-geometry";

function getTrackPoint(id: string) {
  return computeBoardLayout(4).track.find((cell) => cell.id === id);
}

describe("computeBoardLayout", () => {
  it("places the four start squares on the classic A cells", () => {
    expect(getTrackPoint(startSquare(1, 4))).toMatchObject({ x: 1, y: -5 });
    expect(getTrackPoint(startSquare(2, 4))).toMatchObject({ x: 5, y: 1 });
    expect(getTrackPoint(startSquare(3, 4))).toMatchObject({ x: -1, y: 5 });
    expect(getTrackPoint(startSquare(4, 4))).toMatchObject({ x: -5, y: -1 });
  });

  it("keeps the inner ring aligned as a square around the center", () => {
    const layout = computeBoardLayout(4);
    const expectedTrackCorners = new Set(["-1,-1", "1,-1", "1,1", "-1,1"]);
    const expectedHomeEdges = new Set(["0,-1", "1,0", "0,1", "-1,0"]);

    const trackCorners = new Set(
      layout.track
        .filter((cell) => Math.abs(cell.x) <= 1 && Math.abs(cell.y) <= 1)
        .map((cell) => `${cell.x},${cell.y}`),
    );
    const homeEdges = new Set(
      layout.homes
        .flat()
        .filter((cell) => Math.abs(cell.x) <= 1 && Math.abs(cell.y) <= 1)
        .map((cell) => `${cell.x},${cell.y}`),
    );

    expect(trackCorners).toEqual(expectedTrackCorners);
    expect(homeEdges).toEqual(expectedHomeEdges);
  });

  it("moves each yard into its corner quadrant", () => {
    const layout = computeBoardLayout(4);

    expect(layout.yards[0]?.every((cell) => cell.x > 0 && cell.y < 0)).toBe(true);
    expect(layout.yards[1]?.every((cell) => cell.x > 0 && cell.y > 0)).toBe(true);
    expect(layout.yards[2]?.every((cell) => cell.x < 0 && cell.y > 0)).toBe(true);
    expect(layout.yards[3]?.every((cell) => cell.x < 0 && cell.y < 0)).toBe(true);
  });
});
