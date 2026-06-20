type LogLevel = "info" | "warn" | "error";

const LOG_LEVEL = (process.env["LOG_LEVEL"] ?? "info") as LogLevel;
const levels = { info: 0, warn: 1, error: 2 };

function format(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const pairs = data
    ? " " +
      Object.entries(data)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(" ")
    : "";
  return `[${timestamp}] ${level.toUpperCase()}${pairs ? " " : ""}${message}${pairs}`;
}

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    if (levels[LOG_LEVEL] <= levels.info) console.log(format("info", message, data));
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    if (levels[LOG_LEVEL] <= levels.warn) console.warn(format("warn", message, data));
  },
  error: (message: string, data?: Record<string, unknown>) => {
    if (levels[LOG_LEVEL] <= levels.error) console.error(format("error", message, data));
  },
};
