import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface VoiceConfig {
  enabled: boolean;
  voice: string;
  prompt: string;
  justDisabled: boolean;
}

const CONFIG_PATH = join(homedir(), ".claude", "voice.local.md");

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

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return defaults;

  const yaml = fmMatch[1];
  const enabledMatch = yaml.match(/^enabled:\s*(.+)$/m);
  const voiceMatch = yaml.match(/^voice:\s*(.+)$/m);
  const promptMatch = yaml.match(/^prompt:\s*"?(.*?)"?\s*$/m);
  const justDisabledMatch = yaml.match(/^just_disabled:\s*(.+)$/m);

  return {
    enabled: enabledMatch ? enabledMatch[1].trim() === "true" : defaults.enabled,
    voice: voiceMatch ? voiceMatch[1].trim() : defaults.voice,
    prompt: promptMatch ? promptMatch[1].trim() : defaults.prompt,
    justDisabled: justDisabledMatch
      ? justDisabledMatch[1].trim() === "true"
      : false,
  };
}

export function clearJustDisabled(): void {
  let content: string;
  try {
    content = readFileSync(CONFIG_PATH, "utf-8");
  } catch {
    return;
  }
  const updated = content.replace(/^just_disabled:.*\n?/m, "");
  writeFileSync(CONFIG_PATH, updated, "utf-8");
}
