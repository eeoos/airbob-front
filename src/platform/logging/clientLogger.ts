import { isTestEnvironment } from "../config/env";

type LogLevel = "warn" | "error";

interface ClientLogPayload {
  message: string;
  error?: unknown;
}

const emitLog = (level: LogLevel, payload: ClientLogPayload) => {
  if (isTestEnvironment()) {
    return;
  }

  const logger = level === "warn" ? console.warn : console.error;
  logger(payload.message, payload.error);
};

export const clientLogger = {
  warn: (payload: ClientLogPayload) => emitLog("warn", payload),
  error: (payload: ClientLogPayload) => emitLog("error", payload),
};
