import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { createTestDatabase } from './d1';
import { DEV_REPLENISH_CREDITS } from '../src/services/credits';

const NOW = '2026-11-05T12:00:00.000Z';
const LATER = '2027-11-05T12:00:00.000Z';

function seedAccounts() {
  const { sqlite, DB } = createTestDatabase();
  const insertUser = sqlite.prepare(
    `INSERT INTO users (id, email, name, role, credit_balance, ghl_api_key, ghl_subaccount_id, created_at, updated_at, onboarding_completed)
     VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?, 1)`
  );
  insertUser.run('user_a', 'a@example.test', 'User A', 500, 'pit-secret-user-a-1234', 'loc_a', NOW, NOW);
  insertUser.run('user_b', 'b@example.test', 'User B', 420, 'pit-secret-user-b-9876', 'loc_b', NOW, NOW);

  const insertSignal = sqlite.prepare(
    `INSERT INTO signals (id, user_id, title, source_url, published_at, summary_bullets, company_name, signal_type, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '[]', ?, 'Funding', 'approved', ?, ?)`
  );
  insertSignal.run('sig_a', 'user_a', 'A signal', 'https://example.test/a', NOW, 'Company A', NOW, NOW);
  insertSignal.run('sig_b', 'user_b', 'B signal', 'https://example.test/b', NOW, 'Company B', NOW, NOW);

  const insertContact = sqlite.prepare(
    `INSERT INTO contacts (id, signal_id, name, title, email, linkedin_url, ghl_contact_id, created_at, updated_at)
     VALUES (?, ?, ?, 'CEO', ?, ?, ?, ?, ?)`
  );
  insertContact.run(
    'ct_a',
    'sig_a',
    'Avery Owner',
    'avery@company-a.test',
    'https://linkedin.com/in/avery-owner',
    'ghl_a',
    NOW,
    NOW
  );
  insertContact.run(
    'ct_b',
    'sig_b',
    'Blair Private',
    'blair.private@company-b.test',
    'https://linkedin.com/in/blair-private',
    'ghl_b',
    NOW,
    NOW
  );

  sqlite.prepare(
    `INSERT INTO outreach_drafts (id, signal_id, contact_id, subject, body, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`
  ).run('dr_b', 'sig_b', 'ct_b', 'Secret subject', 'Secret pitch body', NOW, NOW);

  sqlite.prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(
    'token_a',
    'user_a',
    LATER,
    NOW
  );
  sqlite.prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(
    'token_b',
    'user_b',
    LATER,
    NOW
  );

  sqlite.prepare(
    `INSERT INTO campaigns (id, user_id, name, status, is_default, created_at, updated_at) VALUES (?, ?, ?, 'active', 1, ?, ?)`
  ).run('camp_b', 'user_b', 'Blair campaign', NOW, NOW);

  return { sqlite, env: { DB, STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' } };
}

function auth(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function stripeSignature(secret: string, body: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `t=${timestamp},v1=${hex}`;
}

describe('API authentication and tenant isolation', () => {
  it('returns 401 for an unauthenticated GET /api/contacts', async () => {
    const { env } = seedAccounts();
    const res = await app.request('/api/contacts', {}, env);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('blair.private@company-b.test');
    expect(JSON.stringify(body)).not.toContain('avery@company-a.test');
  });

  it('does not let user A read user B contacts', async () => {
    const { env } = seedAccounts();
    const res = await app.request('/api/contacts?status=all', { headers: auth('token_a') }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    const serialized = JSON.stringify(body);
    expect(serialized).toContain('avery@company-a.test');
    expect(serialized).not.toContain('blair.private@company-b.test');
    expect(serialized).not.toContain('ghl_b');
    expect(serialized).not.toContain('Secret pitch body');
    expect(body.contacts).toHaveLength(1);
    expect(body.contacts[0].id).toBe('ct_a');
  });

  it('returns 404 when user A deletes user B contact and leaves the row in place', async () => {
    const { sqlite, env } = seedAccounts();
    const res = await app.request('/api/contacts/ct_b', { method: 'DELETE', headers: auth('token_a') }, env);
    expect(res.status).toBe(404);
    const remaining = sqlite.prepare(`SELECT email FROM contacts WHERE id = 'ct_b'`).get() as { email: string };
    expect(remaining.email).toBe('blair.private@company-b.test');
  });

  it('serves only the fake demo deck to guests', async () => {
    const { env } = seedAccounts();
    const res = await app.request('/api/signals/deck', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isDemo).toBe(true);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('blair.private@company-b.test');
    expect(serialized).not.toContain('avery@company-a.test');
    expect(serialized).not.toContain('ghl_');
    for (const signal of body.signals) {
      expect(signal.id.startsWith('demo-')).toBe(true);
    }
  });

  it('scopes an authenticated deck to that user', async () => {
    const { sqlite, env } = seedAccounts();
    sqlite.prepare(`UPDATE signals SET status = 'queued' WHERE id IN ('sig_a', 'sig_b')`).run();
    const res = await app.request('/api/signals/deck', { headers: auth('token_a') }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isDemo).toBeUndefined();
    const serialized = JSON.stringify(body);
    expect(serialized).toContain('avery@company-a.test');
    expect(serialized).not.toContain('blair.private@company-b.test');
  });

  it('does not write or reveal another account from guest signal actions', async () => {
    const { sqlite, env } = seedAccounts();
    const res = await app.request(
      '/api/signals/sig_b/action',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      },
      env
    );
    expect(res.status).toBe(401);
    const row = sqlite.prepare(`SELECT status FROM signals WHERE id = 'sig_b'`).get() as { status: string };
    const balance = sqlite.prepare(`SELECT credit_balance FROM users WHERE id = 'user_b'`).get() as {
      credit_balance: number;
    };
    expect(row.status).toBe('approved');
    expect(balance.credit_balance).toBe(420);
  });

  it('refuses cross-account signal actions', async () => {
    const { sqlite, env } = seedAccounts();
    const res = await app.request(
      '/api/signals/sig_b/action',
      {
        method: 'POST',
        headers: { ...auth('token_a'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pass' }),
      },
      env
    );
    expect(res.status).toBe(404);
    const row = sqlite.prepare(`SELECT status FROM signals WHERE id = 'sig_b'`).get() as { status: string };
    expect(row.status).toBe('approved');
  });

  it('requires auth for credit history, ingestion, onboarding, and the signal index', async () => {
    const { env } = seedAccounts();
    for (const path of ['/api/signals/credits', '/api/signals', '/api/user/onboarding', '/api/signals/ingest']) {
      const res = await app.request(path, { method: path.endsWith('credits') || path === '/api/signals' ? 'GET' : 'POST' }, env);
      expect(res.status).toBe(401);
    }
  });

  it('ignores a client credit amount and only grants the server replenishment', async () => {
    const { sqlite, env } = seedAccounts();
    const denied = await app.request(
      '/api/signals/credits/replenish',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 1000000 }) },
      env
    );
    expect(denied.status).toBe(401);

    const res = await app.request(
      '/api/signals/credits/replenish',
      {
        method: 'POST',
        headers: { ...auth('token_a'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000000 }),
      },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creditBalance).toBe(500 + DEV_REPLENISH_CREDITS);
    const balance = sqlite.prepare(`SELECT credit_balance FROM users WHERE id = 'user_a'`).get() as {
      credit_balance: number;
    };
    expect(balance.credit_balance).toBe(500 + DEV_REPLENISH_CREDITS);
    const other = sqlite.prepare(`SELECT credit_balance FROM users WHERE id = 'user_b'`).get() as {
      credit_balance: number;
    };
    expect(other.credit_balance).toBe(420);
  });

  it('rejects unsigned Google login payloads', async () => {
    const { sqlite, env } = seedAccounts();
    const res = await app.request(
      '/api/auth/google',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'b@example.test', name: 'Impersonator' }),
      },
      env
    );
    expect(res.status).toBe(401);
    const sessions = sqlite.prepare(`SELECT COUNT(*) AS n FROM sessions`).get() as { n: number };
    expect(sessions.n).toBe(2);
  });

  it('hides agency subaccounts and the auth profile token from other callers', async () => {
    const { env } = seedAccounts();
    const guest = await app.request('/api/signals/ghl/subaccounts', {}, env);
    expect(guest.status).toBe(401);
    expect(JSON.stringify(await guest.json())).not.toContain('feedmesports');

    const me = await app.request('/api/auth/me', { headers: auth('token_b') }, env);
    expect(me.status).toBe(200);
    const profile = await me.json();
    expect(profile.user.ghlApiKey).toBeUndefined();
    expect(profile.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(profile)).not.toContain('pit-secret-user-b-9876');
  });

  it('does not let user A archive user B campaign', async () => {
    const { sqlite, env } = seedAccounts();
    const res = await app.request('/api/campaigns/camp_b', { method: 'DELETE', headers: auth('token_a') }, env);
    expect(res.status).toBe(404);
    const row = sqlite.prepare(`SELECT status FROM campaigns WHERE id = 'camp_b'`).get() as { status: string };
    expect(row.status).toBe('active');
  });

  it('keeps /api/health public', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });
});

describe('Stripe webhook signatures', () => {
  it('rejects a missing or invalid signature and does not change credits', async () => {
    const { sqlite, env } = seedAccounts();
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { amount_total: 4900, metadata: { creditBalance: 99999, userId: 'user_b' } } },
    });

    const missing = await app.request(
      '/api/stripe/webhook',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload },
      env
    );
    expect(missing.status).toBe(400);

    const forged = await app.request(
      '/api/stripe/webhook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': `t=${Math.floor(Date.now() / 1000)},v1=${'ab'.repeat(32)}`,
        },
        body: payload,
      },
      env
    );
    expect(forged.status).toBe(400);

    const balance = sqlite.prepare(`SELECT credit_balance FROM users WHERE id = 'user_b'`).get() as {
      credit_balance: number;
    };
    expect(balance.credit_balance).toBe(420);
  });

  it('accepts a valid signature and still does not mint credits from the body', async () => {
    const { sqlite, env } = seedAccounts();
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { amount_total: 19900, metadata: { credits: 2500, userId: 'user_a' } } },
    });
    const signature = await stripeSignature('whsec_test_secret', payload);
    const res = await app.request(
      '/api/stripe/webhook',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
        body: payload,
      },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creditsApplied).toBe(0);
    const balance = sqlite.prepare(`SELECT credit_balance FROM users WHERE id = 'user_a'`).get() as {
      credit_balance: number;
    };
    expect(balance.credit_balance).toBe(500);
  });
});

describe('CORS allowlist', () => {
  it('echoes twinflow and localhost origins and rejects everyone else', async () => {
    const allowed = await app.request('/api/health', { headers: { Origin: 'https://twinflow.co' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://twinflow.co');

    const www = await app.request('/api/health', { headers: { Origin: 'https://www.twinflow.co' } });
    expect(www.headers.get('access-control-allow-origin')).toBe('https://www.twinflow.co');

    const local = await app.request('/api/health', { headers: { Origin: 'http://localhost:5173' } });
    expect(local.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    const evil = await app.request('/api/health', { headers: { Origin: 'https://evil.example' } });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
    expect(evil.headers.get('access-control-allow-origin')).not.toBe('*');

    const preflight = await app.request('/api/contacts', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
  });
});
