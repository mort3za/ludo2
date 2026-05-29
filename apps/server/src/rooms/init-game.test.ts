import { describe, it, expect } from "vitest";
import { initGame } from "./init-game.js";
import { createRoom, addBotMember } from "./room.js";
import type { Rng } from "../game/rng/rng.js";

// Mock RNG that always rolls 3.
const mockRng: Rng = { random: () => 0.5, rollDie: () => 3 };

describe("initGame", () => {
  it("propagates personality from bot member to bot seat", () => {
    let room = createRoom("room-1", 2, 1000);

    // Add a bot with "aggressor" personality (injected for determinism).
    const result = addBotMember(room, () => "aggressor");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    room = result.room;

    const gameState = initGame(room, "game-1", mockRng);

    // Find the bot seat (should have playerId = "bot:1").
    const botSeat = gameState.seats.find((s) => s.playerId === "bot:1");
    expect(botSeat).toBeDefined();
    expect(botSeat?.personality).toBe("aggressor");
  });

  it("does not set personality on human seats", () => {
    const room = createRoom("room-1", 2, 1000);
    const gameState = initGame(room, "game-1", mockRng);

    // With no members, all seats are empty — no personality.
    const anyPersonality = gameState.seats.some((s) => s.personality !== undefined);
    expect(anyPersonality).toBe(false);
  });

  it("propagates different personalities correctly for multiple bots", () => {
    let room = createRoom("room-1", 4, 1000);

    // Add three bots with different personalities.
    const personalities = ["aggressor" as const, "defender" as const, "sprinter" as const];
    for (const pers of personalities) {
      const result = addBotMember(room, () => pers);
      expect(result.ok).toBe(true);
      if (result.ok) room = result.room;
    }

    const gameState = initGame(room, "game-1", mockRng);

    // Verify each bot seat has the correct personality.
    for (let i = 1; i <= 3; i++) {
      const botSeat = gameState.seats.find((s) => s.playerId === `bot:${i}`);
      expect(botSeat?.personality).toBe(personalities[i - 1]);
    }
  });
});
