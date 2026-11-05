import { Hono } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getSessionUser } from './auth';
import { planNewsQueryWithAI } from '../services/aiQueryPlanner';
import { isLowYieldArticle, isRelevantToProfile } from '../services/signalQuality';
import { fetchSerpNews } from '../services/serpNews';
import { crawlArticle } from '../services/firecrawl';
import { enrichSignalWithLLM } from '../services/llmEnricher';
import { findApolloContact } from '../services/apollo';

export const campaignsRouter = new Hono<{ Bindings: Bindings }>();

// Helper to ensure a user has at least one active default campaign
async function ensureDefaultCampaign(
  db: ReturnType<typeof getDb>,
  user: typeof schema.users.$inferSelect
) {
  const existing = await db.query.campaigns.findMany({
    where: and(
      eq(schema.campaigns.userId, user.id),
      eq(schema.campaigns.status, 'active')
    ),
  });

  if (existing.length > 0) {
    if (!user.activeCampaignId || !existing.some((c) => c.id === user.activeCampaignId)) {
      await db
        .update(schema.users)
        .set({ activeCampaignId: existing[0].id })
        .where(eq(schema.users.id, user.id));
      user.activeCampaignId = existing[0].id;
    }
    return existing;
  }

  // Create starter campaign from user's profile or default
  const campaignId = `cmp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const location = user.targetLocation || 'Pacific Northwest & Canada';
  const industries = user.targetIndustries
    ? JSON.parse(user.targetIndustries)
    : ['General Contracting & Construction', 'Commercial Real Estate', 'B2B SaaS'];
  const triggers = user.targetTriggers
    ? JSON.parse(user.targetTriggers)
    : ['Facility / Branch Opening', 'RFP & Contract Awards', 'Series A Funding'];
  const roles = user.targetRoles ? JSON.parse(user.targetRoles) : ['CEO', 'Managing Director', 'VP Procurement'];

  const initialName = `${location.split(',')[0]} - ${industries[0] || 'Target Pipeline'}`;

  const newCampaign: typeof schema.campaigns.$inferInsert = {
    id: campaignId,
    userId: user.id,
    name: initialName,
    targetLocation: location,
    userIntent: user.userIntent || 'sales_client_acquisition',
    userMission: user.userMission || 'Deliver high-impact workflow intelligence and strategic enterprise solutions',
    targetIndustries: JSON.stringify(industries),
    targetTriggers: JSON.stringify(triggers),
    targetRoles: JSON.stringify(roles),
    valueProp: user.valueProp || 'Partnering with scaling firms to protect and accelerate growth during expansion.',
    icpQuery: user.icpQuery || `${location.split(',')[0]} commercial expansion RFP contract award`,
    isDefault: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.campaigns).values(newCampaign);
  await db
    .update(schema.users)
    .set({
      activeCampaignId: campaignId,
      onboardingCompleted: true,
    })
    .where(eq(schema.users.id, user.id));

  user.activeCampaignId = campaignId;
  return [newCampaign as typeof schema.campaigns.$inferSelect];
}

// GET /api/campaigns - List all campaigns for the current user
campaignsRouter.get('/', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  // Ensure user has at least one default campaign
  const userCampaigns = await ensureDefaultCampaign(db, user);

  // Fetch all active campaigns ordered by creation date
  const allCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(schema.campaigns.userId, user.id),
      eq(schema.campaigns.status, 'active')
    ),
    orderBy: [desc(schema.campaigns.createdAt)],
  });

  const activeId = user.activeCampaignId || allCampaigns[0]?.id;

  // Format campaigns with lead count
  const formatted = await Promise.all(
    allCampaigns.map(async (cmp) => {
      // Count queued signals associated with this campaign or default
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.signals)
        .where(
          and(
            eq(schema.signals.userId, user.id),
            eq(schema.signals.status, 'queued'),
            cmp.isDefault
              ? sql`(${schema.signals.campaignId} = ${cmp.id} OR ${schema.signals.campaignId} IS NULL)`
              : eq(schema.signals.campaignId, cmp.id)
          )
        );

      const leadsCount = countResult[0]?.count || 0;

      return {
        id: cmp.id,
        name: cmp.name,
        targetLocation: cmp.targetLocation || '',
        userIntent: cmp.userIntent || 'sales_client_acquisition',
        userMission: cmp.userMission || '',
        targetIndustries: cmp.targetIndustries ? JSON.parse(cmp.targetIndustries) : [],
        targetTriggers: cmp.targetTriggers ? JSON.parse(cmp.targetTriggers) : [],
        targetRoles: cmp.targetRoles ? JSON.parse(cmp.targetRoles) : [],
        valueProp: cmp.valueProp || '',
        icpQuery: cmp.icpQuery || '',
        isDefault: Boolean(cmp.isDefault),
        leadsCount,
        isActive: cmp.id === activeId,
        createdAt: cmp.createdAt,
        updatedAt: cmp.updatedAt,
      };
    })
  );

  return c.json({
    success: true,
    activeCampaignId: activeId,
    campaigns: formatted,
  });
});

// POST /api/campaigns - Create a new campaign
campaignsRouter.post('/', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  let body: {
    name?: string;
    targetLocation?: string;
    userIntent?: string;
    userMission?: string;
    targetIndustries?: string[];
    targetTriggers?: string[];
    targetRoles?: string[];
    valueProp?: string;
    makeActive?: boolean;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const targetLocation = (body.targetLocation || '').trim();
  const userIntent = (body.userIntent || 'sales_client_acquisition').trim();
  const userMission = (body.userMission || '').trim();
  const targetIndustries = Array.isArray(body.targetIndustries) ? body.targetIndustries : [];
  const targetTriggers = Array.isArray(body.targetTriggers) ? body.targetTriggers : [];
  const targetRoles = Array.isArray(body.targetRoles) ? body.targetRoles : [];
  const valueProp = (body.valueProp || '').trim();

  // Synthesize calibrated ICP query
  const queryPlan = await planNewsQueryWithAI(
    {
      location: targetLocation,
      userIntent,
      userMission,
      targetIndustries,
      targetTriggers,
      valueProp,
    },
    c.env.OPENAI_API_KEY
  );

  const campaignId = `cmp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const generatedName =
    body.name?.trim() ||
    `${targetLocation.split(',')[0] || 'Target'} - ${targetIndustries[0] || 'Signal Campaign'}`;

  const newCampaign: typeof schema.campaigns.$inferInsert = {
    id: campaignId,
    userId: user.id,
    name: generatedName,
    targetLocation: targetLocation || null,
    userIntent,
    userMission: userMission || null,
    targetIndustries: JSON.stringify(targetIndustries),
    targetTriggers: JSON.stringify(targetTriggers),
    targetRoles: JSON.stringify(targetRoles),
    valueProp: valueProp || queryPlan.missionSummary,
    icpQuery: queryPlan.primaryQuery,
    isDefault: false,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.campaigns).values(newCampaign);

  const makeActive = body.makeActive !== false;
  if (makeActive) {
    await db
      .update(schema.users)
      .set({
        activeCampaignId: campaignId,
        onboardingCompleted: true,
        updatedAt: now,
      })
      .where(eq(schema.users.id, user.id));
  }

  // Attempt non-blocking initial signal scout for this new campaign
  try {
    const newsArticles = await fetchSerpNews(
      queryPlan.primaryQuery,
      c.env.SERP_API_KEY,
      3,
      queryPlan.geographicFocus?.gl,
      queryPlan.fallbackQueries
    );

    for (const art of newsArticles) {
      try {
        if (isLowYieldArticle(art.title, art.publisher, art.url)) continue;
        if (
          !isRelevantToProfile(
            {
              location: targetLocation,
              userIntent,
              userMission,
              targetIndustries,
              targetTriggers,
              valueProp,
            },
            art.title,
            art.snippet,
            art.publisher
          )
        ) {
          continue;
        }
        const crawl = await crawlArticle(art.url, c.env.FIRECRAWL_API_KEY);
        const enriched = await enrichSignalWithLLM(
          art.title,
          crawl.markdown,
          art.publisher || 'Google News',
          c.env.OPENAI_API_KEY,
          queryPlan.recommendedPitchAngle || valueProp,
          userIntent
        );

        if (!enriched.decisionMaker?.name) continue;
        const domain = enriched.companyDomain || `${enriched.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
        const apollo = await findApolloContact(
          enriched.decisionMaker.name,
          enriched.decisionMaker.role,
          domain,
          c.env.APOLLO_API_KEY
        );

        const sigId = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const cntId = `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const drfId = `drf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        await db.insert(schema.signals).values({
          id: sigId,
          userId: user.id,
          campaignId,
          parentSignalId: null,
          title: art.title,
          sourceUrl: art.url,
          publishedAt: art.publishedAt || new Date().toISOString(),
          summaryBullets: JSON.stringify(enriched.summaryBullets),
          articleSummary: enriched.articleSummary || null,
          companyName: enriched.companyName,
          signalType: enriched.signalType,
          industryTags: JSON.stringify(enriched.industryTags || targetIndustries),
          status: 'queued',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await db.insert(schema.contacts).values({
          id: cntId,
          signalId: sigId,
          name: enriched.decisionMaker.name,
          title: enriched.decisionMaker.role,
          email: apollo.email || null,
          linkedinUrl: apollo.linkedinUrl || null,
          avatarUrl: apollo.avatarUrl || null,
          ghlContactId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await db.insert(schema.outreachDrafts).values({
          id: drfId,
          signalId: sigId,
          contactId: cntId,
          subject: enriched.pitchSubject,
          body: enriched.pitchBody,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Individual article error ignored
      }
    }
  } catch {
    // Ingestion network error non-fatal
  }

  return c.json({
    success: true,
    campaign: {
      id: campaignId,
      name: generatedName,
      targetLocation,
      userIntent,
      userMission,
      targetIndustries,
      targetTriggers,
      targetRoles,
      valueProp,
      icpQuery: queryPlan.primaryQuery,
      isDefault: false,
      isActive: makeActive,
      leadsCount: 3,
      createdAt: now,
      updatedAt: now,
    },
  });
});

// POST /api/campaigns/:id/activate - Switch active campaign
campaignsRouter.post('/:id/activate', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const campaignId = c.req.param('id');
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(schema.campaigns.id, campaignId),
      eq(schema.campaigns.userId, user.id),
      eq(schema.campaigns.status, 'active')
    ),
  });

  if (!campaign) {
    return c.json({ success: false, error: 'Campaign not found' }, 404);
  }

  await db
    .update(schema.users)
    .set({
      activeCampaignId: campaignId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.users.id, user.id));

  return c.json({
    success: true,
    activeCampaignId: campaignId,
    message: `Switched active campaign to ${campaign.name}`,
  });
});

// PATCH /api/campaigns/:id - Update an existing campaign
campaignsRouter.patch('/:id', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const campaignId = c.req.param('id');
  const campaign = await db.query.campaigns.findFirst({
    where: and(
      eq(schema.campaigns.id, campaignId),
      eq(schema.campaigns.userId, user.id)
    ),
  });

  if (!campaign) {
    return c.json({ success: false, error: 'Campaign not found' }, 404);
  }

  let body: {
    name?: string;
    targetLocation?: string;
    userIntent?: string;
    userMission?: string;
    targetIndustries?: string[];
    targetTriggers?: string[];
    targetRoles?: string[];
    valueProp?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const name = body.name?.trim() || campaign.name;
  const targetLocation = body.targetLocation !== undefined ? body.targetLocation.trim() : campaign.targetLocation;
  const userIntent = body.userIntent || campaign.userIntent;
  const userMission = body.userMission !== undefined ? body.userMission.trim() : campaign.userMission;
  const targetIndustries = body.targetIndustries !== undefined ? body.targetIndustries : (campaign.targetIndustries ? JSON.parse(campaign.targetIndustries) : []);
  const targetTriggers = body.targetTriggers !== undefined ? body.targetTriggers : (campaign.targetTriggers ? JSON.parse(campaign.targetTriggers) : []);
  const targetRoles = body.targetRoles !== undefined ? body.targetRoles : (campaign.targetRoles ? JSON.parse(campaign.targetRoles) : []);
  const valueProp = body.valueProp !== undefined ? body.valueProp.trim() : campaign.valueProp;

  // Re-calibrate query plan
  const queryPlan = await planNewsQueryWithAI(
    {
      location: targetLocation || '',
      userIntent: userIntent || 'sales_client_acquisition',
      userMission: userMission || '',
      targetIndustries,
      targetTriggers,
      valueProp: valueProp || '',
    },
    c.env.OPENAI_API_KEY
  );

  const now = new Date().toISOString();
  await db
    .update(schema.campaigns)
    .set({
      name,
      targetLocation: targetLocation || null,
      userIntent,
      userMission: userMission || null,
      targetIndustries: JSON.stringify(targetIndustries),
      targetTriggers: JSON.stringify(targetTriggers),
      targetRoles: JSON.stringify(targetRoles),
      valueProp: valueProp || queryPlan.missionSummary,
      icpQuery: queryPlan.primaryQuery,
      updatedAt: now,
    })
    .where(eq(schema.campaigns.id, campaignId));

  return c.json({
    success: true,
    campaign: {
      id: campaignId,
      name,
      targetLocation,
      userIntent,
      userMission,
      targetIndustries,
      targetTriggers,
      targetRoles,
      valueProp,
      icpQuery: queryPlan.primaryQuery,
      updatedAt: now,
    },
  });
});

// DELETE /api/campaigns/:id - Archive campaign
campaignsRouter.delete('/:id', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const campaignId = c.req.param('id');
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.userId, user.id)),
  });

  if (!campaign || campaign.status !== 'active') {
    return c.json({ success: false, error: 'Campaign not found' }, 404);
  }

  const allActive = await db.query.campaigns.findMany({
    where: and(
      eq(schema.campaigns.userId, user.id),
      eq(schema.campaigns.status, 'active')
    ),
  });

  if (allActive.length <= 1) {
    return c.json(
      { success: false, error: 'Cannot delete your only active campaign. Please edit it instead.' },
      400
    );
  }

  await db
    .update(schema.campaigns)
    .set({
      status: 'archived',
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.userId, user.id)));

  // If deleted campaign was active, switch to first remaining
  if (user.activeCampaignId === campaignId) {
    const nextCampaign = allActive.find((c) => c.id !== campaignId);
    if (nextCampaign) {
      await db
        .update(schema.users)
        .set({ activeCampaignId: nextCampaign.id })
        .where(eq(schema.users.id, user.id));
    }
  }

  return c.json({ success: true, message: 'Campaign archived successfully' });
});
