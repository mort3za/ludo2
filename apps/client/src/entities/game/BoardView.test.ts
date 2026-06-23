import { createApp, nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import type { Seat, Token } from "@ludo/shared";
import { computeBoardLayout } from "./board-geometry";
import BoardView from "./BoardView.vue";

const seats: Seat[] = [
  { index: 1, state: "active", color: "blue", playerId: "p1", isBot: false },
  { index: 2, state: "active", color: "red", playerId: "p2", isBot: false },
  { index: 3, state: "active", color: "green", playerId: "p3", isBot: false },
  { index: 4, state: "active", color: "yellow", playerId: "p4", isBot: false },
];

const tokens: Token[] = [
  { id: "b1", color: "blue", cell: "T/8" },
  { id: "r1", color: "red", cell: "T/8" },
];

const mountedApps: Array<{ unmount: () => void }> = [];

afterEach(() => {
  while (mountedApps.length > 0) {
    mountedApps.pop()?.unmount();
  }
  document.body.innerHTML = "";
});

async function renderBoard(options?: {
  hiddenStackBadgeCellId?: string;
  tokens?: Token[];
  animatingTokenId?: string;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const app = createApp(BoardView, {
    boardSize: 4,
    tokens: options?.tokens ?? tokens,
    seats,
    hiddenStackBadgeCellId: options?.hiddenStackBadgeCellId,
    animatingTokenId: options?.animatingTokenId,
  });
  mountedApps.push(app);
  app.mount(container);
  await nextTick();

  return container;
}

function hasStackBadge(container: HTMLElement) {
  return [...container.querySelectorAll("text")].some(
    (element) => element.textContent?.trim() === "2",
  );
}

/**
 * Token positions live on the wrapping <g>'s `transform: translate(Xpx, Ypx)`
 * (GPU-composited), not the circle's cx/cy. Read them back as `x,y` strings.
 */
function tokenPositions(container: HTMLElement): string[] {
  return [...container.querySelectorAll('circle[stroke="var(--color-board-ink)"]')].map(
    (circle) => {
      const transform = (circle.parentElement as Element | null)?.getAttribute("style") ?? "";
      const match = transform.match(/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/);
      return match ? `${match[1]},${match[2]}` : "";
    },
  );
}

describe("BoardView", () => {
  it("shows a stack badge when two tokens share a cell", async () => {
    const container = await renderBoard();

    expect(hasStackBadge(container)).toBe(true);
  });

  it("hides the stack badge for the capture cell while a token is being kicked", async () => {
    const container = await renderBoard({ hiddenStackBadgeCellId: "T/8" });

    expect(hasStackBadge(container)).toBe(false);
  });

  it("excludes the animating token so no badge flashes over opponents mid-move", async () => {
    const container = await renderBoard({ animatingTokenId: "b1" });

    expect(hasStackBadge(container)).toBe(false);
  });

  it("fans finished tokens across the full home area in the winner state", async () => {
    const container = await renderBoard({
      tokens: [
        { id: "b1", color: "blue", cell: "H/1/4" },
        { id: "b2", color: "blue", cell: "H/1/4" },
        { id: "b3", color: "blue", cell: "H/1/4" },
        { id: "b4", color: "blue", cell: "H/1/4" },
      ],
    });

    const positions = tokenPositions(container);
    const expectedPositions = computeBoardLayout(4).homes[0]!.map((cell) => `${cell.x},${cell.y}`);

    expect(new Set(positions)).toEqual(new Set(expectedPositions));
    expect(hasStackBadge(container)).toBe(false);
  });

  it("spreads finished home tokens across the remaining home cells before the game ends", async () => {
    const container = await renderBoard({
      tokens: [
        { id: "b1", color: "blue", cell: "H/1/2" },
        { id: "b2", color: "blue", cell: "H/1/4" },
        { id: "b3", color: "blue", cell: "H/1/4" },
      ],
    });

    const positions = tokenPositions(container);
    const homeCells = computeBoardLayout(4).homes[0]!;
    const expectedPositions = [homeCells[1]!, homeCells[2]!, homeCells[3]!].map(
      (cell) => `${cell.x},${cell.y}`,
    );

    expect(new Set(positions)).toEqual(new Set(expectedPositions));
    expect(hasStackBadge(container)).toBe(false);
  });
});
