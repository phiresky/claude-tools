import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { speakBackground } from "./tts.ts";
import { readConfig } from "./config.ts";
import { createLogger } from "./log.ts";
import { narrateDir } from "./paths.ts";

const log = createLogger(import.meta);
const CONFIG_PATH = join(homedir(), ".claude", "voicy.json");

function writeVoiceConfig(obj: Record<string, unknown>) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  let existing: Record<string, unknown> = {};
  try { existing = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")); } catch {}
  const merged = { ...existing, ...obj };
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  return merged;
}

const server = new McpServer({
  name: "voicy",
  version: "1.0.0",
});

server.registerTool("narrate", {
  description: "Speak a short narration aloud via TTS. Call this before every tool use to narrate what you're about to do.",
  inputSchema: {
    text: z.string().describe("Short (5-10 word) description of what you're about to do"),
    tool: z.array(z.string()).describe("The tool name(s) you will call next (e.g. ['Read'] or ['Read', 'Read', 'Grep'] for parallel calls)"),
    session_id: z.string().describe("The current session ID"),
  },
}, async ({ text, tool, session_id }) => {
  const trimmed = text.trim();
  if (trimmed) {
    const config = readConfig();
    if (config.mode === "narrate" || config.mode === "always") {
      log(`narrate: "${trimmed}" (next tools: ${tool.join(",")}, session: ${session_id})`);
      const dir = narrateDir(session_id);
      mkdirSync(dir, { recursive: true });
      for (const t of tool) {
        const suffix = randomBytes(4).toString("hex");
        writeFileSync(join(dir, `${t}-${suffix}`), "");
      }
      try {
        await speakBackground(trimmed, config.voice);
      } catch (e) {
        const msg = (e as Error).message;
        log(`narrate error: ${msg}`);
        return { content: [{ type: "text", text: `TTS error: ${msg}` }], isError: true };
      }
    }
  }
  return { content: [{ type: "text", text: "Narration delivered." }] };
});

server.registerTool("configure", {
  description: "Configure voice feedback settings: enable/disable, change voice, set custom prompt.",
  inputSchema: {
    mode: z.enum(["off", "quiet", "narrate", "always"]).optional().describe("Voice mode: off (disabled), quiet (only stop summaries & notifications), narrate (encourages narration when natural), always (forces narration on every tool call)"),
    voice: z.string().optional().describe("Voice name to use (e.g. azelma, alba, azure)"),
    prompt: z.string().optional().describe("Custom instruction for voice summaries. Empty string to clear."),
  },
}, async ({ mode, voice, prompt }) => {
  const updates: Record<string, unknown> = {};
  if (typeof mode === "string") {
    updates.mode = mode;
    // Clean up legacy field
    updates.enabled = undefined;
  }
  if (typeof voice === "string") updates.voice = voice;
  if (typeof prompt === "string") updates.prompt = prompt || undefined;
  if (mode === "off") updates.just_disabled = true;

  const merged = writeVoiceConfig(updates);
  log(`configure: ${JSON.stringify(updates)}`);
  return { content: [{ type: "text", text: `Voice config updated: ${JSON.stringify(merged, null, 2)}` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
log("MCP server started");
