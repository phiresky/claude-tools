import { execSync } from "node:child_process";
import { readStdin, stopResult } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { speakBackground } from "../src/tts.ts";
import { getLastAssistantMessage, extractVoiceMarker } from "../src/session.ts";
import { createLogger } from "../src/log.ts";

const log = createLogger(import.meta);

const input = await readStdin();
log("stdin:", JSON.stringify(input));
const config = readConfig();

if (!config.enabled) {
  log("disabled, skipping");
  process.exit(0);
}

const sessionId = input.session_id;
if (!sessionId) {
  log("no session_id, skipping");
  process.exit(0);
}

const message = await getLastAssistantMessage(sessionId);
if (!message) {
  log("no assistant message found");
  process.exit(0);
}

log(`message length: ${message.length} chars, ${message.trim().split(/\s+/).length} words`);

const MAX_WORDS = 25;
const MAX_SPOKEN = 37;

// Tier 1: Extract 📢 marker
const marker = extractVoiceMarker(message);
if (marker) {
  const trimmed = marker.split(/\s+/).slice(0, MAX_SPOKEN).join(" ");
  log(`tier 1 (marker): "${trimmed}"`);
  speakBackground(trimmed, config.voice);
  process.exit(0);
}

// Tier 2: Short response — speak directly
const words = message.trim().split(/\s+/);
if (words.length <= MAX_WORDS) {
  log(`tier 2 (short): "${message.trim().slice(0, 80)}"`);
  speakBackground(message.trim(), config.voice);
  process.exit(0);
}

// Tier 3: Headless Claude summarization
try {
  log("tier 3: requesting Claude summarization");
  const prompt =
    `Summarize this in one casual, conversational sentence ` +
    `(max ${MAX_WORDS} words). No file paths or technical jargon. ` +
    `Just the gist:\n\n${message.slice(0, 2000)}`;

  const result = execSync("claude -p --output-format json", {
    input: prompt,
    encoding: "utf-8",
    timeout: 45_000,
  });

  const parsed = JSON.parse(result);
  const summary: string = parsed.result ?? parsed.text ?? "";
  if (summary) {
    log(`tier 3 (summary): "${summary}"`);
    speakBackground(summary, config.voice);
    stopResult({ systemMessage: `🔊 ${summary}` });
    process.exit(0);
  }
} catch (e) {
  log(`tier 3 failed: ${e instanceof Error ? e.message : e}`);
  // Fall through to tier 4
}

// Tier 4: Truncate to 25 words
const truncated = words.slice(0, MAX_WORDS).join(" ") + "...";
log(`tier 4 (truncated): "${truncated}"`);
speakBackground(truncated, config.voice);
