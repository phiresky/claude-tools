import { readFileSync, readdirSync, statSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { homedir } from "node:os";
import { join } from "node:path";

function findSessionFile(sessionId: string): string | null {
  const projectsDir = join(homedir(), ".claude", "projects");
  let dirs: string[];
  try {
    dirs = readdirSync(projectsDir);
  } catch {
    return null;
  }
  for (const project of dirs) {
    const candidate = join(projectsDir, project, "sessions", `${sessionId}.jsonl`);
    try {
      statSync(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function readLastAssistant(sessionId: string): string | null {
  const sessionPath = findSessionFile(sessionId);
  if (!sessionPath) return null;

  let content: string;
  try {
    content = readFileSync(sessionPath, "utf-8");
  } catch {
    return null;
  }

  const lines = content.trim().split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === "assistant" && entry.message?.content) {
        const c = entry.message.content;
        if (typeof c === "string") return c;
        if (Array.isArray(c)) {
          return c
            .filter((b: { type: string }) => b.type === "text")
            .map((b: { text: string }) => b.text)
            .join("\n");
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function getLastAssistantMessage(
  sessionId: string,
): Promise<string | null> {
  const maxWait = 5000;
  const interval = 250;
  let elapsed = 0;

  while (elapsed <= maxWait) {
    const msg = readLastAssistant(sessionId);
    if (msg !== null) return msg;
    await setTimeout(interval);
    elapsed += interval;
  }
  return null;
}

export function extractVoiceMarker(text: string): string | null {
  const match = text.match(/^[ \t]*📢[ \t]*(.+?)[ \t]*$/m);
  return match ? match[1].trim() : null;
}
