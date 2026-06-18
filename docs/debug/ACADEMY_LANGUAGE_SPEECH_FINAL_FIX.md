# Academy Language & Speech Fix

This document covers the bugs resolved and final implementation details for the Academy's multilingual voice narration system.

## 1. Resolved Issues

Previously, when the user selected Hindi or Arabic in the lesson narration menu, the text translated on-screen, but the synthesized speech still read the English text.

## 2. Speech Narration Fixes

We strictly enforced that the speech source is always the translated text rather than the English fallback:

1.  **Server-Side Translation Prompting**:
    *   Instructed the Gemini model to return raw translated text in target scripts with modality set to `AUDIO` configured for voice `'Kore'`.
    *   Ensured the API prompt includes: *"Translate and narrate only in selected language. Do not return English unless selected language is English."*
2.  **Client-Side Narration Source**:
    *   Used the server's response `translatedText` as the source for on-screen text display and local SpeechSynthesis fallback.
    *   If offline, the system falls back to `getLocalLessonText` (which queries predefined translations in `lessonTranslations.ts`) instead of reading out English.
3.  **Active Speech Synthesis Cleanup**:
    *   To prevent overlapping audio or narration, any language switch or stop command cancels the active SpeechSynthesis utterance and pauses any loaded audio:
        ```typescript
        window.speechSynthesis.cancel();
        audio.pause();
        ```
    *   Clears timeouts and revokes temporary Blob object URLs to prevent memory leaks.
4.  **Target Voice Selection**:
    *   **Hindi**: Configures `utterance.lang = "hi-IN"` and selects a system voice matching `voice.lang` starting with `"hi"`.
    *   **Arabic**: Configures `utterance.lang = "ar-SA"` (or `"ar"`) and selects a system voice matching `voice.lang` starting with `"ar"`.
    *   **Fallback Handling**: If no exact matching system voice is installed on the user's browser/device, it falls back to the default system voice and prints: *"Exact Hindi/Arabic voice not available, using default voice."*
