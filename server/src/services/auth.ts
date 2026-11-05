/**
 * Authentication & Security Services
 * Uses standard Web Crypto API for Cloudflare Worker compatibility
 */

/**
 * Hash a password using PBKDF2 with a random 16-byte salt
 */
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${hashHex}`;
}

/**
 * Verify a plain password against a stored salt:hash string
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [saltHex, originalHashHex] = storedHash.split(':');
  if (!saltHex || !originalHashHex) return false;

  const enc = new TextEncoder();
  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const derivedHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return derivedHex === originalHashHex;
}

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  const buffer = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Decodes a Google OAuth / Identity Services ID Token (JWT)
 */
export function parseGoogleJwt(token: string): {
  email: string;
  name?: string;
  sub: string;
  picture?: string;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed.email) return null;
    return {
      email: parsed.email.toLowerCase(),
      name: parsed.name,
      sub: parsed.sub,
      picture: parsed.picture,
    };
  } catch (err) {
    console.warn('Failed to parse Google JWT:', err);
    return null;
  }
}

/**
 * Verifies a Google ID Token using Google's tokeninfo API.
 * An unverified JWT is rejected even if its payload contains an email.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId?: string
): Promise<{
  email: string;
  name?: string;
  sub: string;
  picture?: string;
} | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (res.ok) {
      const data = (await res.json()) as {
        email?: string;
        name?: string;
        sub?: string;
        picture?: string;
        aud?: string;
      };
      const emailVerified = (data as { email_verified?: boolean | string }).email_verified;
      const audienceOk = !expectedClientId || data.aud === expectedClientId;
      const verifiedOk = emailVerified === undefined || emailVerified === true || emailVerified === 'true';
      if (data.email && data.sub && audienceOk && verifiedOk) {
        return {
          email: data.email.toLowerCase(),
          name: data.name,
          sub: data.sub,
          picture: data.picture,
        };
      }
    }
  } catch (err) {
    console.warn('[Google Auth] Error verifying token with tokeninfo API:', err);
  }

  // Never accept an unverified JWT payload. tokeninfo is the only success path.
  return null;
}

/**
 * Exchanges a Google OAuth Authorization Code for user profile
 */
export async function exchangeGoogleAuthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string = 'postmessage'
): Promise<{
  email: string;
  name?: string;
  sub: string;
  picture?: string;
} | null> {
  try {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (res.ok) {
      const tokenData = (await res.json()) as {
        id_token?: string;
        access_token?: string;
      };

      if (tokenData.id_token) {
        return verifyGoogleIdToken(tokenData.id_token, clientId);
      }

      if (tokenData.access_token) {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userinfoRes.ok) {
          const userinfo = (await userinfoRes.json()) as {
            email?: string;
            name?: string;
            sub?: string;
            picture?: string;
          };
          if (userinfo.email && userinfo.sub) {
            return {
              email: userinfo.email.toLowerCase(),
              name: userinfo.name,
              sub: userinfo.sub,
              picture: userinfo.picture,
            };
          }
        }
      }
    } else {
      const errText = await res.text();
      console.warn('[Google Auth] Code exchange failed:', errText);
    }
  } catch (err) {
    console.warn('[Google Auth] Network error during code exchange:', err);
  }

  return null;
}
