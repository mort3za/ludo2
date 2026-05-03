import { describe, it, expect } from "vitest";
import { createSeededRng, createCryptoRng, type Rng } from "./rng.js";

describe("createSeededRng", () => {
  it("returns values in [0, 1)", () => {
    const rng = createSeededRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = createSeededRng(123);
    const b = createSeededRng(123);
    for (let i = 0; i < 50; i++) {
      expect(a.random()).toBe(b.random());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    const aValues = Array.from({ length: 10 }, () => a.random());
    const bValues = Array.from({ length: 10 }, () => b.random());
    expect(aValues).not.toEqual(bValues);
  });

  it("rollDie returns values in [1, sides]", () => {
    const rng = createSeededRng(99);
    for (let i = 0; i < 200; i++) {
      const v = rng.rollDie(6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("rollDie covers all faces over enough rolls", () => {
    const rng = createSeededRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      seen.add(rng.rollDie(6));
    }
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("rollDie is deterministic for the same seed", () => {
    const a = createSeededRng(55);
    const b = createSeededRng(55);
    for (let i = 0; i < 30; i++) {
      expect(a.rollDie(6)).toBe(b.rollDie(6));
    }
  });
});

describe("createCryptoRng", () => {
  it("returns values in [0, 1)", () => {
    const rng = createCryptoRng();
    for (let i = 0; i < 100; i++) {
      const v = rng.random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("rollDie returns values in [1, sides]", () => {
    const rng = createCryptoRng();
    for (let i = 0; i < 100; i++) {
      const v = rng.rollDie(6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe("Rng interface", () => {
  it("seeded rng satisfies the Rng interface", () => {
    const rng: Rng = createSeededRng(1);
    expect(typeof rng.random).toBe("function");
    expect(typeof rng.rollDie).toBe("function");
  });

  it("crypto rng satisfies the Rng interface", () => {
    const rng: Rng = createCryptoRng();
    expect(typeof rng.random).toBe("function");
    expect(typeof rng.rollDie).toBe("function");
  });
});
