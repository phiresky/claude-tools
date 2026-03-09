import process from "node:process";
import { readStdin, approve } from "../src/hook-io.ts";
import { readConfig, clearJustDisabled } from "../src/config.ts";
import { fullReminder } from "../src/prompt.ts";
import { createLogger } from "../src/log.ts";

const log = createLogger(import.meta);

const input = await readStdin();
log("stdin:", JSON.stringify(input));
const config = readConfig();
log(`mode: ${config.mode}`);

function approveWithHookContext(ctx: string): void {
  process.stdout.write(
    JSON.stringify({
      decision: "approve",
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: ctx,
      },
    }) + "\n",
  );
}

if (config.just_disabled) {
  clearJustDisabled();
  approveWithHookContext(
    "Voice feedback has been DISABLED. Stop adding 📢 summaries.",
  );
  process.exit(0);
}

if (config.mode === "off") {
  approve();
  process.exit(0);
}

const sessionId = String(input.session_id ?? "").slice(0, 4);
approveWithHookContext(fullReminder(config.mode, config.prompt || undefined, sessionId));
