# Academy Narration Language Fix

This document covers the changes made to support target language translations and text-to-speech narration for Hindi and Arabic chess lessons.

## 1. Node Server Narration Endpoint
Modified `/api/narration` in `server.ts` to:
- Accept a target language parameter (`hi` or `ar`).
- Construct a strict translation prompt forcing Gemini 2.5 Flash to translate the chess lesson content ONLY into the target language script (Hindi or Arabic), returning raw translated script without English translations or conversational preambles.
- Retrieve the text-to-speech narration directly from Gemini's audio modality candidate.
- Return both `audio` (base64) and the `translatedText` to the client.

## 2. Learn Detail Screen Narration Flow
Modified `LearnDetailScreen.tsx` to handle:
- **Offline / Server Fallback**: If the server is offline or fails, or if offline mode is active, the app automatically pulls the pre-configured translation for the corresponding lesson from `lessonTranslations.ts`.
- **Web SpeechSynthesis Fallback**: Falls back to browser `SpeechSynthesis` using the local translation text. It selects the closest matching voice (`hi-IN` for Hindi, `ar-SA` for Arabic).
- **Instant Audio Cancellation**: Switching between languages or exiting the screen calls `stopNarration()` which instantly terminates any active SpeechSynthesis utterance and stops any HTML5 audio element playback, preventing duplicate/overlapping speech.
- **Safety Timeout**: Registers a 30-second watchdog timer to automatically dismiss the spinner if the audio network fetch hangs indefinitely, preventing stuck loading states.
- **Translated Subtitles Overlay**: The screen renders the actual translated text (e.g. Hindi or Arabic script) in a premium caption overlay during playback.
