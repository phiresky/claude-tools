# Claude Code Notes

## Project structure

- Plugin version lives in `.claude-plugin/plugin.json` (line 3) and `.claude-plugin/marketplace.json` (line 13) — keep both in sync
- `package.json` is just for npm deps; the plugin metadata is separate

## Architecture

- The narrate MCP tool and pre-tool-use hook coordinate via ephemeral files in a runtime dir (`narrate-{sessionId}/`). The MCP tool writes marker files (`{toolName}-{random}`), and the pre-tool-use hook atomically consumes them via `unlinkSync`. This is how enforcement works — the hook blocks if no matching marker file exists.
- Session IDs are truncated to 4 chars everywhere (`sessionId.slice(0, 4)`) for shorter dir names.
- `just_disabled` is a one-shot flag in the config JSON. It's set when switching to off mode and cleared on the next `UserPromptSubmit` hook, so the model gets a single "stop doing voice stuff" message during the transition.
- The stop hook has a tier system: marker extraction > short message passthrough > block for missing marker. It reads `last_assistant_message` from hook stdin.
- `speakBackground` behavior depends on the `speak_mode` config: `"auto-start-tts-server"` spawns a detached child process (auto-starting pocket-tts if needed), `"connect-to-speak-server"` delegates to a remote speak-server via `speak_server_url`.

## Mode system

Four modes: `off`, `quiet`, `narrate`, `always`.

## Speak mode

Config field `speak_mode` (required, no default — errors if unset):
- `"auto-start-tts-server"` — connects to pocket-tts at `tts_url` (default `http://localhost:25155`), auto-starts via `uvx` if not running. Plays audio locally via ffplay.
- `"connect-to-speak-server"` — delegates to a speak-server at `speak_server_url` (default `http://localhost:25156`). The speak-server itself listens on `speak_server_listen` (default `localhost:25156`).

| Component | off | quiet | narrate | always |
|---|---|---|---|---|
| narrate MCP tool speaks | - | - | yes | yes |
| pre-tool-use enforcement | - | - | consume only | block |
| post-tool-use reminder | - | yes | yes | yes |
| stop hook (speak + enforce) | - | yes | yes | yes |
| notifications spoken | - | yes | yes | yes |
| prompt narration section | - | - | soft | mandatory |
