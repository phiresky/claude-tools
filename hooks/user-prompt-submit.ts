import process from "node:process";
import { readStdin, approve, approveWithContext } from "../src/hook-io.ts";
import { readConfig, clearJustDisabled } from "../src/config.ts";
import { fullReminder } from "../src/prompt.ts";

const _input = await readStdin();
const config = readConfig();

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
