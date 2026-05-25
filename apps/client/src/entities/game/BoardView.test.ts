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

async function renderBoard(options?: { hiddenStackBadgeCellId?: string; tokens?: Token[] }) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const app = createApp(BoardView, {
    boardSize: 4,
    tokens: options?.tokens ?? tokens,
    seats,
    hiddenStackBadgeCellId: options?.hiddenStackBadgeCellId,
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

describe("BoardView", () => {
  it("shows a stack badge when two tokens share a cell", async () => {
    const container = await renderBoard();

    expect(hasStackBadge(container)).toBe(true);
  });

  it("hides the stack badge for the capture cell while a token is being kicked", async () => {
    const container = await renderBoard({ hiddenStackBadgeCellId: "T/8" });

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

    const tokenPositions = [...container.querySelectorAll('circle[stroke="#1a1816"]')].map(
      (element) => `${element.getAttribute("cx")},${element.getAttribute("cy")}`,
    );
    const expectedPositions = computeBoardLayout(4).homes[0]!.map((cell) => `${cell.x},${cell.y}`);

    expect(new Set(tokenPositions)).toEqual(new Set(expectedPositions));
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

    const tokenPositions = [...container.querySelectorAll('circle[stroke="#1a1816"]')].map(
      (element) => `${element.getAttribute("cx")},${element.getAttribute("cy")}`,
    );
    const homeCells = computeBoardLayout(4).homes[0]!;
    const expectedPositions = [homeCells[1]!, homeCells[2]!, homeCells[3]!].map(
      (cell) => `${cell.x},${cell.y}`,
    );

    expect(new Set(tokenPositions)).toEqual(new Set(expectedPositions));
    expect(hasStackBadge(container)).toBe(false);
  });
});
