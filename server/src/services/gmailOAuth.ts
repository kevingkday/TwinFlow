/**
 * Gmail OAuth 2.0 & Direct Email Sending Service
 *
 * Implements Google's OAuth 2.0 Authorization Code flow for Gmail (`gmail.send`),
 * AES-GCM encrypted token storage in D1, automatic refresh-token renewal,
 * and RFC 2822 MIME email construction + sending via Gmail REST API v1.
 */

import { and, eq } from 'drizzle-orm';
import type { Bindings, Database } from '../db';
import { gmailOauthConnections, outreachDrafts, signals } from '../db/schema';
import { decryptAtRest, encryptAtRest } from './crypto';

export const GMAIL_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export const GMAIL_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface GmailExchangeCodeResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  gmailEmail?: string;
  error?: string;
}

export interface GmailRefreshResult {
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
  scope?: string;
  needsReauth?: boolean;
  error?: string;
}

export interface ResolvedGmailCredentials {
  accessToken: string;
  gmailEmail: string;
  scope: string | null;
}

export interface SendGmailInput {
  to: string;
  subject: string;
  body: string;
  senderName?: string | null;
  contactId?: string;
  signalId?: string;
  draftId?: string;
}

export interface SendGmailResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  fromEmail?: string;
  needsReauth?: boolean;
  error?: string;
}

/**
 * Builds the Google OAuth 2.0 consent URL requesting offline access + gmail.send.
 */
export function buildGmailAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  loginHint?: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: GMAIL_OAUTH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state: params.state,
  });
  if (params.loginHint) {
    query.set('login_hint', params.loginHint);
  }
  return `${GMAIL_OAUTH_URL}?${query.toString()}`;
}

/**
 * Exchanges a Google OAuth authorization code for access + refresh tokens and fetches the Gmail address.
 */
export async function exchangeGmailAuthCode(
  code: string,
  redirectUri: string,
  env: Bindings
): Promise<GmailExchangeCodeResult> {
  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured on the server.',
    };
  }

  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const tokenData = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      return {
        success: false,
        error:
          tokenData.error_description ||
          tokenData.error ||
          `Google token exchange failed (${tokenRes.status})`,
      };
    }

    // Fetch the authenticated Google account's email address
    const userinfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userinfo = (await userinfoRes.json().catch(() => ({}))) as {
      email?: string;
      verified_email?: boolean;
    };

    if (!userinfoRes.ok || !userinfo.email) {
      return {
        success: false,
        error: 'Unable to retrieve Gmail email address from Google userinfo.',
      };
    }

    return {
      success: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      gmailEmail: userinfo.email.toLowerCase(),
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error during Google OAuth token exchange: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

/**
 * Refreshes an expired Gmail OAuth access token using the stored refresh token.
 */
export async function refreshGmailAccessToken(
  refreshToken: string,
  env: Bindings
): Promise<GmailRefreshResult> {
  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured on the server.',
    };
  }

  try {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !data.access_token) {
      const needsReauth = data.error === 'invalid_grant' || res.status === 400 || res.status === 401;
      return {
        success: false,
        needsReauth,
        error: data.error_description || data.error || `Token refresh failed (${res.status})`,
      };
    }

    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error refreshing Gmail token: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

/**
 * Resolves a valid Gmail access token for the user, refreshing automatically when near expiry.
 */
export async function resolveUserGmailCredentials(
  db: Database,
  userId: string,
  env: Bindings,
  forceRefresh = false
): Promise<
  | { ok: true; credentials: ResolvedGmailCredentials }
  | { ok: false; needsReauth: boolean; error: string }
> {
  const conn = await db.query.gmailOauthConnections.findFirst({
    where: eq(gmailOauthConnections.userId, userId),
  });

  if (!conn) {
    return {
      ok: false,
      needsReauth: true,
      error: 'Gmail is not connected to this account.',
    };
  }

  const secret = env.GHL_TOKEN_ENCRYPTION_KEY;
  const accessToken = conn.accessTokenEnc ? await decryptAtRest(conn.accessTokenEnc, secret) : '';
  const refreshToken = conn.refreshTokenEnc ? await decryptAtRest(conn.refreshTokenEnc, secret) : '';

  const isExpiredOrExpiringSoon =
    forceRefresh || !conn.expiresAt || Date.now() >= conn.expiresAt - 60_000;

  if (accessToken && !isExpiredOrExpiringSoon) {
    return {
      ok: true,
      credentials: {
        accessToken,
        gmailEmail: conn.gmailEmail,
        scope: conn.scope,
      },
    };
  }

  if (!refreshToken) {
    return {
      ok: false,
      needsReauth: true,
      error: 'Gmail session expired and no refresh token is available. Please reconnect Gmail.',
    };
  }

  const refreshed = await refreshGmailAccessToken(refreshToken, env);
  if (!refreshed.success || !refreshed.accessToken) {
    return {
      ok: false,
      needsReauth: Boolean(refreshed.needsReauth),
      error: refreshed.error || 'Failed to refresh Gmail access token. Please reconnect Gmail.',
    };
  }

  const now = new Date().toISOString();
  const newExpiresAt = Date.now() + (refreshed.expiresIn || 3600) * 1000;
  const newAccessTokenEnc = await encryptAtRest(refreshed.accessToken, secret);

  await db
    .update(gmailOauthConnections)
    .set({
      accessTokenEnc: newAccessTokenEnc,
      expiresAt: newExpiresAt,
      scope: refreshed.scope || conn.scope,
      updatedAt: now,
    })
    .where(eq(gmailOauthConnections.userId, userId));

  return {
    ok: true,
    credentials: {
      accessToken: refreshed.accessToken,
      gmailEmail: conn.gmailEmail,
      scope: refreshed.scope || conn.scope,
    },
  };
}

/**
 * Encodes a UTF-8 string into URL-safe Base64 (base64url) without padding, safe in Cloudflare Workers.
 */
export function base64UrlEncodeUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Encodes a header value using RFC 2047 Base64 UTF-8 if it contains non-ASCII characters.
 */
function encodeMimeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) {
    return value;
  }
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

/**
 * Strips CR/LF characters from single-line email headers to prevent header injection.
 */
function sanitizeHeaderField(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Builds an RFC 2822 UTF-8 MIME message ready for Gmail's `messages.send` `raw` field.
 */
export function buildMimeEmail(params: {
  from: string;
  senderName?: string | null;
  to: string;
  subject: string;
  body: string;
}): string {
  const cleanFrom = sanitizeHeaderField(params.from);
  const cleanTo = sanitizeHeaderField(params.to);
  const cleanSubject = sanitizeHeaderField(params.subject);
  const cleanName = params.senderName ? sanitizeHeaderField(params.senderName).replace(/"/g, '') : '';

  const fromHeader = cleanName ? `${encodeMimeHeaderValue(cleanName)} <${cleanFrom}>` : cleanFrom;
  const normalizedBody = params.body.replace(/\r?\n/g, '\r\n');

  const lines = [
    `From: ${fromHeader}`,
    `To: ${cleanTo}`,
    `Subject: ${encodeMimeHeaderValue(cleanSubject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    normalizedBody,
  ];

  return lines.join('\r\n');
}

/**
 * Sends an email directly via the user's connected Gmail account and updates any matching outreach draft.
 */
export async function sendGmailMessage(
  db: Database,
  userId: string,
  env: Bindings,
  input: SendGmailInput
): Promise<SendGmailResult> {
  const resolved = await resolveUserGmailCredentials(db, userId, env, false);
  if (!resolved.ok) {
    return {
      success: false,
      needsReauth: resolved.needsReauth,
      error: resolved.error,
    };
  }

  const attemptSend = async (accessToken: string, fromEmail: string) => {
    const rawMime = buildMimeEmail({
      from: fromEmail,
      senderName: input.senderName,
      to: input.to,
      subject: input.subject,
      body: input.body,
    });
    const raw = base64UrlEncodeUtf8(rawMime);

    return fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });
  };

  let activeCreds = resolved.credentials;
  let sendRes = await attemptSend(activeCreds.accessToken, activeCreds.gmailEmail);

  // If Google rejected the token with 401, attempt one forced refresh and retry
  if (sendRes.status === 401) {
    const retried = await resolveUserGmailCredentials(db, userId, env, true);
    if (retried.ok) {
      activeCreds = retried.credentials;
      sendRes = await attemptSend(activeCreds.accessToken, activeCreds.gmailEmail);
    }
  }

  const sendData = (await sendRes.json().catch(() => ({}))) as {
    id?: string;
    threadId?: string;
    error?: { message?: string; status?: string; code?: number };
  };

  if (!sendRes.ok || !sendData.id) {
    const needsReauth = sendRes.status === 401 || sendRes.status === 403;
    return {
      success: false,
      needsReauth,
      error:
        sendData.error?.message ||
        `Gmail API failed to send message (${sendRes.status})`,
    };
  }

  // Mark matching outreach draft as 'sent' if owned by this user
  const now = new Date().toISOString();
  if (input.draftId) {
    const existingDraft = await db.query.outreachDrafts.findFirst({
      where: eq(outreachDrafts.id, input.draftId),
      with: { signal: true },
    });
    if (existingDraft && existingDraft.signal?.userId === userId) {
      await db
        .update(outreachDrafts)
        .set({
          subject: input.subject,
          body: input.body,
          status: 'sent',
          updatedAt: now,
        })
        .where(eq(outreachDrafts.id, input.draftId));
    }
  } else if (input.signalId && input.contactId) {
    const ownedSignal = await db.query.signals.findFirst({
      where: and(eq(signals.id, input.signalId), eq(signals.userId, userId)),
    });
    if (ownedSignal) {
      await db
        .update(outreachDrafts)
        .set({
          subject: input.subject,
          body: input.body,
          status: 'sent',
          updatedAt: now,
        })
        .where(
          and(
            eq(outreachDrafts.signalId, input.signalId),
            eq(outreachDrafts.contactId, input.contactId)
          )
        );
    }
  }

  return {
    success: true,
    messageId: sendData.id,
    threadId: sendData.threadId,
    fromEmail: activeCreds.gmailEmail,
  };
}
