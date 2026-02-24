import { unlinkSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readStdin, block } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { createLogger } from "../src/log.ts";
import { narrateDir } from "../src/paths.ts";

const log = createLogger(import.meta);
const NARRATE_WINDOW_MS = 60_000;
const RETRY_DELAY_MS = 100;
const MAX_RETRIES = 3_000 / RETRY_DELAY_MS;

const input = await readStdin();
log("stdin:", JSON.stringify(input));
const config = readConfig();

// Only narrate/always modes care about narration
if (config.mode !== "narrate" && config.mode !== "always") {
  process.exit(0);
}

const toolName = input.tool_name ?? "";
const sessionId = String(input.session_id ?? "").slice(0, 4);
log(`tool: ${toolName}`);

// Skip narration for voicy MCP tools
if (toolName.startsWith("mcp__plugin_voicy_voicy__")) {
  process.exit(0);
}

const dir = narrateDir(sessionId);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Try to consume one matching narrate file (atomic via unlink)
function tryConsume(): boolean {
  let files: string[];
  try {
    files = readdirSync(dir).filter(f => f.startsWith(`${toolName}-`));
  } catch {
    return false;
  }
  for (const file of files) {
    const path = join(dir, file);
    try {
      const mtime = statSync(path).mtimeMs;
      if (Date.now() - mtime > NARRATE_WINDOW_MS) continue;
      unlinkSync(path);
      return true; // we consumed it
    } catch {
      continue; // ENOENT — another hook consumed it, try next
    }
  }
  return false;
}

if (config.mode === "narrate") {
  // Soft mode: consume if available, never block
  tryConsume();
  process.exit(0);
}

// always mode: enforce narration
let narrated = tryConsume();
if (!narrated) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    log(`waiting for narrate (attempt ${i + 1}/${MAX_RETRIES})...`);
    await sleep(RETRY_DELAY_MS);
    narrated = tryConsume();
    if (narrated) break;
  }
}

if (narrated) {
  log("narrate matched, allowing");
  process.exit(0);
}

// Block tool calls that weren't preceded by a narrate call
log("blocking tool call (no matching narrate)");
block("You must call the narrate tool IN PARALLEL with your other tool calls. Pass all tool name(s) in the 'tool' array parameter. Include narrate in the same message, then retry.");
