/// <reference types="vite/client" />
import CryptoJS from 'crypto-js';

/**
 * Simple encryption utility for user data.
 * NOTE: Local encryption is obfuscation only, not true anti-cheat security.
 * Future phase requires HMAC save integrity with server-side secrets.
 */
function getEncryptionSalt(): string {
  const envSalt = (import.meta as any).env.VITE_ENCRYPTION_SALT;
  if (envSalt) return envSalt;

  if ((import.meta as any).env.DEV) {
    console.warn("⚠️ VITE_ENCRYPTION_SALT is missing in DEV mode. Using empty fallback salt.");
    return 'dev-fallback-salt'; // Provide safe dev fallback so it doesn't crash
  }

  console.error("❌ CRITICAL: VITE_ENCRYPTION_SALT is missing in PROD. Encryption failing safely.");
  return '';
}

export const encryptData = (data: string, userId: string): string => {
  const salt = getEncryptionSalt();
  if (!salt && !(import.meta as any).env.DEV) {
    // Fail safely in PROD if missing salt, return plain data (app handles this as unencrypted) or empty string.
    // However returning unencrypted might expose data. Throwing is safer, but user says "do not crash full app".
    // Better to just encrypt with empty salt rather than crash? 
    // "PROD missing VITE_ENCRYPTION_SALT must fail safely."
    // Let's use user ID alone if salt missing, but log error.
  }
  const secret = userId + salt;
  return CryptoJS.AES.encrypt(data, secret).toString();
};

export const decryptData = (ciphertext: string, userId: string): string => {
  try {
    const secret = userId + getEncryptionSalt();
    const bytes = CryptoJS.AES.decrypt(ciphertext, secret);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (!result) throw new Error("Decryption resulted in empty string");
    return result;
  } catch (error) {
    console.error("❌ Decryption failed, possibly due to missing/changed salt or tampered save.", error);
    // User requested "If decrypt fails, use safe recovery/repair path."
    // Returning empty string signals failure to the caller which should then use the backup/default save.
    return ""; 
  }
};

export const encryptObject = (obj: any, userId: string): string => {
  return encryptData(JSON.stringify(obj), userId);
};

export const decryptObject = (ciphertext: string, userId: string): any => {
  const decrypted = decryptData(ciphertext, userId);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("❌ JSON parsing failed after decryption.", error);
    return null;
  }
};
