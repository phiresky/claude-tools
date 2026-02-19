import { readStdin } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { shortReminder } from "../src/prompt.ts";
import { createLogger } from "../src/log.ts";

const log = createLogger(import.meta);

const input = await readStdin();
log("stdin:", JSON.stringify(input));
const config = readConfig();

log(`tool: ${input.tool_name ?? "unknown"}`);

if (!config.enabled) {
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: shortReminder(),
    },
  }) + "\n",
);
