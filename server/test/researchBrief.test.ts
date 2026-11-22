import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { createTestDatabase } from './d1';
import { runVerificationGate, type SourceDocument } from '../src/services/briefGenerator';

const NOW = '2026-11-21T05:00:00.000Z';
const LATER = '2027-11-21T05:00:00.000Z';

function seedBriefTestDb() {
  const { sqlite, DB } = createTestDatabase();

  const insertUser = sqlite.prepare(
    `INSERT INTO users (id, email, name, role, credit_balance, total_points, organization, value_prop, created_at, updated_at, onboarding_completed)
     VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?, ?, 1)`
  );
  insertUser.run(
    'user_rich',
    'rich@example.test',
    'Rich User',
    25,
    100,
    'Ocean Falls Insurance Services',
    'Commercial insurance & risk advisory',
    NOW,
    NOW
  );
  insertUser.run(
    'user_low',
    'low@example.test',
    'Low Credit User',
    5,
    40,
    'Ocean Falls Insurance Services',
    'Commercial insurance & risk advisory',
    NOW,
    NOW
  );

  sqlite.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).run('tok_rich', 'user_rich', LATER, NOW);
  sqlite.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).run('tok_low', 'user_low', LATER, NOW);

  sqlite.prepare(
    `INSERT INTO signals (
      id, user_id, title, source_url, published_at, summary_bullets,
      article_summary, source_excerpts, source_snapshot, company_name,
      signal_type, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`
  ).run(
    'sig_pacific',
    'user_rich',
    'Pacific Timber opens $18M automated mill in Surrey',
    'https://news.example.test/pacific-timber',
    NOW,
    JSON.stringify(['Opened $18M mill in Surrey']),
    'Pacific Timber opened an $18M automated mill in Surrey, BC, adding 45 employees.',
    JSON.stringify([
      {
        quote: 'Pacific Timber invested $18 million in a new automated mill in Surrey, BC.',
        context: 'Article excerpt',
      },
      {
        quote: 'The facility will add 45 full-time operations roles over the next year.',
        context: 'Article excerpt',
      },
    ]),
    'Pacific Timber invested $18 million in a new automated mill in Surrey, BC. The facility will add 45 full-time operations roles over the next year.',
    'Pacific Timber',
    'Facility / Branch Opening',
    NOW,
    NOW
  );

  return { sqlite, env: { DB } };
}

describe('Research Brief Verification Gate', () => {
  it('rejects unsupported claims/figures and sanitizes speculative accusations', async () => {
    const sources: SourceDocument[] = [
      {
        label: 'news.example.test',
        url: 'https://news.example.test/pacific-timber',
        date: '2026-11-21',
        text: 'Pacific Timber invested $18 million in a new automated mill in Surrey, BC. The facility will add 45 full-time operations roles.',
      },
    ];

    const result = await runVerificationGate({
      sources,
      pass1Brief: {
        briefTitle: 'Pacific Timber — Research Brief',
        verifiedFacts: [
          {
            statement: 'Pacific Timber invested $18 million in a new automated mill in Surrey, BC.',
            sourceUrl: 'https://news.example.test/pacific-timber',
            sourceLabel: 'news.example.test',
            sourceDate: '2026-11-21',
            verbatimQuote: 'Pacific Timber invested $18 million in a new automated mill in Surrey, BC.',
          },
          {
            statement: 'Pacific Timber raised $99 million in Series C debt financing in Toronto.',
            sourceUrl: 'https://news.example.test/pacific-timber',
            sourceLabel: 'news.example.test',
            sourceDate: '2026-11-21',
            verbatimQuote: 'Pacific Timber raised $99 million in Series C debt financing in Toronto.',
          },
        ],
        inferredOpportunities: [
          {
            area: 'Property & Equipment Coverage',
            rationale: 'Pacific Timber has no automated equipment breakdown coverage and lacks cyber protection.',
            confidence: 'high',
          },
        ],
        investigationQuestions: [
          'How is Pacific Timber structuring property coverage for the Surrey mill?',
        ],
      },
    });

    expect(result.verifiedFacts).toHaveLength(1);
    expect(result.verifiedFacts[0].statement).toContain('$18 million');
    expect(result.verificationLog.rejectedFacts).toBe(1);
    expect(result.verificationLog.keptFacts).toBe(1);

    expect(result.inferredOpportunities[0].rationale).not.toMatch(/\bhas no\b/i);
    expect(result.inferredOpportunities[0].rationale).not.toMatch(/\blacks\b/i);
    expect(result.inferredOpportunities[0].rationale).toContain('may benefit from reviewing');
    expect(result.verificationLog.rewrittenOpportunities).toBeGreaterThanOrEqual(1);
  });
});

describe('Research Brief API Endpoints', () => {
  it('requires authentication for GET and POST /api/contacts/organization/brief', async () => {
    const { env } = seedBriefTestDb();

    const getRes = await app.request(
      'http://localhost/api/contacts/organization/brief?orgName=Pacific%20Timber',
      { method: 'GET' },
      env
    );
    expect(getRes.status).toBe(401);

    const postRes = await app.request(
      'http://localhost/api/contacts/organization/brief',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName: 'Pacific Timber' }),
      },
      env
    );
    expect(postRes.status).toBe(401);
  });

  it('returns 402 when creditBalance < 10 and does not deduct credits', async () => {
    const { sqlite, env } = seedBriefTestDb();

    const res = await app.request(
      'http://localhost/api/contacts/organization/brief',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer tok_low',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationName: 'Pacific Timber' }),
      },
      env
    );
    expect(res.status).toBe(402);

    const userRow = sqlite
      .prepare('SELECT credit_balance, total_points FROM users WHERE id = ?')
      .get('user_low') as { credit_balance: number; total_points: number };
    expect(userRow.credit_balance).toBe(5);
    expect(userRow.total_points).toBe(40);
  });

  it('deducts 10 credits, logs transaction, awards +15 XP, persists brief, and retrieves it via GET', async () => {
    const { sqlite, env } = seedBriefTestDb();

    const postRes = await app.request(
      'http://localhost/api/contacts/organization/brief',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer tok_rich',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationName: 'Pacific Timber',
          signalId: 'sig_pacific',
        }),
      },
      env
    );
    expect(postRes.status).toBe(200);
    const postData = (await postRes.json()) as {
      success: boolean;
      creditBalance: number;
      totalPoints: number;
      brief: {
        id: string;
        organizationName: string;
        verifiedFacts: Array<{ statement: string; verbatimQuote: string }>;
        inferredOpportunities: Array<{ area: string; rationale: string }>;
        investigationQuestions: string[];
      };
    };

    expect(postData.success).toBe(true);
    expect(postData.creditBalance).toBe(15);
    expect(postData.totalPoints).toBe(115);
    expect(postData.brief.organizationName).toBe('Pacific Timber');
    expect(postData.brief.verifiedFacts.length).toBeGreaterThanOrEqual(1);
    expect(postData.brief.inferredOpportunities.length).toBeGreaterThanOrEqual(1);
    expect(postData.brief.investigationQuestions.length).toBe(3);

    const txRow = sqlite
      .prepare('SELECT amount, balance_after, type, reference_id FROM credit_transactions WHERE user_id = ?')
      .get('user_rich') as { amount: number; balance_after: number; type: string; reference_id: string };
    expect(txRow.amount).toBe(-10);
    expect(txRow.balance_after).toBe(15);
    expect(txRow.type).toBe('research_brief');
    expect(txRow.reference_id).toBe(postData.brief.id);

    const getRes = await app.request(
      'http://localhost/api/contacts/organization/brief?orgName=Pacific%20Timber',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer tok_rich' },
      },
      env
    );
    expect(getRes.status).toBe(200);
    const getData = (await getRes.json()) as { success: boolean; brief: { id: string } | null };
    expect(getData.success).toBe(true);
    expect(getData.brief?.id).toBe(postData.brief.id);

    // Tenant isolation: another user cannot read user_rich's brief
    const otherGetRes = await app.request(
      'http://localhost/api/contacts/organization/brief?orgName=Pacific%20Timber',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer tok_low' },
      },
      env
    );
    expect(otherGetRes.status).toBe(200);
    const otherData = (await otherGetRes.json()) as { success: boolean; brief: null };
    expect(otherData.brief).toBeNull();
  });
});
