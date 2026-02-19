import { readStdin } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { speakBackground } from "../src/tts.ts";
import { createLogger } from "../src/log.ts";

const log = createLogger(import.meta);

const input = await readStdin();
log("stdin:", JSON.stringify(input));
const config = readConfig();

if (!config.enabled) {
  process.exit(0);
}

const toolName = input.tool_name ?? "";
const toolInput = input.tool_input ?? {};
log(`tool: ${toolName}`);

if (toolName === "AskUserQuestion") {
  const questions = toolInput.questions as
    | Array<{ question: string }>
    | undefined;
  if (questions?.length) {
    const text = questions.map((q) => q.question).join(". ");
    speakBackground(text, config.voice);
  }
} else if (toolName === "Bash") {
  const desc = String(toolInput.description ?? "").trim();
  if (desc) {
    speakBackground(`Running a command to ${desc.toLowerCase()}`, config.voice);
  } else {
    speakBackground("Running a command", config.voice);
  }
} else if (toolName === "Write") {
  const filePath = String(toolInput.file_path ?? "");
  const fileName = filePath.split("/").pop() ?? filePath;
  speakBackground(`Writing to ${fileName}`, config.voice);
} else if (toolName === "Edit") {
  const filePath = String(toolInput.file_path ?? "");
  const fileName = filePath.split("/").pop() ?? filePath;
  speakBackground(`Editing ${fileName}.`, config.voice);
} else if (toolName === "Read") {
  const filePath = String(toolInput.file_path ?? "");
  const fileName = filePath.split("/").pop() ?? filePath;
  const limit = toolInput.limit as number | undefined;
  if (limit) {
    speakBackground(`Reading ${limit} lines from ${fileName}`, config.voice);
  } else {
    speakBackground(`Reading ${fileName}`, config.voice);
  }
} else if (toolName === "NotebookEdit") {
  const filePath = String(toolInput.notebook_path ?? "");
  const fileName = filePath.split("/").pop() ?? filePath;
  speakBackground(`Editing notebook ${fileName}`, config.voice);
} else if (toolName === "WebFetch") {
  const url = String(toolInput.url ?? "");
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  if (host) {
    speakBackground(`Fetching from ${host}`, config.voice);
  } else {
    speakBackground("Fetching a web page", config.voice);
  }
} else if (toolName === "WebSearch") {
  const query = String(toolInput.query ?? "");
  if (query) {
    speakBackground(`Searching the web for ${query}`, config.voice);
  } else {
    speakBackground("Searching the web", config.voice);
  }
} else if (toolName) {
  const friendly = toolName.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  speakBackground(`Tool: ${friendly}`, config.voice);
} else {
  speakBackground("Using a tool", config.voice);
}
