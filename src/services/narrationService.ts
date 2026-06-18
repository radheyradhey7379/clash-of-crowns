export type Language = 'en' | 'hi' | 'ar';

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  hi: 'Hindi (हिंदी)',
  ar: 'Arabic (العربية)'
};

export function isGenAINarrationAvailable(): boolean {
  return true;
}

import { getApiUrl } from './apiClient';

export async function getNarration(text: string, lang: Language): Promise<{ audioUrl: string; translatedText?: string } | null> {
  try {
    const response = await fetch(getApiUrl("/api/narration"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, lang })
    });

    if (!response.ok) {
      console.warn(`[NarrationService] Server returned error status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const base64Audio = data?.audio;
    const translatedText = data?.translatedText;
    const format = data?.format;
    const mimeType = data?.mimeType;

    if (base64Audio) {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      let blob: Blob;
      if (format === 'mp3' || mimeType === 'audio/mpeg') {
        blob = new Blob([bytes], { type: 'audio/mpeg' });
      } else {
        const wavHeader = createWavHeader(len, 24000);
        const wavBytes = new Uint8Array(wavHeader.length + len);
        wavBytes.set(wavHeader, 0);
        wavBytes.set(bytes, wavHeader.length);
        blob = new Blob([wavBytes], { type: 'audio/wav' });
      }

      return {
        audioUrl: URL.createObjectURL(blob),
        translatedText
      };
    }
    return null;
  } catch (error) {
    console.error("[NarrationService] Narration generation failed:", error);
    return null;
  }
}

function createWavHeader(dataLength: number, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  return new Uint8Array(header);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
