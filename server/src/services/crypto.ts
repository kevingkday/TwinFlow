/**
 * Web Crypto AES-GCM Encryption & Credential Utilities
 * Uses 256-bit AES-GCM encryption with SHA-256 derived key and random 12-byte IV per value.
 * Tokens are stored formatted as: v1:<base64(iv)>:<base64(ciphertext)>
 */

const DEFAULT_SECRET = 'twinflow-default-ghl-token-encryption-key-32-chars-minimum!';

/**
 * Derives a 256-bit AES-GCM CryptoKey from a secret passphrase using SHA-256.
 */
async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawHash = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey(
    'raw',
    rawHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using AES-GCM.
 * Formats as `v1:<base64(iv)>:<base64(ciphertext)>`.
 */
export async function encryptAtRest(plaintext: string, secret?: string): Promise<string> {
  if (!plaintext) return '';
  const keySecret = (secret || '').trim() || DEFAULT_SECRET;
  const key = await deriveAesKey(keySecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuf)));
  return `v1:${ivB64}:${cipherB64}`;
}

/**
 * Decrypts an encrypted string (formatted `v1:<base64(iv)>:<base64(ciphertext)>`).
 * Returns unencrypted strings as-is for backward compatibility.
 */
export async function decryptAtRest(encrypted: string, secret?: string): Promise<string> {
  if (!encrypted) return '';
  if (!encrypted.startsWith('v1:')) {
    return encrypted;
  }
  const parts = encrypted.split(':');
  if (parts.length !== 3) return '';

  try {
    const ivStr = atob(parts[1]);
    const iv = new Uint8Array(ivStr.length);
    for (let i = 0; i < ivStr.length; i++) iv[i] = ivStr.charCodeAt(i);

    const cipherStr = atob(parts[2]);
    const ciphertext = new Uint8Array(cipherStr.length);
    for (let i = 0; i < cipherStr.length; i++) ciphertext[i] = cipherStr.charCodeAt(i);

    const keySecret = (secret || '').trim() || DEFAULT_SECRET;
    const key = await deriveAesKey(keySecret);
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuf);
  } catch (err) {
    console.warn('[Crypto] Failed to decrypt value at rest:', err);
    return '';
  }
}

/**
 * Generates a high-entropy initial password for a HighLevel Sub-Account Admin User.
 * Requirement: 12+ chars with at least 1 uppercase, 1 lowercase, 1 number, and 1 special character.
 * Format: Tw!nf<6-hex-upper><6-hex-lower>#9 (19 characters)
 */
export function generateSubaccountPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const upperPart = hex.slice(0, 6).toUpperCase();
  const lowerPart = hex.slice(6, 12).toLowerCase();
  return `Tw!nf${upperPart}${lowerPart}#9`;
}
