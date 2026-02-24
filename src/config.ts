import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type VoiceMode = "off" | "quiet" | "narrate" | "always";

export interface VoiceConfig {
  mode: VoiceMode;
  voice: string;
  prompt: string;
  justDisabled: boolean;
}

const CONFIG_PATH = join(homedir(), ".claude", "voicy.json");

const VALID_MODES = new Set<VoiceMode>(["off", "quiet", "narrate", "always"]);

function resolveMode(json: Record<string, unknown>): VoiceMode {
  // New-style: explicit mode field
  if (typeof json.mode === "string" && VALID_MODES.has(json.mode as VoiceMode)) {
    return json.mode as VoiceMode;
  }
  // Legacy: enabled boolean → map to always/off
  if (typeof json.enabled === "boolean") {
    return json.enabled ? "always" : "off";
  }
  return "always";
}

export function readConfig(): VoiceConfig {
  const defaults: VoiceConfig = {
    mode: "always",
    voice: "azelma",
    prompt: "",
    justDisabled: false,
  };

  let content: string;
  try {
    content = readFileSync(CONFIG_PATH, "utf-8");
  } catch {
    return { ...defaults, mode: "off" };
  }

  try {
    const json = JSON.parse(content);
    return {
      mode: resolveMode(json),
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
