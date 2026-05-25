import { parseCell, type Cell, type GameStatus } from "@ludo/shared";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GAME_STATUSES = new Set<GameStatus>([
  "waiting",
  "tiebreaker",
  "rolling",
  "moving",
  "finished",
]);

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

export interface DebugTokenOverride {
  id: string;
  cell: Cell;
}

export interface DebugStartState {
  status?: GameStatus;
  activeSeat?: number;
  diceValue?: number | null;
  consecutiveSixes?: number;
  standings?: number[];
  tokens?: DebugTokenOverride[];
}

export function getDebugStartStateFilePath(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const rawPath = env["DEBUG_START_STATE_FILE"]?.trim();
  if (!rawPath) {
    return null;
  }

  return isAbsolute(rawPath) ? rawPath : resolve(REPO_ROOT, rawPath);
}

export function loadDebugStartState(filePath: string | null | undefined): DebugStartState | null {
  if (!filePath) {
    return null;
  }

  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return parseDebugStartState(parsed);
}

function parseDebugStartState(value: unknown): DebugStartState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Debug start state must be an object");
  }

  const input = value as Record<string, unknown>;
  const result: DebugStartState = {};

  if (input["status"] !== undefined) {
    if (typeof input["status"] !== "string" || !GAME_STATUSES.has(input["status"] as GameStatus)) {
      throw new Error(`Invalid debug status: ${String(input["status"])}`);
    }
    result.status = input["status"] as GameStatus;
  }

  if (input["activeSeat"] !== undefined) {
    if (!Number.isInteger(input["activeSeat"]) || (input["activeSeat"] as number) < 1) {
      throw new Error(`Invalid debug activeSeat: ${String(input["activeSeat"])}`);
    }
    result.activeSeat = input["activeSeat"] as number;
  }

  if (input["diceValue"] !== undefined) {
    const diceValue = input["diceValue"];
    if (
      diceValue !== null &&
      (!Number.isInteger(diceValue) || (diceValue as number) < 1 || (diceValue as number) > 6)
    ) {
      throw new Error(`Invalid debug diceValue: ${String(diceValue)}`);
    }
    result.diceValue = diceValue as number | null;
  }

  if (input["consecutiveSixes"] !== undefined) {
    if (!Number.isInteger(input["consecutiveSixes"]) || (input["consecutiveSixes"] as number) < 0) {
      throw new Error(`Invalid debug consecutiveSixes: ${String(input["consecutiveSixes"])}`);
    }
    result.consecutiveSixes = input["consecutiveSixes"] as number;
  }

  if (input["standings"] !== undefined) {
    if (!Array.isArray(input["standings"])) {
      throw new Error("Invalid debug standings: expected array");
    }
    for (const seat of input["standings"]) {
      if (!Number.isInteger(seat) || seat < 1) {
        throw new Error(`Invalid debug standings seat: ${String(seat)}`);
      }
    }
    result.standings = [...(input["standings"] as number[])];
  }

  if (input["tokens"] !== undefined) {
    if (!Array.isArray(input["tokens"])) {
      throw new Error("Invalid debug tokens: expected array");
    }

    result.tokens = input["tokens"].map((entry) => parseDebugTokenOverride(entry));
  }

  return result;
}

function parseDebugTokenOverride(value: unknown): DebugTokenOverride {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid debug token override: expected object");
  }

  const entry = value as Record<string, unknown>;
  if (typeof entry["id"] !== "string" || entry["id"].length === 0) {
    throw new Error("Invalid debug token id");
  }
  if (typeof entry["cell"] !== "string" || entry["cell"].length === 0) {
    throw new Error(`Invalid debug token cell for ${entry["id"]}`);
  }

  parseCell(entry["cell"]);

  return {
    id: entry["id"],
    cell: entry["cell"],
  };
}
