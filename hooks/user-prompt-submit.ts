import process from "node:process";
import { readStdin, approve, approveWithContext } from "../src/hook-io.ts";
import { readConfig, clearJustDisabled } from "../src/config.ts";
import { fullReminder } from "../src/prompt.ts";
import { createLogger } from "../src/log.ts";

const log = createLogger(import.meta);

const _input = await readStdin();
log("stdin:", JSON.stringify(_input));
const config = readConfig();
log(`enabled: ${config.enabled}`);

if (config.justDisabled) {
  clearJustDisabled();
  approveWithContext(
    "Voice feedback has been DISABLED. Stop adding 📢 summaries.",
  );
  process.exit(0);
}

if (!config.enabled) {
  approve();
  process.exit(0);
}

approveWithContext(fullReminder(config.prompt || undefined));
