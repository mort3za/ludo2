import type { ClientMessage } from "@ludo/shared";

type Ok = { ok: true; message: ClientMessage };
type Err = { ok: false; error: string };
type ParseResult = Ok | Err;

const SIMPLE_TYPES = new Set([
  "ready",
  "start",
  "roll",
  "resync",
  "rematch",
  "add_bot",
  "debug_undo",
]);

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

  if (type === "remove_player") {
    if (typeof obj["playerId"] !== "string") {
      return { ok: false, error: "missing-playerId" };
    }
    return { ok: true, message: { type: "remove_player", playerId: obj["playerId"] } };
  }

  if (type === "set_name") {
    if (typeof obj["name"] !== "string") {
      return { ok: false, error: "missing-name" };
    }
    return { ok: true, message: { type: "set_name", name: obj["name"] } };
  }

  if (type === "set_options") {
    const options = obj["options"];
    if (typeof options !== "object" || options === null) {
      return { ok: false, error: "missing-options" };
    }
    const { wallEnabled, autoMoveEnabled, timerEnabled } = options as Record<string, unknown>;
    if (
      typeof wallEnabled !== "boolean" ||
      typeof autoMoveEnabled !== "boolean" ||
      typeof timerEnabled !== "boolean"
    ) {
      return { ok: false, error: "invalid-options" };
    }
    return {
      ok: true,
      message: { type: "set_options", options: { wallEnabled, autoMoveEnabled, timerEnabled } },
    };
  }

  if (type === "debug_set_state") {
    if (typeof obj["scenario"] !== "string") {
      return { ok: false, error: "missing-scenario" };
    }
    return { ok: true, message: { type: "debug_set_state", scenario: obj["scenario"] } };
  }

  if (type === "debug_set_dice") {
    const seat = obj["seat"];
    const value = obj["value"];
    if (typeof seat !== "number" || !Number.isInteger(seat)) {
      return { ok: false, error: "invalid-seat" };
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 6) {
      return { ok: false, error: "invalid-value" };
    }
    return { ok: true, message: { type: "debug_set_dice", seat, value } };
  }

  return { ok: false, error: "unknown-type" };
}
