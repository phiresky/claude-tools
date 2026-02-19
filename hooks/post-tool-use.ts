import { readStdin, approve, approveWithContext } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { shortReminder } from "../src/prompt.ts";

const _input = await readStdin();
const config = readConfig();

if (!config.enabled) {
  approve();
  process.exit(0);
}

approveWithContext(shortReminder());
