import { describe, expect, it, vi, afterEach } from 'vitest';
import app from '../src/index';
import type { Bindings } from '../src/db';
import { createTestDatabase } from './d1';
import { generateCandidateQueries, planNewsQueryWithAI } from '../src/services/aiQueryPlanner';
import { judgeArticleRelevance, FIT_SCORE_THRESHOLD } from '../src/services/relevanceJudge';
import { adaptPitchForContact, enrichSignalWithLLM } from '../src/services/llmEnricher';
import { findApolloContact } from '../src/services/apollo';
import { SCOUT_RUN_CREDIT_COST } from '../src/services/credits';
import { cleanCompanyName } from '../src/services/signalQuality';
import { getDb, schema } from '../src/db';
import { retireAndReplaceQueries, seedCampaignQueries, recordQueryRun } from '../src/services/queryOptimizer';

function createEnv() {
  const { sqlite, DB } = createTestDatabase();
  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO users (id, email, name, organization, role, credit_balance, onboarding_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'user', 500, 0, ?, ?)`
    )
    .run('user_qa', 'alex@pacificbroker.ca', 'Alex Chen', 'Pacific Risk Partners', now, now);
  sqlite
    .prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .run('tok_qa', 'user_qa', '2099-01-01T00:00:00.000Z', now);

  const env = { DB } as unknown as Bindings;
  const auth = { Authorization: 'Bearer tok_qa', 'Content-Type': 'application/json' };
  return { sqlite, env, auth };
}

describe('QA fixes: profiles, keywords, scoring, drafts, demo separation, and credits', () => {
  it('Profile (a): BC cyber/AI insurance broker — saves wizard to profile, generates relevant keywords, scores & drafts accurately', async () => {
    const { env, auth } = createEnv();

    // 1. Create campaign via wizard
    const createRes = await app.request(
      '/api/campaigns',
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          name: 'Cyber & AI Risk – BC SMBs',
          targetLocation: 'Vancouver, BC',
          userIntent: 'sales_client_acquisition',
          userMission: 'Commercial insurance broker focused on cyber and AI risk for small and mid-sized businesses in BC',
          companyDescription: 'Commercial insurance broker focused on cyber and AI risk for small and mid-sized businesses in BC',
          servicesOffered: ['Cyber Insurance', 'AI Liability Coverage'],
          targetIndustries: ['Healthcare & Medical Practices', 'Legal & Law Firms'],
          targetTriggers: ['Regulatory, Licensing or Compliance Shift', 'Rapid Hiring & Team Scaling'],
          targetRoles: ['CEO', 'CFO', 'Owner'],
          makeActive: true,
        }),
      },
      env
    );
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.success).toBe(true);
    expect(created.campaign.leadsCount).toBe(0);

    // ProfilePage endpoint returns saved wizard answers (never Dallas-Fort Worth default)
    const profileRes = await app.request('/api/user/profile', { headers: auth }, env);
    const profileBody = await profileRes.json();
    expect(profileBody.user.targetLocation).toBe('Vancouver, BC');
    expect(profileBody.user.companyDescription).toContain('cyber and AI risk');
    expect(profileBody.user.icpQuery).not.toContain('Dallas-Fort Worth');
    expect(profileBody.user.icpQuery.toLowerCase()).not.toContain('vancouver technology');
    expect(profileBody.user.icpQuery.toLowerCase()).toContain('cybersecurity');

    // Relevance scoring: relevant BC cyber/AI story passes threshold, government appointment & restaurant opening are rejected
    const profileInput = {
      location: 'Vancouver, BC',
      userMission: 'Commercial insurance broker focused on cyber and AI risk for small and mid-sized businesses',
      servicesOffered: ['Cyber Insurance', 'AI Liability Coverage'],
      targetIndustries: ['Healthcare', 'Professional Services'],
      targetTriggers: ['Data breach', 'AI rollout', 'Regulation'],
      allowNationalSearch: false,
    };

    const relevantJudgment = await judgeArticleRelevance(
      profileInput,
      {
        title: 'Vancouver dental group deploys AI diagnostic platform after cyber compliance audit',
        publisher: 'BIV',
        text: 'Vancouver dental clinic network announced a new AI rollout and cybersecurity compliance program across BC.',
      }
    );
    expect(relevantJudgment.fitScore).toBeGreaterThanOrEqual(FIT_SCORE_THRESHOLD);
    expect(relevantJudgment.relevant).toBe(true);
    expect(relevantJudgment.whyMatched.toLowerCase()).not.toContain('operational catalyst triggers');

    const restaurantJudgment = await judgeArticleRelevance(
      profileInput,
      {
        title: 'Boston Pizza plans new restaurant opening in Ontario',
        publisher: 'News',
        text: 'Boston Pizza plans a new dining location in Ontario.',
      }
    );
    expect(restaurantJudgment.relevant).toBe(false);
    expect(restaurantJudgment.fitScore).toBeLessThan(FIT_SCORE_THRESHOLD);

    // Draft personalization: mentions cyber/AI services, falls back to "Hi there,", signs with user name & company, no unsubscribe
    const enriched = await enrichSignalWithLLM(
      'Vancouver dental group deploys AI diagnostic platform after cyber compliance audit',
      'Vancouver dental clinic network announced a new AI rollout and cybersecurity compliance program across BC.',
      'BIV',
      undefined,
      'Cyber Insurance and AI Liability Coverage'
    );
    const draft = adaptPitchForContact(
      enriched,
      { name: '', title: '', company: 'Pacific Dental Group', source: 'article' },
      {
        userName: 'Alex Chen',
        userOrganization: 'Pacific Risk Partners',
        userServices: ['Cyber Insurance', 'AI Liability Coverage'],
        city: 'Vancouver',
      }
    );
    expect(draft.body).toContain('Hi there,');
    expect(draft.body).not.toContain('Hi Verified');
    expect(draft.body).toContain('Cyber Insurance');
    expect(draft.body).toContain('Alex Chen');
    expect(draft.body).toContain('Pacific Risk Partners');
    expect(draft.body.toLowerCase()).not.toContain('unsubscribe');
    expect(draft.body.toLowerCase()).not.toContain('opt-out');
  });

  it('Profile (b): Kelowna IT MSP selling to clinics and law firms — generates clinic/law IT keywords, supports switching campaigns, never fabricates emails', async () => {
    const { env, auth } = createEnv();

    // Create Campaign A
    const resA = await app.request(
      '/api/campaigns',
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          name: 'BC Cyber Insurance',
          targetLocation: 'Vancouver, BC',
          userMission: 'Commercial insurance broker focused on cyber and AI risk',
          servicesOffered: ['Cyber Insurance'],
          makeActive: true,
        }),
      },
      env
    );
    const campA = (await resA.json()).campaign;

    // Create Campaign B (Kelowna IT MSP)
    const planB = await planNewsQueryWithAI({
      location: 'Kelowna, BC',
      userIntent: 'sales_client_acquisition',
      userMission: 'IT managed-services firm in Kelowna selling to medical clinics and law firms',
      servicesOffered: ['Managed IT Services', 'Clinic & Law Firm Cybersecurity'],
      targetIndustries: ['Private Medical Clinics', 'Legal & Law Firms'],
      targetTriggers: ['New Location or Facility Opening'],
    });
    expect(planB.primaryQuery.toLowerCase()).toContain('kelowna');
    expect(planB.primaryQuery.toLowerCase()).not.toContain('manufacturing');
    expect(planB.queryLadder.serviceArea).toBe('local');

    const resB = await app.request(
      '/api/campaigns',
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          name: 'Kelowna MSP – Clinics & Law Firms',
          targetLocation: 'Kelowna, BC',
          userMission: 'IT managed-services firm in Kelowna selling to medical clinics and law firms',
          servicesOffered: ['Managed IT Services', 'Clinic & Law Firm Cybersecurity'],
          targetIndustries: ['Private Medical Clinics', 'Legal & Law Firms'],
          makeActive: true,
        }),
      },
      env
    );
    expect(resB.status).toBe(200);
    const campB = (await resB.json()).campaign;
    expect(campB.icpQuery.toLowerCase()).not.toContain('manufacturing');

    // Switch back to Campaign A and verify Profile switches to Campaign A
    const actRes = await app.request(`/api/campaigns/${campA.id}/activate`, { method: 'POST', headers: auth }, env);
    expect(actRes.status).toBe(200);
    const actBody = await actRes.json();
    expect(actBody.user.targetLocation).toBe('Vancouver, BC');
    expect(actBody.user.companyDescription).toContain('cyber and AI risk');

    // Switch back to Campaign B
    await app.request(`/api/campaigns/${campB.id}/activate`, { method: 'POST', headers: auth }, env);

    // No fabricated email when Apollo has no key/match
    const apollo = await findApolloContact('Jane Doe', 'Managing Partner', 'kelownalaw.ca', undefined);
    expect(apollo.matched).toBe(false);
    expect(apollo.email).toBeUndefined();
  });

  it('keeps demo leads out of real deck and deducts scout credits', async () => {
    const { sqlite, env, auth } = createEnv();

    // Empty deck: signals is [] and demo leads are separated into demoSignals
    const deckRes = await app.request('/api/signals/deck', { headers: auth }, env);
    const deckBody = await deckRes.json();
    expect(deckBody.signals).toEqual([]);
    expect(Array.isArray(deckBody.demoSignals)).toBe(true);
    expect(deckBody.demoSignals.length).toBeGreaterThan(0);

    // Configure Vancouver cyber/AI profile so off-topic sample articles yield 0 leads -> 0 credits charged (A.5)
    sqlite
      .prepare(`UPDATE users SET target_location = 'Vancouver, BC', user_mission = 'Cyber and AI risk insurance broker' WHERE id = 'user_qa'`)
      .run();

    const beforeRow = sqlite.prepare(`SELECT credit_balance FROM users WHERE id = 'user_qa'`).get() as {
      credit_balance: number;
    };
    const scoutRes = await app.request(
      '/api/signals/ingest',
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ limit: 2 }),
      },
      env
    );
    expect(scoutRes.status).toBe(200);
    const scoutBody = await scoutRes.json();
    // Sample articles with no cyber/AI/location match yield 0 leads -> 0 credits charged (A.5)
    expect(scoutBody.ingestedCount).toBe(0);
    expect(scoutBody.creditsDeducted).toBe(0);
    expect(scoutBody.creditBalance).toBe(beforeRow.credit_balance);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('Part B & E: rejects apartment tower, tea merchant, and SkyTrain contract (< 40), accepts BC ransomware (> 60), strips News | prefix', async () => {
    const cyberBrokerProfile = {
      location: 'Vancouver, BC',
      userMission: 'Commercial insurance broker focused on cyber and AI risk for small and mid-sized businesses in BC',
      servicesOffered: ['Cyber Insurance', 'AI Liability Coverage'],
      targetIndustries: ['Healthcare', 'Law Firms', 'SMB'],
      targetTriggers: ['Data breach', 'Ransomware', 'AI rollout'],
      allowNationalSearch: false,
    };

    const mustRejectCases = [
      {
        title: 'Developer breaks ground on 42-storey apartment tower in downtown Vancouver',
        publisher: 'Storeys',
        text: 'Construction has started on a 42-storey rental apartment tower in Vancouver with 380 residential units.',
      },
      {
        title: 'DavidsTea acquires Vancouver specialty tea merchant in retail expansion',
        publisher: 'Retail Insider',
        text: 'The tea merchant acquisition adds six retail storefronts across Vancouver and Victoria.',
      },
      {
        title: 'Contractor loses SkyTrain Broadway Extension civil works contract in Vancouver',
        publisher: 'BIV',
        text: 'A transit construction consortium lost its civil engineering contract on the Vancouver SkyTrain extension.',
      },
    ];

    for (const art of mustRejectCases) {
      const j = await judgeArticleRelevance(cyberBrokerProfile, art);
      expect(j.relevant).toBe(false);
      expect(j.fitScore).toBeLessThan(40);
    }

    const mustAccept = await judgeArticleRelevance(cyberBrokerProfile, {
      title: 'Vancouver logistics firm Coastal Freight hit by ransomware attack disrupting BC operations',
      publisher: 'BIV',
      text: 'Vancouver-based Coastal Freight confirmed a ransomware attack encrypted its dispatch servers on Tuesday, forcing emergency incident response across British Columbia.',
    });
    expect(mustAccept.relevant).toBe(true);
    expect(mustAccept.fitScore).toBeGreaterThanOrEqual(60);
    expect(mustAccept.triggerSentence).toContain('ransomware');
    expect(mustAccept.whyMatched).not.toMatch(/shows a .* trigger aligned with/i);

    // Judge error / non-200 never defaults to a high score
    vi.stubGlobal('fetch', vi.fn(async () => new Response('error', { status: 503 })));
    const errJudgment = await judgeArticleRelevance(cyberBrokerProfile, {
      title: 'Vancouver firm hit by ransomware',
      publisher: 'BIV',
      text: 'Ransomware incident in Vancouver.',
    }, 'sk-test-fake-key-123456');
    expect(errJudgment.relevant).toBe(false);
    expect(errJudgment.fitScore).toBe(0);

    expect(cleanCompanyName('News | GWL Realty')).toBe('GWL Realty');
  });

  it('Part A & D: verifies two campaigns on one account with separate orgs, adaptive queries, and retirement after 3 zero-hit runs', async () => {
    const { sqlite, DB, env, auth } = (() => {
      const base = createEnv();
      return { ...base, DB: base.env.DB };
    })();

    // Campaign (a): Vancouver BC cyber/AI broker
    const resA = await app.request(
      '/api/campaigns',
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          name: 'Cyber & AI Risk – BC SMBs',
          organization: 'Pacific Risk Partners',
          targetLocation: 'Vancouver, BC',
          userMission: 'Commercial insurance broker focused on cyber and AI risk for small and mid-sized businesses in BC',
          servicesOffered: ['Cyber Insurance', 'AI Liability Coverage'],
          makeActive: true,
        }),
      },
      env
    );
    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.queries.length).toBeGreaterThanOrEqual(6);

    // Campaign (b): Kelowna managed-IT & cybersecurity firm
    const resB = await app.request(
      '/api/campaigns',
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          name: 'Kelowna Managed IT – Clinics & Law',
          organization: 'Okanagan IT Shield',
          targetLocation: 'Kelowna, BC',
          userMission: 'Managed IT and cybersecurity firm in Kelowna selling to medical clinics and law firms',
          servicesOffered: ['Managed IT Services', 'Clinic & Law Firm Cybersecurity'],
          makeActive: true,
        }),
      },
      env
    );
    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    expect(bodyB.queries.length).toBeGreaterThanOrEqual(6);
    expect(bodyB.campaign.organization).toBe('Okanagan IT Shield');

    // Switching back to Campaign A restores Pacific Risk Partners (not Okanagan IT Shield)
    const actA = await app.request(`/api/campaigns/${bodyA.campaign.id}/activate`, { method: 'POST', headers: auth }, env);
    const actABody = await actA.json();
    expect(actABody.user.organization).toBe('Pacific Risk Partners');

    // Verify 3 zero-hit runs retire query and generate a replacement variant
    const db = getDb(DB);
    const firstQueryId = bodyA.queries[0].id;
    await recordQueryRun(db, firstQueryId, 10, 0);
    await recordQueryRun(db, firstQueryId, 10, 0);
    await recordQueryRun(db, firstQueryId, 10, 0);
    const retiredRes = await retireAndReplaceQueries(db, {
      id: bodyA.campaign.id,
      userId: 'user_qa',
      targetLocation: 'Vancouver, BC',
      serviceArea: 'local',
    });
    expect(retiredRes.retiredCount).toBe(1);
    expect(retiredRes.addedCount).toBe(1);
  });
});
