const MAX_SPOKEN_WORDS = 25;

export function fullReminder(customPrompt?: string): string {
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

  if (customPrompt) {
    reminder +=
      "\n\nCUSTOM VOICE INSTRUCTION (overrides above instructions if they " +
      `contradict): ${customPrompt}`;
  }

  return reminder;
}

export function shortReminder(): string {
  return (
    `[Voice feedback: when done, end with 📢 summary (max ${MAX_SPOKEN_WORDS} words) ` +
    `if response is >${MAX_SPOKEN_WORDS} words or contains code/paths]`
  );
}
