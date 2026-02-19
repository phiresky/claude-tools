import { appendFileSync } from "node:fs";
import { basename } from "node:path";

const LOG_FILE = "/tmp/voice-playback.log";
const pid = Math.random().toString(36).slice(2, 6);

export function createLogger(meta: ImportMeta) {
  const source = basename(meta.filename ?? meta.url, ".ts");
  return (...args: unknown[]) => {
    const prefix = `[${new Date().toISOString()} ${pid}] [${source}]`;
    console.error("[voice]", prefix, ...args);
    try { appendFileSync(LOG_FILE, `${prefix} ${args.join(" ")}\n`); } catch {}
  };
}
