import { spawn } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

const TTS_HOST = process.env.TTS_HOST ?? "localhost";
const TTS_PORT = process.env.TTS_PORT ?? "8000";

const LOCK_FILE = "/tmp/voice-playback.lock";

const log = (...args: unknown[]) => console.error("[voice]", ...args);

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

export async function speak(text: string, voice: string): Promise<void> {
  const url = `http://${TTS_HOST}:${TTS_PORT}/tts`;

  if (!(await acquireLock())) {
    log("skipping speech: could not acquire lock");
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
      ["-nodisp", "-autoexit", "-loglevel", "quiet", "-i", "pipe:0"],
      { stdio: ["pipe", "ignore", "ignore"] },
    );

    curl.stdout!.pipe(ffplay.stdin!);
    curl.stdin!.end(text);

    await new Promise<void>((resolve) => {
      ffplay.on("close", (code) => {
        if (code && code !== 0) log(`ffplay exited with code ${code}`);
        resolve();
      });
      ffplay.on("error", (e) => {
        log("ffplay error:", e.message);
        resolve();
      });
      curl.on("error", (e) => {
        log("curl error:", e.message);
        ffplay.kill();
        resolve();
      });
      curl.on("close", (code) => {
        if (code && code !== 0) log(`curl exited with code ${code}`);
      });
    });
  } finally {
    await releaseLock();
  }
}
