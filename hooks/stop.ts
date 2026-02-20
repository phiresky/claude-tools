import { rmSync } from "node:fs";
import { readStdin, stopResult } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { speakBackground } from "../src/tts.ts";
import { extractVoiceMarker } from "../src/session.ts";
import { createLogger } from "../src/log.ts";

const log = createLogger(import.meta);

const input = await readStdin();
log("stdin:", JSON.stringify(input));
const config = readConfig();

// Clean up narrate state files
const sessionId = String(input.session_id ?? "").slice(0, 4);
const dir = `/tmp/voice-narrate-${sessionId}`;
try { rmSync(dir, { recursive: true }); } catch {}

if (!config.enabled) {
  log("disabled, skipping");
  process.exit(0);
}

const message = String(input.last_assistant_message ?? "");
if (!message) {
  log("ERROR: no last_assistant_message in stdin");
  process.exit(1);
}

log(`message length: ${message.length} chars, ${message.trim().split(/\s+/).length} words`);

const MAX_WORDS = 25;
const MAX_SPOKEN = 37;

// Tier 1: Extract 📢 marker — speak it and allow stop
const marker = extractVoiceMarker(message);
if (marker) {
  const trimmed = marker.split(/\s+/).slice(0, MAX_SPOKEN).join(" ");
  log(`tier 1 (marker): "${trimmed}"`);
  speakBackground(trimmed, config.voice);
  process.exit(0);
}

// Tier 2: Short response — speak directly and allow stop
const words = message.trim().split(/\s+/);
if (words.length <= MAX_WORDS) {
  log(`tier 2 (short): "${message.trim().slice(0, 80)}"`);
  speakBackground(message.trim(), config.voice);
  process.exit(0);
}

// Tier 3: No marker on a long response — reject the stop
log("tier 3: rejecting stop (no 📢 marker)");
stopResult({ systemMessage: "You forgot to add a 📢 voice summary. Add one now." });
process.exit(2);
