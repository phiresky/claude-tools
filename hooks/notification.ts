import { readStdin } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { speakBackground } from "../src/tts.ts";
import { createLogger } from "../src/log.ts";

const log = createLogger(import.meta);

const input = await readStdin();
log("stdin:", JSON.stringify(input));
const config = readConfig();

if (!config.enabled) {
  process.exit(0);
}

const type = String(input.notification_type ?? "");
const message = String(input.message ?? "").trim();

log(`type: ${type}, message: "${message.slice(0, 80)}"`);
speakBackground(`${input.title ?? type}. ${message}`, config.voice);
