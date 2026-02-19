import { spawn } from "node:child_process";

const TTS_HOST = process.env.TTS_HOST ?? "localhost";
const TTS_PORT = process.env.TTS_PORT ?? "8000";

export function speak(text: string, voice: string): void {
  const lockDir = "/tmp/voice-playback.lockdir";
  const url = `http://${TTS_HOST}:${TTS_PORT}/tts`;

  // Fire-and-forget: acquires lock, POSTs to TTS, pipes audio to ffplay.
  // Text is passed via env var to avoid shell injection.
  const script = [
    `mkdir "${lockDir}" 2>/dev/null || exit 0`,
    `trap 'rmdir "${lockDir}" 2>/dev/null' EXIT`,
    `printf '%s' "$TTS_TEXT" | curl -sf --max-time 30 -X POST "$TTS_URL" --form-string "voice_url=$TTS_VOICE" -F "text=<-" | ffplay -nodisp -autoexit -loglevel quiet -i pipe:0 2>/dev/null`,
  ].join("\n");

  const child = spawn("bash", ["-c", script], {
    detached: true,
    stdio: "ignore",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TTS_URL: url,
      TTS_TEXT: text,
      TTS_VOICE: voice,
    },
  });
  child.unref();
}
