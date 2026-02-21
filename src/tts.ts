import { spawn, execFile as execFileCb } from "node:child_process";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import { writeFile, readFile, unlink, open, mkdir } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { join } from "node:path";
import { readConfig } from "./config.ts";
import { createLogger } from "./log.ts";
import { RUNTIME_DIR, STATE_DIR } from "./paths.ts";

const log = createLogger(import.meta);

const execFile = promisify(execFileCb);

const TTS_HOST = process.env.TTS_HOST ?? "localhost";
const TTS_PORT = process.env.TTS_PORT ?? "8000";

const SPEAK_HOST = process.env.SPEAK_HOST;
const SPEAK_PORT = process.env.SPEAK_PORT ?? "7700";

const LOCK_FILE = join(RUNTIME_DIR, "playback.lock");
const SERVER_LOG = join(STATE_DIR, "pocket-tts.log");

async function startServer(): Promise<void> {
  log("pocket-tts server not responding, starting via uvx...");
  await mkdir(STATE_DIR, { recursive: true });
  const logFd = await open(SERVER_LOG, "a");
  const child = spawn("uvx", ["pocket-tts", "serve", "--host", TTS_HOST, "--port", TTS_PORT], {
    detached: true,
    stdio: ["ignore", logFd.fd, logFd.fd],
  });

  let exited = false;
  child.on("error", (e) => {
    exited = true;
    log(`failed to spawn uvx: ${e.message}`);
  });
  child.on("exit", (code) => {
    exited = true;
    if (code) log(`uvx exited with code ${code} (see ${SERVER_LOG})`);
    logFd.close().catch(() => {});
  });
  child.unref();

  const maxWait = 300_000;
  const interval = 1_000;
  let waited = 0;
  while (waited < maxWait) {
    await setTimeout(interval);
    waited += interval;
    if (exited) {
      throw new Error(`pocket-tts process exited unexpectedly (see ${SERVER_LOG})`);
    }
    try {
      const res = await fetch(`http://${TTS_HOST}:${TTS_PORT}/health`, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) {
        log(`pocket-tts server ready after ${waited / 1000}s`);
        return;
      }
    } catch {}
    if (waited % 5_000 === 0) {
      log(`waiting for pocket-tts server... (${waited / 1000}s)`);
    }
  }
  throw new Error(`pocket-tts server failed to start within ${maxWait / 1000}s (see ${SERVER_LOG})`);
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

  await mkdir(RUNTIME_DIR, { recursive: true });
  while (true) {
    try {
      await writeFile(LOCK_FILE, String(process.pid), { flag: "wx" });
      if (elapsed > 0) log(`lock acquired after ${elapsed}ms wait`);
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
    // Strip markdown: bold, backticks, strikethrough (not underscores — handled by snake_case rule)
    .replace(/[*`~]+/g, "")
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
    // Underscores (snake_case, mcp__names) → spaces
    .replace(/_+/g, " ")
    // camelCase → spaces (e.g. "myFunction" → "my Function")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // Acronyms that TTS should spell out
    .replace(/\bmcp\b/gi, "MCP")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fire-and-forget: spawns TTS as a fully detached process and returns immediately.
 * The hook process can exit without waiting for playback to finish.
 */
export async function speakBackground(text: string, voice: string): Promise<void> {
  if (SPEAK_HOST) {
    const url = `http://${SPEAK_HOST}:${SPEAK_PORT}/speak`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`speak-server returned ${res.status}: ${body}`);
    }
    return;
  }

  const child = spawn(process.execPath, [import.meta.filename, voice], {
    detached: true,
    stdio: ["pipe", "ignore", "ignore"],
  });
  child.stdin!.end(text);
  child.unref();
}

function isConnectionError(e: unknown): boolean {
  const code = (e as NodeJS.ErrnoException)?.cause && ((e as any).cause as NodeJS.ErrnoException)?.code;
  return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ENOTFOUND";
}

async function fetchTTS(url: string, voice: string, text: string): Promise<Response> {
  const form = new FormData();
  form.append("voice_url", voice);
  form.append("text", text);
  return fetch(url, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
}

const DUCK_FACTOR = 0.2; // reduce other audio to 20% of current volume

async function duckOtherAudio(): Promise<() => Promise<void>> {
  try {
    const { stdout } = await execFile("pactl", ["-f", "json", "list", "sink-inputs"]);
    const sinkInputs: Array<{
      index: number;
      volume: Record<string, { value: number; value_percent: string }>;
    }> = JSON.parse(stdout);

    const ducked: Array<{ index: number; channelPercents: number[] }> = [];

    for (const input of sinkInputs) {
      const channels = Object.values(input.volume);
      if (channels.length === 0) continue;

      const channelPercents = channels.map((ch) => parseInt(ch.value_percent));
      const duckedPercents = channelPercents.map((p) => Math.max(1, Math.round(p * DUCK_FACTOR)));

      ducked.push({ index: input.index, channelPercents });
      await execFile("pactl", [
        "set-sink-input-volume",
        String(input.index),
        ...duckedPercents.map((p) => `${p}%`),
      ]);
    }

    if (ducked.length > 0) log(`ducked ${ducked.length} audio stream(s)`);

    return async () => {
      for (const { index, channelPercents } of ducked) {
        try {
          await execFile("pactl", [
            "set-sink-input-volume",
            String(index),
            ...channelPercents.map((p) => `${p}%`),
          ]);
        } catch {}
      }
      if (ducked.length > 0) log(`restored ${ducked.length} audio stream(s)`);
    };
  } catch (e) {
    log(`audio ducking unavailable: ${(e as Error).message}`);
    return async () => {};
  }
}

export async function speak(text: string, voice: string): Promise<void> {
  const url = `http://${TTS_HOST}:${TTS_PORT}/tts`;
  const startTime = performance.now();
  const processed = preprocessForTTS(text);
  log(`speak (voice: ${voice}): "${processed}"`);

  if (!(await acquireLock())) {
    log("skipping speech: could not acquire lock");
    return;
  }

  try {
    let response: Response;
    try {
      response = await fetchTTS(url, voice, processed);
    } catch (e) {
      if (!isConnectionError(e)) throw e;
      await startServer();
      response = await fetchTTS(url, voice, processed);
    }

    if (!response.ok || !response.body) {
      log(`TTS request failed: ${response.status}`);
      return;
    }

    const restoreAudio = await duckOtherAudio();
    try {
      const ffplay = spawn(
        "ffplay",
        ["-nodisp", "-autoexit", "-", "-flags", "low_delay", "-probesize", "32", "-analyzeduration", "0"],
        { stdio: ["pipe", "ignore", "pipe"] },
      );

      const stderrChunks: Buffer[] = [];
      ffplay.stderr!.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      Readable.fromWeb(response.body as never).pipe(ffplay.stdin!);

      await new Promise<void>((resolve) => {
        ffplay.on("close", (code) => {
          if (code && code !== 0) {
            const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
            log(`ffplay exited with code ${code}${stderr ? `: ${stderr}` : ""}`);
          }
          resolve();
        });
        ffplay.on("error", (e) => {
          log(`ffplay error: ${e.message}`);
          resolve();
        });
      });
    } finally {
      await restoreAudio();
    }
  } finally {
    log(`done in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);
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