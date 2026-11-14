/**
 * Gmail OAuth 2.0 & Direct Email Sending Routes
 *
 * Implements:
 * - GET  /api/oauth/gmail/start: Generates CSRF state & redirects to Google OAuth consent screen
 * - GET  /api/oauth/gmail/callback: Exchanges code for tokens, encrypts at rest, upserts connection
 * - GET  /api/oauth/gmail/status: Returns Gmail connection status & connected address
 * - POST /api/oauth/gmail/disconnect: Revokes & clears stored Gmail OAuth tokens
 * - POST /api/oauth/gmail/send: Sends an email directly via Gmail API on behalf of the user
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Bindings } from '../db';
import { getDb } from '../db';
import { gmailOauthConnections, gmailOauthStates } from '../db/schema';
import { getSessionUser } from './auth';
import {
  GOOGLE_REVOKE_URL,
  buildGmailAuthUrl,
  exchangeGmailAuthCode,
  sendGmailMessage,
} from '../services/gmailOAuth';
import { decryptAtRest, encryptAtRest } from '../services/crypto';

export const gmailOAuthRouter = new Hono<{ Bindings: Bindings }>();

function sanitizeRedirectTarget(raw?: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/#profile';
  }
  return raw;
}

function appendQueryToHashPath(target: string, params: Record<string, string>): string {
  const [pathPart, hashPart] = target.split('#');
  const base = pathPart || '/';
  const sep = base.includes('?') ? '&' : '?';
  const qs = new URLSearchParams(params).toString();
  return `${base}${sep}${qs}${hashPart ? `#${hashPart}` : ''}`;
}

/**
 * GET /api/oauth/gmail/start
 * Initiates the Google OAuth 2.0 flow for Gmail sending.
 */
gmailOAuthRouter.get('/start', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);
  const wantsJson = c.req.query('format') === 'json';

  if (!user) {
    if (wantsJson) {
      return c.json(
        { success: false, error: 'Session expired. Please sign out and sign back in.' },
        401
      );
    }
    return c.redirect('/#login?error=auth_required');
  }

  const clientId = (c.env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) {
    if (wantsJson) {
      return c.json(
        { success: false, error: 'GOOGLE_CLIENT_ID is not configured on the server.' },
        500
      );
    }
    return c.redirect(
      appendQueryToHashPath('/#profile', {
        gmail_oauth: 'error',
        message: 'Missing GOOGLE_CLIENT_ID',
      })
    );
  }

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const state = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const expiresAt = Date.now() + 10 * 60 * 1000;
  const redirectAfter = sanitizeRedirectTarget(c.req.query('redirect'));

  await db.insert(gmailOauthStates).values({
    state,
    userId: user.id,
    redirectAfter,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  const origin = new URL(c.req.url).origin;
  const redirectUri = `${(c.env.APP_URL || origin).replace(/\/$/, '')}/api/oauth/gmail/callback`;

  const authUrl = buildGmailAuthUrl({
    clientId,
    redirectUri,
    state,
    loginHint: user.email,
  });

  if (wantsJson) {
    return c.json({ success: true, authUrl });
  }
  return c.redirect(authUrl, 302);
});

/**
 * GET /api/oauth/gmail/callback
 * Handles the OAuth 2.0 callback from Google.
 */
gmailOAuthRouter.get('/callback', async (c) => {
  if (!c.env?.DB) {
    return c.redirect(
      appendQueryToHashPath('/#profile', {
        gmail_oauth: 'error',
        message: 'Database unavailable',
      })
    );
  }
  const db = getDb(c.env.DB);

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error') || c.req.query('error_description');

  if (error) {
    return c.redirect(
      appendQueryToHashPath('/#profile', {
        gmail_oauth: 'error',
        message: error,
      })
    );
  }

  if (!code || !state) {
    return c.redirect(
      appendQueryToHashPath('/#profile', {
        gmail_oauth: 'error',
        message: 'Missing authorization code or state token',
      })
    );
  }

  const stateRecord = await db.query.gmailOauthStates.findFirst({
    where: eq(gmailOauthStates.state, state),
  });

  if (!stateRecord) {
    return c.redirect(
      appendQueryToHashPath('/#profile', {
        gmail_oauth: 'error',
        message: 'Invalid or already used state token',
      })
    );
  }

  await db.delete(gmailOauthStates).where(eq(gmailOauthStates.state, state));

  const redirectTarget = sanitizeRedirectTarget(stateRecord.redirectAfter);

  if (Date.now() > stateRecord.expiresAt) {
    return c.redirect(
      appendQueryToHashPath(redirectTarget, {
        gmail_oauth: 'error',
        message: 'Authorization session expired. Please try connecting Gmail again.',
      })
    );
  }

  const origin = new URL(c.req.url).origin;
  const redirectUri = `${(c.env.APP_URL || origin).replace(/\/$/, '')}/api/oauth/gmail/callback`;
  const tokenRes = await exchangeGmailAuthCode(code, redirectUri, c.env);

  if (!tokenRes.success || !tokenRes.accessToken || !tokenRes.gmailEmail) {
    return c.redirect(
      appendQueryToHashPath(redirectTarget, {
        gmail_oauth: 'error',
        message: tokenRes.error || 'Failed to exchange authorization code for Gmail tokens',
      })
    );
  }

  const secret = c.env.GHL_TOKEN_ENCRYPTION_KEY;
  const accessTokenEnc = await encryptAtRest(tokenRes.accessToken, secret);
  const expiresAt = Date.now() + (tokenRes.expiresIn || 3600) * 1000;
  const now = new Date().toISOString();

  const existing = await db.query.gmailOauthConnections.findFirst({
    where: eq(gmailOauthConnections.userId, stateRecord.userId),
  });

  const refreshTokenEnc = tokenRes.refreshToken
    ? await encryptAtRest(tokenRes.refreshToken, secret)
    : existing?.refreshTokenEnc || '';

  if (existing) {
    await db
      .update(gmailOauthConnections)
      .set({
        gmailEmail: tokenRes.gmailEmail,
        scope: tokenRes.scope || existing.scope,
        accessTokenEnc,
        refreshTokenEnc: refreshTokenEnc || existing.refreshTokenEnc,
        expiresAt,
        updatedAt: now,
      })
      .where(eq(gmailOauthConnections.userId, stateRecord.userId));
  } else {
    await db.insert(gmailOauthConnections).values({
      userId: stateRecord.userId,
      gmailEmail: tokenRes.gmailEmail,
      scope: tokenRes.scope || null,
      accessTokenEnc,
      refreshTokenEnc: refreshTokenEnc || null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.redirect(
    appendQueryToHashPath(redirectTarget, {
      gmail_oauth: 'connected',
      gmail_email: tokenRes.gmailEmail,
    })
  );
});

/**
 * GET /api/oauth/gmail/status
 * Returns Gmail connection status for the authenticated user.
 */
gmailOAuthRouter.get('/status', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const db = getDb(c.env.DB);
  const conn = await db.query.gmailOauthConnections.findFirst({
    where: eq(gmailOauthConnections.userId, user.id),
  });

  return c.json({
    success: true,
    connected: Boolean(conn),
    gmailEmail: conn?.gmailEmail || null,
    scope: conn?.scope || null,
    updatedAt: conn?.updatedAt || null,
  });
});

/**
 * POST /api/oauth/gmail/disconnect
 * Disconnects the user's Gmail account and revokes the stored token best-effort.
 */
gmailOAuthRouter.post('/disconnect', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const db = getDb(c.env.DB);
  const conn = await db.query.gmailOauthConnections.findFirst({
    where: eq(gmailOauthConnections.userId, user.id),
  });

  if (conn) {
    const secret = c.env.GHL_TOKEN_ENCRYPTION_KEY;
    const tokenToRevoke = conn.refreshTokenEnc
      ? await decryptAtRest(conn.refreshTokenEnc, secret)
      : conn.accessTokenEnc
      ? await decryptAtRest(conn.accessTokenEnc, secret)
      : '';

    if (tokenToRevoke) {
      try {
        await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(tokenToRevoke)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // Best-effort revocation; local deletion still proceeds
      }
    }

    await db.delete(gmailOauthConnections).where(eq(gmailOauthConnections.userId, user.id));
  }

  return c.json({
    success: true,
    message: 'Gmail account disconnected.',
  });
});

/**
 * POST /api/oauth/gmail/send
 * Sends an email directly from the user's connected Gmail account.
 */
gmailOAuthRouter.post('/send', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  let body: {
    to?: string;
    subject?: string;
    body?: string;
    contactId?: string;
    signalId?: string;
    draftId?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const to = (body.to || '').trim();
  const subject = (body.subject || '').trim();
  const emailBody = (body.body || '').trim();

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return c.json({ success: false, error: 'A valid recipient email address is required.' }, 400);
  }
  if (!subject) {
    return c.json({ success: false, error: 'Email subject is required.' }, 400);
  }
  if (!emailBody) {
    return c.json({ success: false, error: 'Email body is required.' }, 400);
  }

  const db = getDb(c.env.DB);
  const result = await sendGmailMessage(db, user.id, c.env, {
    to,
    subject,
    body: emailBody,
    senderName: user.name,
    contactId: body.contactId,
    signalId: body.signalId,
    draftId: body.draftId,
  });

  if (!result.success) {
    const status = result.needsReauth ? 401 : 502;
    return c.json(
      {
        success: false,
        needsReauth: Boolean(result.needsReauth),
        error: result.error || 'Failed to send email via Gmail.',
      },
      status
    );
  }

  return c.json({
    success: true,
    messageId: result.messageId,
    threadId: result.threadId,
    fromEmail: result.fromEmail,
    message: `Email sent from ${result.fromEmail} to ${to}.`,
  });
});
