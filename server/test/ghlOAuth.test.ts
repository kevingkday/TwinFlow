import { describe, it, expect } from 'vitest';
import { encryptAtRest, decryptAtRest, generateSubaccountPassword } from '../src/services/crypto';

describe('GHL Crypto & Credential Service', () => {
  it('encrypts and decrypts values at rest using AES-GCM', async () => {
    const secret = 'test-encryption-key-32-chars-long-12345';
    const sampleToken = 'pit-98765432-abcd-ef01-2345-6789abcdef01';

    const encrypted = await encryptAtRest(sampleToken, secret);
    expect(encrypted).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);

    const decrypted = await decryptAtRest(encrypted, secret);
    expect(decrypted).toBe(sampleToken);
  });

  it('handles empty and legacy unencrypted tokens gracefully', async () => {
    const secret = 'test-key-32-chars-minimum-length-now';
    expect(await encryptAtRest('', secret)).toBe('');
    expect(await decryptAtRest('', secret)).toBe('');

    // Legacy unencrypted token
    const legacyKey = 'pit-legacy-plain-token-here';
    expect(await decryptAtRest(legacyKey, secret)).toBe(legacyKey);
  });

  it('generates high-entropy sub-account passwords meeting HighLevel complexity rules', () => {
    for (let i = 0; i < 20; i++) {
      const password = generateSubaccountPassword();
      // 12+ chars
      expect(password.length).toBeGreaterThanOrEqual(12);
      // Starts with Tw!nf and ends with #9
      expect(password).toMatch(/^Tw!nf[A-F0-9]{6}[a-f0-9]{6}#9$/);
      // Contains uppercase
      expect(/[A-Z]/.test(password)).toBe(true);
      // Contains lowercase
      expect(/[a-z]/.test(password)).toBe(true);
      // Contains number
      expect(/[0-9]/.test(password)).toBe(true);
      // Contains special character
      expect(/[!#]/.test(password)).toBe(true);
    }
  });
});
