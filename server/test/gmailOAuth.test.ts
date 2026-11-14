import { describe, it, expect, vi, afterEach } from 'vitest';
import app from '../src/index';
import { createTestDatabase } from './d1';
import {
  base64UrlEncodeUtf8,
  buildGmailAuthUrl,
  buildMimeEmail,
  GMAIL_OAUTH_SCOPES,
} from '../src/services/gmailOAuth';
import { encryptAtRest } from '../src/services/crypto';

const NOW = '2026-11-13T12:00:00.000Z';
const LATER = '2027-11-13T12:00:00.000Z';
const ENCRYPTION_KEY = 'test-gmail-encryption-key-32-chars-min!';

function seedGmailTestDb() {
  const { sqlite, DB } = createTestDatabase();
  sqlite
    .prepare(
      `INSERT INTO users (id, email, name, role, credit_balance, created_at, updated_at, onboarding_completed)
       VALUES (?, ?, ?, 'user', 500, ?, ?, 1)`
    )
    .run('user_1', 'kevin@example.test', 'Kevin Day', NOW, NOW);

  sqlite
    .prepare(
      `INSERT INTO users (id, email, name, role, credit_balance, created_at, updated_at, onboarding_completed)
       VALUES (?, ?, ?, 'user', 500, ?, ?, 1)`
    )
    .run('user_2', 'other@example.test', 'Other User', NOW, NOW);

  sqlite
    .prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .run('sess_user_1', 'user_1', LATER, NOW);

  sqlite
    .prepare(
      `INSERT INTO signals (id, user_id, title, source_url, published_at, summary_bullets, company_name, signal_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', ?, 'Funding', 'approved', ?, ?)`
    )
    .run('sig_1', 'user_1', 'Acme raises $10M', 'https://example.test/acme', NOW, 'Acme Corp', NOW, NOW);

  sqlite
    .prepare(
      `INSERT INTO contacts (id, signal_id, name, title, email, created_at, updated_at)
       VALUES (?, ?, ?, 'CEO', ?, ?, ?)`
    )
    .run('ct_1', 'sig_1', 'Jane Doe', 'jane@acme.test', NOW, NOW);

  sqlite
    .prepare(
      `INSERT INTO outreach_drafts (id, signal_id, contact_id, subject, body, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`
    )
    .run('draft_1', 'sig_1', 'ct_1', 'Old Subject', 'Old Body', NOW, NOW);

  return { sqlite, DB };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Gmail OAuth & MIME Email Helpers', () => {
  it('builds a Google OAuth URL with offline access and gmail.send scope', () => {
    const url = buildGmailAuthUrl({
      clientId: 'google-client-123',
      redirectUri: 'https://twinflow.test/api/oauth/gmail/callback',
      state: 'state_abc',
      loginHint: 'kevin@example.test',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(parsed.searchParams.get('client_id')).toBe('google-client-123');
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent select_account');
    expect(parsed.searchParams.get('state')).toBe('state_abc');
    expect(parsed.searchParams.get('login_hint')).toBe('kevin@example.test');
    expect(parsed.searchParams.get('scope')).toBe(GMAIL_OAUTH_SCOPES.join(' '));
  });

  it('constructs RFC 2822 UTF-8 MIME messages, strips CRLF header injection, and encodes base64url', () => {
    const rawMime = buildMimeEmail({
      from: 'kevin@gmail.com',
      senderName: 'Kevin "TwinFlow"\r\nBcc: evil@attacker.test',
      to: 'jane@acme.test\r\nCc: leak@attacker.test',
      subject: 'Congrats on Series A — Quick Question',
      body: 'Hi Jane,\nSaw the announcement.\nBest,\nKevin',
    });

    const [headerBlock, ...bodyParts] = rawMime.split('\r\n\r\n');
    expect(headerBlock).not.toContain('\nBcc:');
    expect(headerBlock).not.toContain('\nCc:');
    expect(headerBlock).toContain('From: Kevin TwinFlow Bcc: evil@attacker.test <kevin@gmail.com>');
    expect(headerBlock).toContain('Subject: =?UTF-8?B?');
    expect(bodyParts.join('\r\n\r\n')).toBe('Hi Jane,\r\nSaw the announcement.\r\nBest,\r\nKevin');

    const encoded = base64UrlEncodeUtf8(rawMime);
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe('Gmail OAuth Routes & Direct Sending', () => {
  it('requires authentication for start, status, disconnect, and send endpoints', async () => {
    const { DB } = seedGmailTestDb();
    const env = { DB, GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csec' };

    const r1 = await app.request('/api/oauth/gmail/start?format=json', {}, env);
    expect(r1.status).toBe(401);

    const r2 = await app.request('/api/oauth/gmail/status', {}, env);
    expect(r2.status).toBe(401);

    const r3 = await app.request('/api/oauth/gmail/disconnect', { method: 'POST' }, env);
    expect(r3.status).toBe(401);

    const r4 = await app.request(
      '/api/oauth/gmail/send',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'a@b.com', subject: 'Hi', body: 'Hello' }),
      },
      env
    );
    expect(r4.status).toBe(401);
  });

  it('completes OAuth start -> callback, stores encrypted tokens, sends email, refreshes expired token, and disconnects', async () => {
    const { sqlite, DB } = seedGmailTestDb();
    const env = {
      DB,
      GOOGLE_CLIENT_ID: 'cid-123',
      GOOGLE_CLIENT_SECRET: 'csec-456',
      GHL_TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY,
      APP_URL: 'https://twinflow.test',
    };

    // 1. Start OAuth flow
    const startRes = await app.request(
      '/api/oauth/gmail/start?format=json',
      { headers: { Authorization: 'Bearer sess_user_1' } },
      env
    );
    expect(startRes.status).toBe(200);
    const startJson = (await startRes.json()) as { success: boolean; authUrl: string };
    expect(startJson.success).toBe(true);
    const state = new URL(startJson.authUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    // 2. Mock Google token + userinfo responses for callback
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(
          JSON.stringify({
            access_token: 'ya29.initial-access-token',
            refresh_token: '1//initial-refresh-token',
            expires_in: 3600,
            scope: GMAIL_OAUTH_SCOPES.join(' '),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
        return new Response(
          JSON.stringify({ email: 'kevin.day@gmail.com', verified_email: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send') {
        return new Response(
          JSON.stringify({ id: 'msg_123', threadId: 'thr_456' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://oauth2.googleapis.com/revoke')) {
        return new Response('', { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const cbRes = await app.request(
      `/api/oauth/gmail/callback?code=auth-code-xyz&state=${encodeURIComponent(state!)}`,
      {},
      env
    );
    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.get('location')).toContain('gmail_oauth=connected');

    // State must be single-use
    const replayRes = await app.request(
      `/api/oauth/gmail/callback?code=auth-code-xyz&state=${encodeURIComponent(state!)}`,
      {},
      env
    );
    expect(replayRes.status).toBe(302);
    expect(replayRes.headers.get('location')).toContain('gmail_oauth=error');

    // Stored tokens must be encrypted
    const row = sqlite
      .prepare('SELECT gmail_email, access_token_enc, refresh_token_enc FROM gmail_oauth_connections WHERE user_id = ?')
      .get('user_1') as { gmail_email: string; access_token_enc: string; refresh_token_enc: string };
    expect(row.gmail_email).toBe('kevin.day@gmail.com');
    expect(row.access_token_enc).toMatch(/^v1:/);
    expect(row.refresh_token_enc).toMatch(/^v1:/);

    // 3. Profile and status endpoints report connected
    const profileRes = await app.request(
      '/api/user/profile',
      { headers: { Authorization: 'Bearer sess_user_1' } },
      env
    );
    const profileJson = (await profileRes.json()) as {
      success: boolean;
      user: { isGmailConnected: boolean; gmailEmail: string };
    };
    expect(profileJson.user.isGmailConnected).toBe(true);
    expect(profileJson.user.gmailEmail).toBe('kevin.day@gmail.com');

    // 4. Force token expiry to verify automatic refresh + send + draft status update
    sqlite
      .prepare('UPDATE gmail_oauth_connections SET expires_at = ? WHERE user_id = ?')
      .run(Date.now() - 10_000, 'user_1');

    // Update fetch mock so refresh returns a new token
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(
          JSON.stringify({
            access_token: 'ya29.refreshed-access-token',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send') {
        const authHeader =
          input instanceof Request ? input.headers.get('Authorization') : undefined;
        if (authHeader && authHeader !== 'Bearer ya29.refreshed-access-token') {
          return new Response('Unauthorized', { status: 401 });
        }
        return new Response(
          JSON.stringify({ id: 'msg_999', threadId: 'thr_999' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://oauth2.googleapis.com/revoke')) {
        return new Response('', { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const sendRes = await app.request(
      '/api/oauth/gmail/send',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer sess_user_1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: 'jane@acme.test',
          subject: 'Congrats on the round!',
          body: 'Hi Jane, congrats on the $10M raise.',
          contactId: 'ct_1',
          signalId: 'sig_1',
          draftId: 'draft_1',
        }),
      },
      env
    );
    expect(sendRes.status).toBe(200);
    const sendJson = (await sendRes.json()) as {
      success: boolean;
      messageId: string;
      fromEmail: string;
    };
    expect(sendJson.success).toBe(true);
    expect(sendJson.messageId).toBe('msg_999');
    expect(sendJson.fromEmail).toBe('kevin.day@gmail.com');

    // Outreach draft should be marked sent
    const draftRow = sqlite
      .prepare('SELECT status, subject, body FROM outreach_drafts WHERE id = ?')
      .get('draft_1') as { status: string; subject: string; body: string };
    expect(draftRow.status).toBe('sent');
    expect(draftRow.subject).toBe('Congrats on the round!');

    // 5. Disconnect clears connection
    const discRes = await app.request(
      '/api/oauth/gmail/disconnect',
      { method: 'POST', headers: { Authorization: 'Bearer sess_user_1' } },
      env
    );
    expect(discRes.status).toBe(200);

    const statusAfter = await app.request(
      '/api/oauth/gmail/status',
      { headers: { Authorization: 'Bearer sess_user_1' } },
      env
    );
    const statusJson = (await statusAfter.json()) as { connected: boolean; gmailEmail: string | null };
    expect(statusJson.connected).toBe(false);
    expect(statusJson.gmailEmail).toBeNull();

    // Verify encrypted helper wasn't broken
    const encCheck = await encryptAtRest('check', ENCRYPTION_KEY);
    expect(encCheck.startsWith('v1:')).toBe(true);
  });
});
