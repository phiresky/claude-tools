# voice

Audio feedback plugin for Claude Code using pocket-tts. Runs natively on Node.js 25 — no build step, no dependencies.

## Setup

1. Install as a Claude Code plugin (or symlink into `~/.claude/plugins/`)
2. Ensure `pocket-tts` is running on `localhost:8000` (or set `TTS_HOST`/`TTS_PORT`)
3. Ensure `ffplay` is available on PATH

## Usage

| Command | Effect |
|---------|--------|
| `/speak` | Enable voice feedback |
| `/speak <voice>` | Set voice and enable (e.g., `/speak azure`) |
| `/speak stop` | Disable voice feedback |
| `/speak prompt <text>` | Set custom voice instruction |
| `/speak prompt` | Clear custom prompt |

Config is stored in `~/.claude/voice.local.md`.

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

| Key | Default | Description |
|-----|---------|-------------|
| `enabled` | `true` | Toggle voice feedback |
| `voice` | `azelma` | Voice name for pocket-tts |
| `prompt` | _(empty)_ | Custom instruction for summary style |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TTS_HOST` | `localhost` | pocket-tts server host |
| `TTS_PORT` | `8000` | pocket-tts server port |

## Requirements

- Node.js ≥ 25 (native TypeScript via type stripping)
- `pocket-tts` server
- `ffplay` (from ffmpeg)
- `curl`
