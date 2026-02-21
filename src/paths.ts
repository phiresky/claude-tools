import { homedir } from "node:os";
import { join } from "node:path";
const uid = process.getuid?.();
const APP_NAME = "claude-voicy";
const runtimeBase = process.env.XDG_RUNTIME_DIR ?? (uid != null ? `/run/user/${uid}` : "/tmp");
export const RUNTIME_DIR = join(runtimeBase, APP_NAME);
export const STATE_DIR = join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"), APP_NAME);

export function narrateDir(sessionId: string): string {
  return join(RUNTIME_DIR, `narrate-${sessionId.slice(0, 4)}`);
}
