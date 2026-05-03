import type { ClientMessage } from "@ludo/shared";

type Ok = { ok: true; message: ClientMessage };
type Err = { ok: false; error: string };
type ParseResult = Ok | Err;

const SIMPLE_TYPES = new Set(["ready", "start", "roll", "rematch"]);

export function parseClientMessage(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid-json" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "invalid-format" };
  }

  const obj = parsed as Record<string, unknown>;
  const { type } = obj;

  if (typeof type !== "string") {
    return { ok: false, error: "invalid-format" };
  }

  if (SIMPLE_TYPES.has(type)) {
    return { ok: true, message: { type } as ClientMessage };
  }

  if (type === "move") {
    if (typeof obj["tokenId"] !== "string") {
      return { ok: false, error: "missing-tokenId" };
    }
    return { ok: true, message: { type: "move", tokenId: obj["tokenId"] } };
  }

  return { ok: false, error: "unknown-type" };
}
