import { describe, expect, it, vi, afterEach } from 'vitest';
import app from '../src/index';
import type { Bindings } from '../src/db';
import { createTestDatabase } from './d1';
import { generateCandidateQueries, planNewsQueryWithAI } from '../src/services/aiQueryPlanner';
import { buildFallbackCustomerModel } from '../src/services/customerModel';
import { judgeArticleRelevance, FIT_SCORE_THRESHOLD } from '../src/services/relevanceJudge';
import { adaptPitchForContact, enrichSignalWithLLM } from '../src/services/llmEnricher';
import { findApolloContact } from '../src/services/apollo';
import { SCOUT_RUN_CREDIT_COST } from '../src/services/credits';
import { cleanCompanyName } from '../src/services/signalQuality';
import { getDb, schema } from '../src/db';
import { retireAndReplaceQueries, seedCampaignQueries, recordQueryRun, selectQueriesForScout } from '../src/services/queryOptimizer';
import { rankCandidatesForJudge } from '../src/services/llmEnricher';

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
    expect(profileBody.user.icpQuery.toLowerCase()).toContain('vancouver');

    // Relevance scoring with explicit CustomerModel: matching customer & signal passes, unrelated restaurant opening is rejected
    const customerModel = buildFallbackCustomerModel({
      location: 'Vancouver, BC',
      userMission: 'Commercial insurance broker focused on cyber and AI risk for small and mid-sized businesses',
      servicesOffered: ['Cyber Insurance', 'AI Liability Coverage'],
      targetIndustries: ['Healthcare', 'Professional Services'],
      targetTriggers: ['Data breach', 'AI rollout', 'Regulation'],
      serviceArea: 'local',
    });
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
        title: 'Vancouver healthcare clinic deploys AI diagnostic platform after compliance audit',
        publisher: 'BIV',
        text: 'Vancouver healthcare clinic network announced a new AI rollout and compliance program across BC.',
      },
      undefined,
      customerModel
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
      },
      undefined,
      customerModel
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

  it('Three-industry generic test: insurance broker, bakery supplier, and commercial cleaner produce distinct customer models, 10-15 queries, and kept leads', async () => {
    const { env, auth } = createEnv();

    const campaigns = [
      {
        name: 'Insurance Broker – Vancouver',
        organization: 'Pacific Risk Partners',
        targetLocation: 'Vancouver, BC',
        userMission: 'Commercial liability and property insurance broker for contractors and logistics companies',
        servicesOffered: ['Commercial Liability Insurance', 'Fleet Coverage'],
        targetIndustries: ['Construction', 'Logistics'],
        targetTriggers: ['New Contract', 'Fleet Expansion'],
        relevantArticle: {
          title: 'Vancouver logistics company wins regional freight contract and expands fleet',
          publisher: 'BIV',
          text: 'Vancouver logistics operator Pacific Haulage signed a new contract and expanded its warehouse and fleet.',
        },
        offTopicArticle: {
          title: 'Seattle coffee roaster launches seasonal espresso blend',
          publisher: 'Food News',
          text: 'A Seattle coffee shop introduced a new seasonal drink.',
        },
      },
      {
        name: 'Bakery Supplier – Portland',
        organization: 'Cascade Flour & Ovens',
        targetLocation: 'Portland, Oregon',
        userMission: 'Wholesale flour, butter, and commercial baking ovens supplier for bakeries, cafes, and restaurants',
        servicesOffered: ['Wholesale Baking Ingredients', 'Commercial Ovens'],
        targetIndustries: ['Bakeries', 'Cafes', 'Restaurants'],
        targetTriggers: ['New Bakery Opening', 'Kitchen Expansion'],
        relevantArticle: {
          title: 'Portland artisan bakery opens second cafe and expands kitchen',
          publisher: 'Eater Portland',
          text: 'Portland bakery Hearth & Crumb announced a new bakery opening and kitchen expansion downtown.',
        },
        offTopicArticle: {
          title: 'Dallas software vendor releases accounting patch',
          publisher: 'TechWire',
          text: 'A Texas software company updated its cloud product.',
        },
      },
      {
        name: 'Commercial Cleaner – Calgary',
        organization: 'Foothills Facility Care',
        targetLocation: 'Calgary, Alberta',
        userMission: 'Commercial janitorial and post-construction cleaning for medical clinics, offices, and retail stores',
        servicesOffered: ['Nightly Janitorial', 'Post-Construction Cleaning'],
        targetIndustries: ['Medical Clinics', 'Commercial Offices'],
        targetTriggers: ['New Office Opening', 'Clinic Renovation'],
        relevantArticle: {
          title: 'Calgary medical clinic completes renovation and opens new office wing',
          publisher: 'Calgary Herald',
          text: 'A Calgary medical clinic finished a major clinic renovation and new office expansion in Alberta.',
        },
        offTopicArticle: {
          title: 'Toronto fintech startup raises seed round',
          publisher: 'BetaKit',
          text: 'An Ontario fintech raised venture capital.',
        },
      },
    ];

    const querySets: string[][] = [];
    for (const spec of campaigns) {
      const res = await app.request(
        '/api/campaigns',
        {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            name: spec.name,
            organization: spec.organization,
            targetLocation: spec.targetLocation,
            userMission: spec.userMission,
            servicesOffered: spec.servicesOffered,
            targetIndustries: spec.targetIndustries,
            targetTriggers: spec.targetTriggers,
            makeActive: true,
          }),
        },
        env
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.campaign.customerModel).toBeTruthy();
      expect(body.campaign.customerModel.idealCustomerTypes.length).toBeGreaterThan(0);
      expect(body.campaign.customerModel.buyingSignals.length).toBeGreaterThan(0);
      expect(body.queries.length).toBeGreaterThanOrEqual(10);
      expect(body.queries.length).toBeLessThanOrEqual(15);

      const qTexts = body.queries.map((q: { queryText: string }) => q.queryText.toLowerCase());
      querySets.push(qTexts);

      const cityToken = spec.targetLocation.split(',')[0].trim().toLowerCase();
      expect(qTexts.some((q: string) => q.includes(cityToken))).toBe(true);

      const good = await judgeArticleRelevance(
        {
          location: spec.targetLocation,
          userMission: spec.userMission,
          servicesOffered: spec.servicesOffered,
          targetIndustries: spec.targetIndustries,
          targetTriggers: spec.targetTriggers,
          allowNationalSearch: false,
        },
        spec.relevantArticle,
        undefined,
        body.campaign.customerModel
      );
      expect(good.relevant).toBe(true);
      expect(good.fitScore).toBeGreaterThanOrEqual(FIT_SCORE_THRESHOLD);

      const bad = await judgeArticleRelevance(
        {
          location: spec.targetLocation,
          userMission: spec.userMission,
          servicesOffered: spec.servicesOffered,
          targetIndustries: spec.targetIndustries,
          targetTriggers: spec.targetTriggers,
          allowNationalSearch: false,
        },
        spec.offTopicArticle,
        undefined,
        body.campaign.customerModel
      );
      expect(bad.relevant).toBe(false);
      expect(bad.fitScore).toBeLessThan(FIT_SCORE_THRESHOLD);
    }

    // No shared queries across the 3 distinct industries/locations
    const overlap01 = querySets[0].filter((q) => querySets[1].includes(q));
    const overlap12 = querySets[1].filter((q) => querySets[2].includes(q));
    expect(overlap01).toEqual([]);
    expect(overlap12).toEqual([]);
  });

  it('Judge error rejects unscored (fitScore 0) and strips News | prefix', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('error', { status: 503 })));
    const errJudgment = await judgeArticleRelevance(
      {
        location: 'Vancouver, BC',
        userMission: 'Commercial cleaning services',
        servicesOffered: ['Janitorial'],
        allowNationalSearch: false,
      },
      {
        title: 'Vancouver office opens',
        publisher: 'BIV',
        text: 'New office in Vancouver.',
      },
      'sk-test-fake-key-123456'
    );
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

    // Verify 2 best by hit rate + 2 least-run/untested rotation
    const allQ = await db.query.campaignQueries.findMany();
    const rotated = selectQueriesForScout(allQ, 4);
    expect(rotated).toHaveLength(4);
    expect(rotated.some((q) => q.runs === 0)).toBe(true);

    // Verify rankCandidatesForJudge never drops on keyword/location gates
    const ranked = rankCandidatesForJudge(
      [
        { index: 0, title: 'General business update', snippet: 'Company expands.', publisher: 'News' },
        { index: 1, title: 'Vancouver firm hit by ransomware', snippet: 'BC breach response.', publisher: 'BIV' },
      ],
      { offering: 'Cyber Insurance', location: 'Vancouver, BC', serviceArea: 'local' },
      10
    );
    expect(ranked.selectedIndices).toEqual([1, 0]);
  });

  it('Quick-add manual article ingestion works with personal ingestToken (no session login required) and deduplicates URLs', async () => {
    const { env, auth } = createEnv();

    // Fetch personal ingest token
    const tokRes = await app.request('/api/user/ingest-token', { headers: auth }, env);
    expect(tokRes.status).toBe(200);
    const tokBody = await tokRes.json();
    expect(tokBody.ingestToken).toMatch(/^tf_[a-f0-9]+$/);
    expect(tokBody.forwardingEmail).toBe(`leads+${tokBody.ingestToken}@twinflow.co`);

    // Add an article using ONLY the ingestToken (no Authorization header)
    const addRes = await app.request(
      `/api/signals/quick-add?token=${tokBody.ingestToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://biv.com/news/salish-soils-expands-metro-vancouver',
          title: 'Salish Soils expands operations into Metro Vancouver',
          text: 'Salish Soils announced a new Metro Vancouver facility expansion with CEO Jane Doe.',
        }),
      },
      env
    );
    expect(addRes.status).toBe(200);
    const addBody = await addRes.json();
    expect(addBody.success).toBe(true);
    expect(addBody.signalId).toBeTruthy();

    // Duplicate URL returns duplicate=true instead of creating a second card
    const dupRes = await app.request(
      `/api/signals/quick-add?token=${tokBody.ingestToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://biv.com/news/salish-soils-expands-metro-vancouver',
        }),
      },
      env
    );
    const dupBody = await dupRes.json();
    expect(dupBody.duplicate).toBe(true);

    // Rotate token invalidates old token
    const rotRes = await app.request('/api/user/ingest-token/rotate', { method: 'POST', headers: auth }, env);
    const rotBody = await rotRes.json();
    expect(rotBody.ingestToken).not.toBe(tokBody.ingestToken);
    const oldFail = await app.request(
      `/api/signals/quick-add?token=${tokBody.ingestToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Should fail' }),
      },
      env
    );
    expect(oldFail.status).toBe(401);
  });
});
