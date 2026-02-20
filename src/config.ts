import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface VoiceConfig {
  enabled: boolean;
  voice: string;
  prompt: string;
  justDisabled: boolean;
}

const CONFIG_PATH = join(homedir(), ".claude", "voicy.json");

export function readConfig(): VoiceConfig {
  const defaults: VoiceConfig = {
    enabled: true,
    voice: "azelma",
    prompt: "",
    justDisabled: false,
  };

  let content: string;
  try {
    content = readFileSync(CONFIG_PATH, "utf-8");
  } catch {
    return { ...defaults, enabled: false };
  }

  try {
    const json = JSON.parse(content);
    return {
      enabled: json.enabled ?? defaults.enabled,
      voice: json.voice ?? defaults.voice,
      prompt: json.prompt ?? defaults.prompt,
      justDisabled: json.just_disabled ?? false,
    };
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
