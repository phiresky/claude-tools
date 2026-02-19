import { execSync } from "node:child_process";
import { readStdin, stopResult } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { speak } from "../src/tts.ts";
import { getLastAssistantMessage, extractVoiceMarker } from "../src/session.ts";

const input = await readStdin();
const config = readConfig();

if (!config.enabled) {
  process.exit(0);
}

const sessionId = input.session_id;
if (!sessionId) {
  process.exit(0);
}

const message = await getLastAssistantMessage(sessionId);
if (!message) {
  process.exit(0);
}

const MAX_WORDS = 25;
const MAX_SPOKEN = 37;

// Tier 1: Extract 📢 marker
const marker = extractVoiceMarker(message);
if (marker) {
  const trimmed = marker.split(/\s+/).slice(0, MAX_SPOKEN).join(" ");
  await speak(trimmed, config.voice);
  process.exit(0);
}

// Tier 2: Short response — speak directly
const words = message.trim().split(/\s+/);
if (words.length <= MAX_WORDS) {
  await speak(message.trim(), config.voice);
  process.exit(0);
}

// Tier 3: Headless Claude summarization
try {
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
    await speak(summary, config.voice);
    stopResult({ systemMessage: `🔊 ${summary}` });
    process.exit(0);
  }
} catch {
  // Fall through to tier 4
}

// Tier 4: Truncate to 25 words
const truncated = words.slice(0, MAX_WORDS).join(" ") + "...";
await speak(truncated, config.voice);
