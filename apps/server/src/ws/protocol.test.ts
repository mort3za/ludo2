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

  it("rejects null payload", () => {
    const result = parseClientMessage(JSON.stringify(null));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid-format");
  });
});
