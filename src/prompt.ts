import type { VoiceMode } from "./config.ts";

const MAX_SPOKEN_WORDS = 25;

export function fullReminder(mode: VoiceMode, customPrompt?: string, sessionId?: string): string {
  // Summary prompt — shared by quiet, narrate, and always
  let reminder =
    "Voice feedback is enabled. At the end of your response:\n" +
    `- If ≤25 words of natural speakable text, no summary needed\n` +
    `- If ≤25 words but contains code/paths/technical output, ADD a 📢 summary\n` +
    "- If longer, end with: 📢 [brief spoken summary]\n\n" +
    "VOICE SUMMARY STYLE:\n" +
    "- Match the user's tone - if they're casual or use colorful language, mirror that\n" +
    "- Keep it brief and conversational, like you're speaking to them\n" +
    "- NEVER include file paths, UUIDs, hashes, or technical identifiers - " +
    "use natural language instead (e.g., 'the config file' not '/Users/foo/bar/config.json')";

  if (mode === "narrate") {
    reminder +=
      "\n\nTOOL USE VOICE NARRATION:\n" +
      "You have a narrate MCP tool available. When it feels natural, call it " +
      "IN PARALLEL with your other tool calls to give a brief spoken description " +
      "of what you're about to do. This is optional — use your judgment.\n" +
      "The 'tool' parameter is an array of ALL tool names in the same message " +
      "(e.g. ['Read', 'Read', 'Grep'] for parallel calls).\n" +
      "One narration covers all tool calls in the same message.\n" +
      "You MUST also pass the 'session_id' parameter.\n" +
      (sessionId ? `Your session_id is: ${sessionId}\n` : "") +
      "Keep narrations natural and concise (5-10 words).";
  } else if (mode === "always") {
    reminder +=
      "\n\nTOOL USE VOICE NARRATION:\n" +
      "ALWAYS call the narrate MCP tool IN PARALLEL with your other tool calls.\n" +
      "Include narrate in the SAME message as the tools it covers — do NOT call narrate " +
      "first and wait for it.\n" +
      "The 'tool' parameter is an array of ALL tool names in the same message " +
      "(e.g. ['Read', 'Read', 'Grep'] for parallel calls).\n" +
      "One narration covers all tool calls in the same message.\n" +
      "You MUST also pass the 'session_id' parameter.\n" +
      (sessionId ? `Your session_id is: ${sessionId}\n` : "") +
      "Do this for every tool call without exception. Keep narrations natural " +
      "and concise (5-10 words).";
  }
  // quiet mode: no narration section at all

  if (customPrompt) {
    reminder +=
      "\n\nCUSTOM VOICE INSTRUCTION (overrides above instructions if they " +
      `contradict): ${customPrompt}`;
  }

  return reminder;
}

export function shortReminder(mode: VoiceMode, sessionId?: string): string {
  let r =
    `[Voice feedback: when done, end with 📢 summary (max ${MAX_SPOKEN_WORDS} words) ` +
    `if response is >${MAX_SPOKEN_WORDS} words or contains code/paths]`;
  if (mode === "narrate") {
    r += `\n[Narrate tool calls when it feels natural]`;
  } else if (mode === "always") {
    r += `\n[ALWAYS narrate tool calls]`;
  }
  if (sessionId) r += `\n[Your session_id is: ${sessionId}]`;
  return r;
}
