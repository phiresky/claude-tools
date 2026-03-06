import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { readStdin } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { speakBackground } from "../src/tts.ts";
import { createLogger } from "../src/log.ts";
import { RUNTIME_DIR } from "../src/paths.ts";

const log = createLogger(import.meta);

const input = await readStdin();
log("stdin:", JSON.stringify(input));
const config = readConfig();

if (config.mode === "off") {
  process.exit(0);
}

const type = String(input.notification_type ?? "");
let message = String(input.message ?? "").trim();

// For permission prompts, try to read the richer tool description stashed by pre-tool-use
if (type === "permission_prompt") {
  const sessionId = String(input.session_id ?? "").slice(0, 4);
  const descFile = join(RUNTIME_DIR, `last-tool-desc-${sessionId}`);
  try {
    const desc = readFileSync(descFile, "utf-8").trim();
    unlinkSync(descFile);
    if (desc) message = `Needs permission: ${desc}`;
  } catch {}
}

log(`type: ${type}, message: "${message.slice(0, 80)}"`);
speakBackground(`${input.title ?? type}. ${message}`, config.voice);
