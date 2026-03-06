# voicy

Audio feedback plugin for Claude Code using [pocket-tts](https://github.com/phiresky/pocket-tts). Runs natively on Node.js 22+ (native TypeScript via type stripping).

## Install

Add the marketplace and install the plugin:

```
/plugin marketplace add phiresky/claude-voicy
/plugin install voicy@phiresky-claude-tools
```

### Prerequisites

- **Node.js >= 22** (native TypeScript via type stripping)
- **pocket-tts** — TTS server (auto-started via `uvx pocket-tts serve` in `auto-start-tts-server` mode)
- **ffplay** — from ffmpeg, for local audio playback (only needed in `auto-start-tts-server` mode)

## Usage

Ask Claude to configure voice feedback using the `configure` MCP tool. Examples:

- "Enable voice narration" — sets mode to `narrate`
- "Change voice to azure" — sets voice
- "Disable voice" — sets mode to `off`
- "Set voice prompt to be sarcastic" — sets custom prompt

## How It Works

Two MCP tools and five hooks provide voice feedback:

- **narrate MCP tool** — Claude calls this to speak a short description before tool use. Writes marker files that the pre-tool-use hook consumes for enforcement.
- **configure MCP tool** — Lets Claude change voice settings (mode, voice, prompt, speak_mode) on behalf of the user.
- **UserPromptSubmit** — Injects voice instructions into the system prompt (summaries, narration rules based on mode)
- **PostToolUse** — Reinforces the voice instructions between tool calls
- **PreToolUse** — Consumes narrate marker files. In `always` mode, blocks tool calls without a preceding narrate. Stashes tool descriptions for richer permission prompt speech.
- **Notification** — Speaks notifications aloud, including permission prompts with tool descriptions
- **Stop** — Speaks a summary when Claude finishes responding; blocks if summary marker is missing on long responses

### Voice Modes

| Component | off | quiet | narrate | always |
|---|---|---|---|---|
| narrate MCP tool speaks | - | - | yes | yes |
| pre-tool-use enforcement | - | - | consume only | block |
| post-tool-use reminder | - | yes | yes | yes |
| stop hook (speak + enforce) | - | yes | yes | yes |
| notifications spoken | - | yes | yes | yes |
| prompt narration section | - | - | soft | mandatory |

### Stop Summary Tiers

1. **Summary marker** — If Claude added one, speak it (trimmed to 37 words)
2. **Short response** — If <=25 words, speak the whole thing
3. **Block** — Rejects the stop, asking Claude to add a summary

## Configuration

All config lives in `~/.claude/voicy.json`.

| Key | Default | Description |
|-----|---------|-------------|
| `mode` | `"always"` | Voice mode: `off`, `quiet`, `narrate`, `always` |
| `voice` | `"alba"` | Voice name for pocket-tts |
| `prompt` | `""` | Custom instruction for summary style |
| `speak_mode` | _(required)_ | `"auto-start-tts-server"` or `"connect-to-speak-server"` |
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
