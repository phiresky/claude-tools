import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type VoiceMode = "off" | "quiet" | "narrate" | "always";
export type SpeakMode = "auto-start-tts-server" | "connect-to-speak-server";

export interface VoiceConfig {
  mode: VoiceMode;
  voice: string;
  prompt: string;
  just_disabled: boolean;
  speak_mode?: SpeakMode;
  tts_url?: string; // pocket-tts base URL
  speak_server_url?: string; // speak-server base URL (when speak_mode is "connect-to-speak-server")
  speak_server_listen?: string; // "host:port" for speak-server.ts to bind on
}

const CONFIG_PATH = join(homedir(), ".claude", "voicy.json");


export function readConfig(): VoiceConfig {
  const defaults: VoiceConfig = {
    mode: "always",
    voice: "alba",
    prompt: "",
    just_disabled: false,
    tts_url: "http://localhost:25155",
    speak_server_url: "http://localhost:25156",
    speak_server_listen: "localhost:25156",
  };

  let content: string;
  try {
    content = readFileSync(CONFIG_PATH, "utf-8");
  } catch {
    return { ...defaults, mode: "off" };
  }

  try {
    const json = JSON.parse(content);
    return { ...defaults, ...json };
  } catch {
    return defaults;
  }
}

export function clearJustDisabled(): void {
  let content: string;
  try {
    content = readFileSync(CONFIG_PATH, "utf-8");
  } catch {
    return;
  }

  try {
    const json = JSON.parse(content);
    delete json.just_disabled;
    writeFileSync(CONFIG_PATH, JSON.stringify(json, null, 2) + "\n", "utf-8");
  } catch {
    return;
  }
}
