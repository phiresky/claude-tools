import { readStdin, approve } from "../src/hook-io.ts";
import { readConfig } from "../src/config.ts";
import { speak } from "../src/tts.ts";

const input = await readStdin();
const config = readConfig();

if (!config.enabled) {
  approve();
  process.exit(0);
}

const toolName = input.tool_name ?? "";
const toolInput = input.tool_input ?? {};

if (toolName === "AskUserQuestion") {
  const questions = toolInput.questions as
    | Array<{ question: string }>
    | undefined;
  if (questions?.length) {
    const text = questions.map((q) => q.question).join(". ");
    speak(text, config.voice);
  }
} else if (toolName === "Bash") {
  const cmd = String(toolInput.command ?? "")
    .split(/\s+/)
    .slice(0, 10)
    .join(" ");
  speak(`Running a command: ${cmd}`, config.voice);
} else if (toolName === "Write") {
  const filePath = String(toolInput.file_path ?? "");
  const fileName = filePath.split("/").pop() ?? filePath;
  speak(`Writing to ${fileName}`, config.voice);
} else if (toolName === "Edit") {
  const filePath = String(toolInput.file_path ?? "");
  const fileName = filePath.split("/").pop() ?? filePath;
  speak(`Editing ${fileName}`, config.voice);
} else if (toolName === "NotebookEdit") {
  const filePath = String(toolInput.notebook_path ?? "");
  const fileName = filePath.split("/").pop() ?? filePath;
  speak(`Editing notebook ${fileName}`, config.voice);
}

approve();
