# voicy

Audio feedback plugin for Claude Code using pocket-tts. Runs natively on Node.js 25 — no build step, no dependencies.

## Install

In Claude Code, add the marketplace and install the plugin:

```
/plugin marketplace add phiresky/claude-tools
/plugin install voicy@phiresky-claude-tools
```

Then restart Claude Code.

### Prerequisites

- **Node.js >= 25** (native TypeScript via type stripping)
- **pocket-tts** — TTS server (`uvx pocket-tts serve`)
- **ffplay** — from ffmpeg, for audio playback (only needed in `auto-start-tts-server` mode)

## Usage

| Command | Effect |
|---------|--------|
| `/speak` | Enable voice feedback |
| `/speak <voice>` | Set voice and enable (e.g., `/speak azure`) |
| `/speak stop` | Disable voice feedback |
| `/speak prompt <text>` | Set custom voice instruction |
| `/speak prompt` | Clear custom prompt |

Config is stored in `~/.claude/voicy.json`.

## How It Works

Four hooks provide end-to-end voice feedback:

- **UserPromptSubmit** — Injects instructions telling Claude to add 📢 summaries
- **PostToolUse** — Reinforces the 📢 instruction between tool calls
- **PreToolUse** — Speaks AskUserQuestion prompts and permission dialogs aloud
- **Stop** — Extracts and speaks a summary when Claude finishes responding

### Stop Summary Tiers

1. **📢 marker** — If Claude added one, speak it (trimmed to 37 words)
2. **Short response** — If ≤25 words, speak the whole thing
3. **Claude summarization** — Headless `claude -p` generates a spoken summary
4. **Truncation** — Fallback: first 25 words + "..."

## Configuration

All config lives in `~/.claude/voicy.json`.

| Key | Default | Description |
|-----|---------|-------------|
| `mode` | `"always"` | Voice mode: `off`, `quiet`, `narrate`, `always` |
| `voice` | `"alba"` | Voice name for pocket-tts |
| `prompt` | `""` | Custom instruction for summary style |
| `speak_mode` | _(none, required)_ | `"auto-start-tts-server"` or `"connect-to-speak-server"` |
| `tts_url` | `"http://localhost:25155"` | pocket-tts base URL |
| `speak_server_url` | `"http://localhost:25156"` | Speak server base URL (for `connect-to-speak-server` mode) |
| `speak_server_listen` | `"localhost:25156"` | Bind address for `speak-server.ts` |

### Speak Modes

**`auto-start-tts-server`** — Connects directly to pocket-tts at `tts_url`. If the server isn't running, auto-starts it via `uvx pocket-tts serve`. Audio plays locally via ffplay. Best for local development.

**`connect-to-speak-server`** — Delegates to a speak-server at `speak_server_url`, which handles TTS and playback. Best for remote containers (devcontainer, SSH, WSL) where the container has no audio device.

### Example configs

Local usage:
```json
{
  "mode": "narrate",
  "voice": "alba",
  "speak_mode": "auto-start-tts-server"
}
```

Remote container (speak-server running on host):
```json
{
  "mode": "narrate",
  "voice": "alba",
  "speak_mode": "connect-to-speak-server",
  "speak_server_url": "http://host.docker.internal:25156"
}
```

## Remote Container Usage

When Claude Code runs inside a devcontainer, SSH remote, or WSL, the container has no audio device. The speak-server bridges this gap — it runs on the host and receives HTTP requests from the container.

**On the host** (where speakers are):
```bash
node src/speak-server.ts
```

**In the container**, set `speak_mode` and `speak_server_url` in `~/.claude/voicy.json`:
```json
{
  "speak_mode": "connect-to-speak-server",
  "speak_server_url": "http://host.docker.internal:25156"
}
```

