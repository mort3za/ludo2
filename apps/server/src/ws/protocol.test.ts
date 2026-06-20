import { describe, it, expect } from "vitest";
import { parseClientMessage } from "./protocol.js";

describe("parseClientMessage", () => {
  it("parses a valid ready message", () => {
    const result = parseClientMessage(JSON.stringify({ type: "ready" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toEqual({ type: "ready" });
  });

  it("parses a valid roll message", () => {
    const result = parseClientMessage(JSON.stringify({ type: "roll" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toEqual({ type: "roll" });
  });

  it("parses a valid move message", () => {
    const result = parseClientMessage(JSON.stringify({ type: "move", tokenId: "t1" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toEqual({ type: "move", tokenId: "t1" });
  });

  it("parses a valid rematch message", () => {
    const result = parseClientMessage(JSON.stringify({ type: "rematch" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toEqual({ type: "rematch" });
  });

  it("rejects invalid JSON", () => {
    const result = parseClientMessage("not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid-json");
  });

  it("rejects non-object payload", () => {
    const result = parseClientMessage(JSON.stringify("string"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid-format");
  });

  it("rejects unknown message type", () => {
    const result = parseClientMessage(JSON.stringify({ type: "unknown" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("unknown-type");
  });

  it("rejects move without tokenId", () => {
    const result = parseClientMessage(JSON.stringify({ type: "move" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("missing-tokenId");
  });

  it("rejects move with non-string tokenId", () => {
    const result = parseClientMessage(JSON.stringify({ type: "move", tokenId: 123 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("missing-tokenId");
  });

  it("parses a valid debug_set_state message", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "debug_set_state", scenario: "home-stretch" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toEqual({ type: "debug_set_state", scenario: "home-stretch" });
  });

  it("rejects debug_set_state without scenario", () => {
    const result = parseClientMessage(JSON.stringify({ type: "debug_set_state" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("missing-scenario");
  });

  it("parses a valid set_options message", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "set_options", options: { wallEnabled: true, autoMoveEnabled: false } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toEqual({
      type: "set_options",
      options: { wallEnabled: true, autoMoveEnabled: false },
    });
  });

  it("rejects set_options without options", () => {
    const result = parseClientMessage(JSON.stringify({ type: "set_options" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("missing-options");
  });

  it("rejects set_options with non-boolean fields", () => {
    const result = parseClientMessage(
      JSON.stringify({ type: "set_options", options: { wallEnabled: "yes", autoMoveEnabled: true } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid-options");
  });

  it("rejects null payload", () => {
    const result = parseClientMessage(JSON.stringify(null));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid-format");
  });
});
