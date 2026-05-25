import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { getDebugStartStateFilePath, loadDebugStartState } from "./debug-start-state.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../../tests/fixtures");

describe("debug start state config", () => {
  it("returns null when the config value is empty", () => {
    expect(getDebugStartStateFilePath({ DEBUG_START_STATE_FILE: "" })).toBeNull();
    expect(getDebugStartStateFilePath({})).toBeNull();
  });

  it("resolves a relative config path from the repo root", () => {
    const result = getDebugStartStateFilePath({
      DEBUG_START_STATE_FILE: "tests/fixtures/mock-state-all-near-finish.json",
    });

    expect(result).toBe(resolve(FIXTURES_DIR, "mock-state-all-near-finish.json"));
  });

  it("loads a fixture file when a path is configured", () => {
    const fixturePath = resolve(FIXTURES_DIR, "mock-state-all-near-finish.json");

    const result = loadDebugStartState(fixturePath);

    expect(result?.status).toBe("moving");
    expect(result?.tokens).toContainEqual({ id: "1-1", cell: "H/1/3" });
  });

  it("fails fast when the configured fixture is malformed", () => {
    const fixturePath = resolve(FIXTURES_DIR, "mock-state-invalid.json");

    expect(() => loadDebugStartState(fixturePath)).toThrow("Invalid debug activeSeat");
  });
});
