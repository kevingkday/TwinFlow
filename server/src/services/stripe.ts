const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export interface StripeSignatureCheck {
  valid: boolean;
  reason?: string;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseStripeSignatureHeader(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp = 0;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 't') {
      timestamp = Number(value);
    } else if (key === 'v1' && value) {
      signatures.push(value);
    }
  }

  if (!Number.isFinite(timestamp) || timestamp <= 0 || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

/**
 * Verify a Stripe-Signature header against the raw request body.
 * Fails closed when the webhook secret is missing, the header is absent,
 * the timestamp is outside the tolerance window, or no v1 signature matches.
 */
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  webhookSecret: string | undefined,
  nowMs: number = Date.now()
): Promise<StripeSignatureCheck> {
  if (!webhookSecret) {
    return { valid: false, reason: 'Stripe webhook secret is not configured' };
  }
  if (!signatureHeader) {
    return { valid: false, reason: 'Missing Stripe-Signature header' };
  }

  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed) {
    return { valid: false, reason: 'Malformed Stripe-Signature header' };
  }

  const ageSeconds = Math.abs(nowMs / 1000 - parsed.timestamp);
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) {
    return { valid: false, reason: 'Stripe signature timestamp is outside the allowed window' };
  }

  const expected = await hmacSha256Hex(webhookSecret, `${parsed.timestamp}.${rawBody}`);
  const matches = parsed.signatures.some((candidate) => timingSafeEqualHex(candidate, expected));
  if (!matches) {
    return { valid: false, reason: 'Stripe signature mismatch' };
  }

  return { valid: true };
}
