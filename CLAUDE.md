# Claude Code Notes

## Project structure

- Plugin version lives in `.claude-plugin/plugin.json`, NOT `package.json`
- `package.json` is just for npm deps; the plugin metadata is separate

## Architecture

- The narrate MCP tool and pre-tool-use hook coordinate via ephemeral files in a runtime dir (`narrate-{sessionId}/`). The MCP tool writes marker files (`{toolName}-{random}`), and the pre-tool-use hook atomically consumes them via `unlinkSync`. This is how enforcement works — the hook blocks if no matching marker file exists.
- Session IDs are truncated to 4 chars everywhere (`sessionId.slice(0, 4)`) for shorter dir names.
- `justDisabled` / `just_disabled` is a one-shot flag in the config JSON. It's set when switching to off mode and cleared on the next `UserPromptSubmit` hook, so the model gets a single "stop doing voice stuff" message during the transition.
- The stop hook has a tier system: marker extraction > short message passthrough > block for missing marker. It reads `last_assistant_message` from hook stdin.
- `speakBackground` either delegates to a speak-server (if `SPEAK_HOST` is set) or spawns a detached child process, so hooks can exit without waiting for playback.

## Mode system

Four modes: `off`, `quiet`, `narrate`, `always`. Legacy `enabled: true/false` in config maps to `always`/`off` via `resolveMode()`.

| Component | off | quiet | narrate | always |
|---|---|---|---|---|
| narrate MCP tool speaks | - | - | yes | yes |
| pre-tool-use enforcement | - | - | consume only | block |
| post-tool-use reminder | - | yes | yes | yes |
| stop hook (speak + enforce) | - | yes | yes | yes |
| notifications spoken | - | yes | yes | yes |
| prompt narration section | - | - | soft | mandatory |
