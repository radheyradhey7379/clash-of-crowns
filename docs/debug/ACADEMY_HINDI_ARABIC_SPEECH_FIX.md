# Academy Hindi & Arabic Voice Synthesis Fix

This document describes how language-specific translated text and speech narration fallbacks are resolved and verified in the chess Academy.

## 1. Selected Language Propagation

When a player selects Hindi or Arabic in the academy detail view, the selected language is propagated into both the live GenAI audio narration path and the local Web SpeechSynthesis fallback path.

- **English:** Narrates in English using the prebuilt voice or default `en-US` synthesis.
- **Hindi (हिंदी):** Translates lesson text to Hindi script and speaks it using a matching Hindi voice (`hi-IN`).
- **Arabic (العربية):** Translates lesson text to Arabic script and speaks it using a matching Arabic voice (`ar-SA` or `ar`).

## 2. Speech Synthesis Fallback Voice Matching

If the live GenAI narration server is unavailable (or the client is offline), the app uses the local translated script from `lessonTranslations.ts` and falls back to Web SpeechSynthesis:

1. It attempts to find a SpeechSynthesis voice whose lang matching `hi` (for Hindi) or `ar` (for Arabic).
2. If an exact native voice matches, the utterance is read by that voice.
3. If no matching voice is installed on the user's browser/device, the translated script is still spoken using the default system voice as best-effort.
4. When falling back to the default voice for translated text, the UI displays a warnings toast/alert:
   `⚠️ Exact voice not available, using default voice.`

## 3. Audio Cancellation and Cleanup

To avoid duplicate narration or overlaying speech:
- Calling `stopNarration` instantly executes `window.speechSynthesis.cancel()`, pauses any running `HTMLAudioElement`, and clears any active safety timeouts.
- Prior audio is fully cancelled whenever a user switches languages or exits/unmounts the lesson screen.
- A 30-second safety timeout is scheduled to prevent stuck loading states if a network connection drops mid-fetch.
