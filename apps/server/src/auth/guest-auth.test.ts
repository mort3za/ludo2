import { describe, it, expect, beforeAll } from "vitest";
import { createGuestAuth, type GuestAuth } from "./guest-auth.js";

describe("guest auth", () => {
  let auth: GuestAuth;

  beforeAll(() => {
    auth = createGuestAuth("test-secret-key-at-least-32-chars!");
  });

  describe("issue", () => {
    it("issues a JWT with playerId and name", async () => {
      const token = await auth.issue("player-1", "Alice");
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // header.payload.signature
    });
  });

  describe("verify", () => {
    it("verifies a valid token and returns claims", async () => {
      const token = await auth.issue("player-1", "Alice");
      const result = await auth.verify(token);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.playerId).toBe("player-1");
      expect(result.name).toBe("Alice");
    });

    it("rejects a tampered token", async () => {
      const token = await auth.issue("player-1", "Alice");
      const tampered = token.slice(0, -5) + "XXXXX";
      const result = await auth.verify(tampered);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("invalid-token");
    });

    it("rejects a token signed with a different secret", async () => {
      const otherAuth = createGuestAuth("other-secret-key-at-least-32-chars!");
      const token = await otherAuth.issue("player-1", "Alice");
      const result = await auth.verify(token);
      expect(result.ok).toBe(false);
    });

    it("rejects garbage input", async () => {
      const result = await auth.verify("not-a-jwt");
      expect(result.ok).toBe(false);
    });
  });

  describe("expired tokens", () => {
    it("rejects an expired token", async () => {
      const shortAuth = createGuestAuth("test-secret-key-at-least-32-chars!", "1s");
      const token = await shortAuth.issue("player-1", "Alice");
      // Wait for token to expire
      await new Promise((r) => setTimeout(r, 1100));
      const result = await shortAuth.verify(token);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("expired-token");
    });
  });

  describe("refresh", () => {
    it("issues a new token from an existing valid token", async () => {
      const token = await auth.issue("player-1", "Alice");
      const newToken = await auth.refresh(token);
      expect(newToken.ok).toBe(true);
      if (!newToken.ok) return;
      expect(typeof newToken.token).toBe("string");
      // Verify the new token works
      const result = await auth.verify(newToken.token);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.playerId).toBe("player-1");
      expect(result.name).toBe("Alice");
    });

    it("rejects refresh of invalid token", async () => {
      const result = await auth.refresh("garbage");
      expect(result.ok).toBe(false);
    });
  });
});
