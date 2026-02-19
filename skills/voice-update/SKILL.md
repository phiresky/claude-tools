---
name: voice-update
description: This skill should be used when the agent needs to give a spoken voice update to the user, or when reminded by a Stop hook to provide audio feedback. Use this skill to speak a short summary of what was accomplished.
---

# Voice Update Skill

Provide spoken audio feedback to the user using pocket-tts.

## When to Use

- When finishing a task and a Stop hook reminds to give voice feedback
- When the user explicitly asks for a spoken summary
- When providing important status updates that benefit from audio

## How to Use

1. Summarize what was accomplished in 1-2 short, conversational sentences
2. Use Bash to call the TTS endpoint directly

## Calling TTS

Use Bash to speak a summary:

```bash
TEXT="Your summary here"
curl -sf -X POST "http://${TTS_HOST:-localhost}:${TTS_PORT:-8000}/tts" \
  --form-string "voice_url=azelma" -F "text=$TEXT" \
  | ffplay -nodisp -autoexit -loglevel quiet -i pipe:0 2>/dev/null &
```

Example:
```bash
TEXT="I've fixed the bug in the login handler and added the unit tests."
curl -sf -X POST "http://${TTS_HOST:-localhost}:${TTS_PORT:-8000}/tts" \
  --form-string "voice_url=azelma" -F "text=$TEXT" \
  | ffplay -nodisp -autoexit -loglevel quiet -i pipe:0 2>/dev/null &
```

## Summary Guidelines

- Keep it to 1-2 sentences maximum
- Be conversational, not robotic
- Match the user's communication style - if they're casual or use colorful language, mirror that tone
- Focus on what was accomplished, not technical details
- Avoid code snippets, file paths, or technical jargon
- Examples:
  - "I've updated the configuration file and restarted the server."
  - "The tests are now passing. I fixed three type errors."
  - "Done! I created the new component and added it to the main page."
