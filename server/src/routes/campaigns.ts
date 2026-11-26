import { Hono } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getSessionUser } from './auth';
import { getUserProfileData } from './user';
import { generateCandidateQueries, planNewsQueryWithAI } from '../services/aiQueryPlanner';
import { deriveBuyerProfile } from '../services/buyerProfile';
import { seedCampaignQueries } from '../services/queryOptimizer';

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

  // Do not auto-seed a leftover "Pacific Northwest & Canada – General Contracting" campaign for fresh accounts.
  return existing;
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
        organization: cmp.organization || '',
        website: cmp.website || '',
        companyDescription: cmp.companyDescription || '',
        servicesOffered: cmp.servicesOffered ? JSON.parse(cmp.servicesOffered) : [],
        productsOffered: cmp.productsOffered ? JSON.parse(cmp.productsOffered) : [],
        targetIndustries: cmp.targetIndustries ? JSON.parse(cmp.targetIndustries) : [],
        targetTriggers: cmp.targetTriggers ? JSON.parse(cmp.targetTriggers) : [],
        targetRoles: cmp.targetRoles ? JSON.parse(cmp.targetRoles) : [],
        valueProp: cmp.valueProp || '',
        icpQuery: cmp.icpQuery || '',
        buyerIndustries: cmp.buyerIndustries ? JSON.parse(cmp.buyerIndustries) : [],
        buyerRoles: cmp.buyerRoles ? JSON.parse(cmp.buyerRoles) : [],
        buyerCompanySize: cmp.buyerCompanySize || 'any',
        serviceArea: cmp.serviceArea || 'local',
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
    organization?: string;
    website?: string;
    targetLocation?: string;
    userIntent?: string;
    userMission?: string;
    companyDescription?: string;
    servicesOffered?: string[];
    productsOffered?: string[];
    icpQuery?: string;
    targetIndustries?: string[];
    targetTriggers?: string[];
    targetRoles?: string[];
    valueProp?: string;
    makeActive?: boolean;
    buyerIndustries?: string[];
    buyerRoles?: string[];
    buyerCompanySize?: 'smb' | 'midmarket' | 'enterprise' | 'any';
    serviceArea?: 'local' | 'national';
    allowNationalSearch?: boolean;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const organization = (body.organization || '').trim();
  const website = (body.website || '').trim();
  const targetLocation = (body.targetLocation || '').trim();
  const userIntent = (body.userIntent || 'sales_client_acquisition').trim();
  const userMission = (body.userMission || '').trim();
  const companyDescription = (body.companyDescription !== undefined ? body.companyDescription : userMission).trim();
  const servicesOffered = Array.isArray(body.servicesOffered)
    ? body.servicesOffered.map((s) => s.trim()).filter(Boolean)
    : [];
  const productsOffered = Array.isArray(body.productsOffered)
    ? body.productsOffered.map((p) => p.trim()).filter(Boolean)
    : [];
  const targetIndustries = Array.isArray(body.targetIndustries) ? body.targetIndustries : [];
  const targetTriggers = Array.isArray(body.targetTriggers) ? body.targetTriggers : [];
  const targetRoles = Array.isArray(body.targetRoles) ? body.targetRoles : [];
  const valueProp = (body.valueProp || '').trim();
  const buyer = deriveBuyerProfile({
    location: targetLocation,
    userIntent,
    userMission,
    companyDescription,
    servicesOffered,
    productsOffered,
    targetIndustries,
    targetTriggers,
    targetRoles,
    valueProp,
    buyerIndustries: body.buyerIndustries,
    buyerRoles: body.buyerRoles,
    buyerCompanySize: body.buyerCompanySize,
    serviceArea: body.serviceArea,
  });

  const plannerInput = {
    location: targetLocation,
    userIntent,
    userMission,
    companyDescription,
    servicesOffered,
    productsOffered,
    targetIndustries,
    targetTriggers,
    targetRoles,
    valueProp,
    ...buyer,
  };

  const [queryPlan, candidateQueries] = await Promise.all([
    planNewsQueryWithAI(plannerInput, c.env.OPENAI_API_KEY),
    generateCandidateQueries(plannerInput, c.env.OPENAI_API_KEY),
  ]);
  const finalIcpQuery = (body.icpQuery || '').trim() || candidateQueries[0]?.queryText || queryPlan.primaryQuery;

  const campaignId = `cmp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const generatedName =
    body.name?.trim() ||
    `${targetLocation.split(',')[0] || 'Target'} - ${targetIndustries[0] || 'Signal Campaign'}`;

  const newCampaign: typeof schema.campaigns.$inferInsert = {
    id: campaignId,
    userId: user.id,
    name: generatedName,
    organization: organization || null,
    website: website || null,
    targetLocation: targetLocation || null,
    userIntent,
    userMission: userMission || null,
    companyDescription: companyDescription || null,
    servicesOffered: JSON.stringify(servicesOffered),
    productsOffered: JSON.stringify(productsOffered),
    targetIndustries: JSON.stringify(targetIndustries),
    targetTriggers: JSON.stringify(targetTriggers),
    targetRoles: JSON.stringify(targetRoles),
    valueProp: valueProp || queryPlan.missionSummary,
    icpQuery: finalIcpQuery,
    buyerIndustries: JSON.stringify(buyer.buyerIndustries),
    buyerRoles: JSON.stringify(buyer.buyerRoles),
    buyerCompanySize: buyer.buyerCompanySize,
    serviceArea: buyer.serviceArea,
    allowNationalSearch: buyer.allowNationalSearch,
    isDefault: false,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.campaigns).values(newCampaign);
  const seededQueries = await seedCampaignQueries(db, campaignId, user.id, candidateQueries);

  const makeActive = body.makeActive !== false;
  if (makeActive) {
    await db
      .update(schema.users)
      .set({
        activeCampaignId: campaignId,
        organization: organization || null,
        website: website || null,
        targetLocation: targetLocation || null,
        userIntent,
        userMission: userMission || null,
        companyDescription: companyDescription || null,
        servicesOffered: JSON.stringify(servicesOffered),
        productsOffered: JSON.stringify(productsOffered),
        targetIndustries: JSON.stringify(targetIndustries),
        targetTriggers: JSON.stringify(targetTriggers),
        targetRoles: JSON.stringify(targetRoles),
        valueProp: valueProp || queryPlan.missionSummary,
        icpQuery: finalIcpQuery,
        buyerIndustries: JSON.stringify(buyer.buyerIndustries),
        buyerRoles: JSON.stringify(buyer.buyerRoles),
        buyerCompanySize: buyer.buyerCompanySize,
        serviceArea: buyer.serviceArea,
        allowNationalSearch: buyer.allowNationalSearch,
        onboardingCompleted: true,
        updatedAt: now,
      })
      .where(eq(schema.users.id, user.id));
  }

  const freshUser = (await db.query.users.findFirst({ where: eq(schema.users.id, user.id) })) || user;

  return c.json({
    success: true,
    user: await getUserProfileData(db, freshUser, c.env),
    queries: seededQueries,
    campaign: {
      id: campaignId,
      name: generatedName,
      organization,
      website,
      targetLocation,
      userIntent,
      userMission,
      companyDescription,
      servicesOffered,
      productsOffered,
      targetIndustries,
      targetTriggers,
      targetRoles,
      valueProp,
      icpQuery: finalIcpQuery,
      isDefault: false,
      isActive: makeActive,
      leadsCount: 0,
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
      organization: campaign.organization,
      website: campaign.website,
      targetLocation: campaign.targetLocation,
      userIntent: campaign.userIntent,
      userMission: campaign.userMission,
      companyDescription: campaign.companyDescription,
      servicesOffered: campaign.servicesOffered,
      productsOffered: campaign.productsOffered,
      targetIndustries: campaign.targetIndustries,
      targetTriggers: campaign.targetTriggers,
      targetRoles: campaign.targetRoles,
      valueProp: campaign.valueProp,
      icpQuery: campaign.icpQuery,
      buyerIndustries: campaign.buyerIndustries,
      buyerRoles: campaign.buyerRoles,
      buyerCompanySize: campaign.buyerCompanySize,
      serviceArea: campaign.serviceArea,
      allowNationalSearch: campaign.allowNationalSearch,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.users.id, user.id));

  const freshUser = (await db.query.users.findFirst({ where: eq(schema.users.id, user.id) })) || user;

  return c.json({
    success: true,
    activeCampaignId: campaignId,
    user: await getUserProfileData(db, freshUser, c.env),
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
    companyDescription?: string;
    servicesOffered?: string[];
    productsOffered?: string[];
    icpQuery?: string;
    targetIndustries?: string[];
    targetTriggers?: string[];
    targetRoles?: string[];
    valueProp?: string;
    buyerIndustries?: string[];
    buyerRoles?: string[];
    buyerCompanySize?: 'smb' | 'midmarket' | 'enterprise' | 'any';
    serviceArea?: 'local' | 'national';
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
  const companyDescription = body.companyDescription !== undefined ? body.companyDescription.trim() : (campaign.companyDescription || userMission);
  const servicesOffered = body.servicesOffered !== undefined
    ? body.servicesOffered.map((s) => s.trim()).filter(Boolean)
    : (campaign.servicesOffered ? JSON.parse(campaign.servicesOffered) : []);
  const productsOffered = body.productsOffered !== undefined
    ? body.productsOffered.map((p) => p.trim()).filter(Boolean)
    : (campaign.productsOffered ? JSON.parse(campaign.productsOffered) : []);
  const targetIndustries = body.targetIndustries !== undefined ? body.targetIndustries : (campaign.targetIndustries ? JSON.parse(campaign.targetIndustries) : []);
  const targetTriggers = body.targetTriggers !== undefined ? body.targetTriggers : (campaign.targetTriggers ? JSON.parse(campaign.targetTriggers) : []);
  const targetRoles = body.targetRoles !== undefined ? body.targetRoles : (campaign.targetRoles ? JSON.parse(campaign.targetRoles) : []);
  const valueProp = body.valueProp !== undefined ? body.valueProp.trim() : campaign.valueProp;
  const buyer = deriveBuyerProfile({
    location: targetLocation || '',
    userIntent: userIntent || 'sales_client_acquisition',
    userMission: userMission || '',
    companyDescription: companyDescription || '',
    servicesOffered,
    productsOffered,
    targetIndustries,
    targetTriggers,
    targetRoles,
    valueProp: valueProp || '',
    buyerIndustries: body.buyerIndustries,
    buyerRoles: body.buyerRoles,
    buyerCompanySize: body.buyerCompanySize,
    serviceArea: body.serviceArea,
  });

  // Re-calibrate query plan
  const queryPlan = await planNewsQueryWithAI(
    {
      location: targetLocation || '',
      userIntent: userIntent || 'sales_client_acquisition',
      userMission: userMission || '',
      companyDescription: companyDescription || '',
      servicesOffered,
      productsOffered,
      targetIndustries,
      targetTriggers,
      targetRoles,
      valueProp: valueProp || '',
      ...buyer,
    },
    c.env.OPENAI_API_KEY
  );
  const finalIcpQuery = body.icpQuery?.trim() || queryPlan.primaryQuery;

  const now = new Date().toISOString();
  await db
    .update(schema.campaigns)
    .set({
      name,
      targetLocation: targetLocation || null,
      userIntent,
      userMission: userMission || null,
      companyDescription: companyDescription || null,
      servicesOffered: JSON.stringify(servicesOffered),
      productsOffered: JSON.stringify(productsOffered),
      targetIndustries: JSON.stringify(targetIndustries),
      targetTriggers: JSON.stringify(targetTriggers),
      targetRoles: JSON.stringify(targetRoles),
      valueProp: valueProp || queryPlan.missionSummary,
      icpQuery: finalIcpQuery,
      buyerIndustries: JSON.stringify(buyer.buyerIndustries),
      buyerRoles: JSON.stringify(buyer.buyerRoles),
      buyerCompanySize: buyer.buyerCompanySize,
      serviceArea: buyer.serviceArea,
      allowNationalSearch: buyer.allowNationalSearch,
      updatedAt: now,
    })
    .where(eq(schema.campaigns.id, campaignId));

  if (user.activeCampaignId === campaignId) {
    await db
      .update(schema.users)
      .set({
        targetLocation: targetLocation || null,
        userIntent,
        userMission: userMission || null,
        companyDescription: companyDescription || null,
        servicesOffered: JSON.stringify(servicesOffered),
        productsOffered: JSON.stringify(productsOffered),
        targetIndustries: JSON.stringify(targetIndustries),
        targetTriggers: JSON.stringify(targetTriggers),
        targetRoles: JSON.stringify(targetRoles),
        valueProp: valueProp || queryPlan.missionSummary,
        icpQuery: finalIcpQuery,
        buyerIndustries: JSON.stringify(buyer.buyerIndustries),
        buyerRoles: JSON.stringify(buyer.buyerRoles),
        buyerCompanySize: buyer.buyerCompanySize,
        serviceArea: buyer.serviceArea,
        allowNationalSearch: buyer.allowNationalSearch,
        updatedAt: now,
      })
      .where(eq(schema.users.id, user.id));
  }

  const freshUser = (await db.query.users.findFirst({ where: eq(schema.users.id, user.id) })) || user;

  return c.json({
    success: true,
    user: await getUserProfileData(db, freshUser, c.env),
    campaign: {
      id: campaignId,
      name,
      targetLocation,
      userIntent,
      userMission,
      companyDescription,
      servicesOffered,
      productsOffered,
      targetIndustries,
      targetTriggers,
      targetRoles,
      valueProp,
      icpQuery: finalIcpQuery,
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

// GET /api/campaigns/:id/queries - List adaptive queries & hit rates for a campaign
campaignsRouter.get('/:id/queries', async (c) => {
  if (!c.env?.DB) return c.json({ success: false, error: 'Database unavailable' }, 500);
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const campaignId = c.req.param('id');
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.userId, user.id)),
  });
  if (!campaign) return c.json({ success: false, error: 'Campaign not found' }, 404);

  const queries = await db.query.campaignQueries.findMany({
    where: and(eq(schema.campaignQueries.campaignId, campaignId), eq(schema.campaignQueries.userId, user.id)),
    orderBy: [desc(schema.campaignQueries.pinned), desc(schema.campaignQueries.relevantCount)],
  });

  return c.json({ success: true, queries });
});

// POST /api/campaigns/:id/queries - Add a manual query or regenerate candidate queries
campaignsRouter.post('/:id/queries', async (c) => {
  if (!c.env?.DB) return c.json({ success: false, error: 'Database unavailable' }, 500);
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const campaignId = c.req.param('id');
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.userId, user.id)),
  });
  if (!campaign) return c.json({ success: false, error: 'Campaign not found' }, 404);

  const body = await c.req
    .json<{ queryText?: string; pinned?: boolean; regenerate?: boolean }>()
    .catch((): { queryText?: string; pinned?: boolean; regenerate?: boolean } => ({}));

  if (body.regenerate) {
    const parseArr = (v?: string | null) => {
      try { return v ? JSON.parse(v) : []; } catch { return []; }
    };
    const specs = await generateCandidateQueries(
      {
        location: campaign.targetLocation || '',
        userIntent: campaign.userIntent || 'sales_client_acquisition',
        userMission: campaign.userMission || '',
        companyDescription: campaign.companyDescription || '',
        servicesOffered: parseArr(campaign.servicesOffered),
        productsOffered: parseArr(campaign.productsOffered),
        targetIndustries: parseArr(campaign.targetIndustries),
        targetTriggers: parseArr(campaign.targetTriggers),
        valueProp: campaign.valueProp || '',
        serviceArea: campaign.serviceArea === 'national' ? 'national' : 'local',
      },
      c.env.OPENAI_API_KEY
    );
    const seeded = await seedCampaignQueries(db, campaignId, user.id, specs);
    return c.json({ success: true, queries: seeded });
  }

  const text = (body.queryText || '').trim();
  if (!text) return c.json({ success: false, error: 'queryText is required' }, 400);

  const now = new Date().toISOString();
  const row = {
    id: `cq_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
    campaignId,
    userId: user.id,
    queryText: text,
    tier: 'manual' as const,
    pinned: Boolean(body.pinned),
    status: 'active' as const,
    runs: 0,
    articlesReturned: 0,
    relevantCount: 0,
    savedCount: 0,
    rejectedCount: 0,
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.campaignQueries).values(row);
  return c.json({ success: true, query: row });
});

// PATCH /api/campaigns/:id/queries/:queryId - Pin/unpin or restore a query
campaignsRouter.patch('/:id/queries/:queryId', async (c) => {
  if (!c.env?.DB) return c.json({ success: false, error: 'Database unavailable' }, 500);
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const campaignId = c.req.param('id');
  const queryId = c.req.param('queryId');
  const existing = await db.query.campaignQueries.findFirst({
    where: and(
      eq(schema.campaignQueries.id, queryId),
      eq(schema.campaignQueries.campaignId, campaignId),
      eq(schema.campaignQueries.userId, user.id)
    ),
  });
  if (!existing) return c.json({ success: false, error: 'Query not found' }, 404);

  const body = await c.req
    .json<{ pinned?: boolean; status?: 'active' | 'retired' }>()
    .catch((): { pinned?: boolean; status?: 'active' | 'retired' } => ({}));
  await db
    .update(schema.campaignQueries)
    .set({
      pinned: body.pinned !== undefined ? body.pinned : existing.pinned,
      status: body.status || existing.status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.campaignQueries.id, queryId));

  const updated = await db.query.campaignQueries.findFirst({ where: eq(schema.campaignQueries.id, queryId) });
  return c.json({ success: true, query: updated });
});

// DELETE /api/campaigns/:id/queries/:queryId - Delete a campaign query
campaignsRouter.delete('/:id/queries/:queryId', async (c) => {
  if (!c.env?.DB) return c.json({ success: false, error: 'Database unavailable' }, 500);
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  const campaignId = c.req.param('id');
  const queryId = c.req.param('queryId');
  await db
    .delete(schema.campaignQueries)
    .where(
      and(
        eq(schema.campaignQueries.id, queryId),
        eq(schema.campaignQueries.campaignId, campaignId),
        eq(schema.campaignQueries.userId, user.id)
      )
    );

  return c.json({ success: true });
});
