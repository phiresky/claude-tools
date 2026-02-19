import { spawn } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { readConfig } from "./config.ts";

const TTS_HOST = process.env.TTS_HOST ?? "localhost";
const TTS_PORT = process.env.TTS_PORT ?? "8000";

const LOCK_FILE = "/tmp/voice-playback.lock";

const log = (...args: unknown[]) => {
  console.error("[voice]", ...args);
  writeFile("/tmp/voice-playback.log", `[${new Date().toISOString()}] ${args.join(" ")}\n`, { flag: "a" }).catch(() => {});
}

async function isLockStale(): Promise<boolean> {
  let pid: string;
  try {
    pid = (await readFile(LOCK_FILE, "utf-8")).trim();
  } catch {
    return false; // No lock file
  }
  if (!pid) return true;
  try {
    process.kill(parseInt(pid, 10), 0);
    return false; // Process alive
  } catch {
    return true; // Process dead
  }
}

async function releaseLock(): Promise<void> {
  try {
    await unlink(LOCK_FILE);
  } catch (e) {
    log("failed to release lock:", e);
  }
}

async function acquireLock(maxWaitMs = 30_000): Promise<boolean> {
  const interval = 200;
  let elapsed = 0;

  while (true) {
    try {
      await writeFile(LOCK_FILE, String(process.pid), { flag: "wx" });
      return true;
    } catch {
      if (await isLockStale()) {
        log("removing stale lock (owner process dead)");
        await releaseLock();
        continue;
      }
      if (elapsed >= maxWaitMs) {
        log(`timed out waiting for lock after ${maxWaitMs}ms`);
        return false;
      }
      await setTimeout(interval);
      elapsed += interval;
    }
  }
}

function preprocessForTTS(text: string): string {
  return text
    // Strip markdown: bold, italic, backticks
    .replace(/[*_`~]+/g, "")
    // File extensions: .txt → " dot txt"
    .replace(/\.([a-zA-Z0-9]{1,10})\b/g, " dot $1")
    // Paths: collapse slashes to "slash"
    .replace(/\//g, " slash ")
    // Arrow functions / arrows
    .replace(/=>/g, "arrow")
    .replace(/->/g, "arrow")
    // Common operators
    .replace(/!=/g, " not equal ")
    .replace(/===/g, " triple equals ")
    .replace(/==/g, " equals ")
    // snake_case → spaces
    .replace(/(\w)_(\w)/g, "$1 $2")
    // camelCase → spaces (e.g. "myFunction" → "my Function")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fire-and-forget: spawns TTS as a fully detached process and returns immediately.
 * The hook process can exit without waiting for playback to finish.
 */
export function speakBackground(text: string, voice: string): void {
  const child = spawn(process.execPath, [import.meta.filename, voice], {
    detached: true,
    stdio: ["pipe", "ignore", "ignore"],
  });
  child.stdin!.end(text);
  child.unref();
}

export async function speak(text: string, voice: string): Promise<void> {
  const url = `http://${TTS_HOST}:${TTS_PORT}/tts`;
  const id = Math.random().toString(36).slice(2, 6);
  const startTime = performance.now();
  const processed = preprocessForTTS(text);
  log(`[${id}] speak (voice: ${voice}): "${processed}"`);

  if (!(await acquireLock())) {
    log(`[${id}] skipping speech: could not acquire lock`);
    return;
  }

  try {
    const curl = spawn(
      "curl",
      [
        "-sf",
        "--max-time",
        "30",
        "-X",
        "POST",
        url,
        "--form-string",
        `voice_url=${voice}`,
        "-F",
        "text=<-",
      ],
      { stdio: ["pipe", "pipe", "ignore"] },
    );

    const ffplay = spawn(
      "ffplay",
      ["-nodisp", "-autoexit", "-", "-flags", "low_delay", "-probesize", "32", "-analyzeduration", "0"],
      { stdio: ["pipe", "ignore", "pipe"] },
    );

    const stderrChunks: Buffer[] = [];
    ffplay.stderr!.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    curl.stdout!.pipe(ffplay.stdin!);
    curl.stdin!.end(processed);

    await new Promise<void>((resolve) => {
      ffplay.on("close", (code) => {
        if (code && code !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
          log(`[${id}] ffplay exited with code ${code}${stderr ? `: ${stderr}` : ""}`);
        }
        resolve();
      });
      ffplay.on("error", (e) => {
        log(`[${id}] ffplay error: ${e.message}`);
        resolve();
      });
      curl.on("error", (e) => {
        log(`[${id}] curl error: ${e.message}`);
        ffplay.kill();
        resolve();
      });
      curl.on("close", (code) => {
        if (code && code !== 0) log(`[${id}] curl exited with code ${code}`);
      });
    });
  } finally {
    log(`[${id}] done in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);
    await releaseLock();
  }
}

if (import.meta.main) {
  const voice = process.argv[2];

  // Read text from stdin (used by speakBackground) or fall back to a default
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf-8").trim() || "Hello, this is a test.";

  const config = readConfig();
  await speak(text, voice ?? config.voice);
}