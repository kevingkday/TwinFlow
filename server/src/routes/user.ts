import { Hono } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { eq } from 'drizzle-orm';
import { verifyGhlCredentials, syncGhlBusinessProfileAndValues } from '../services/ghl';
import { getSessionUser } from './auth';
import { planNewsQueryWithAI } from '../services/aiQueryPlanner';

export const userRouter = new Hono<{ Bindings: Bindings }>();

export function formatUserProfile(user: typeof schema.users.$inferSelect, env?: Bindings) {
  const hasCustomGhlKey = Boolean(
    user.ghlApiKey && user.ghlApiKey.length > 10 && !user.ghlApiKey.includes('your_')
  );
  const isGhlConnected = hasCustomGhlKey;
  const isAdmin = user.role === 'admin' || user.email.toLowerCase() === 'kevingkday@gmail.com';

  const parseJsonArray = (val: string | null | undefined): string[] => {
    if (!val) return [];
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
  };

  return {
    id: user.id,
    email: user.email,
    name: user.name || 'Operator',
    role: isAdmin ? 'admin' : (user.role || 'user'),
    isAdmin,
    organization: user.organization || null,
    avatarUrl: user.avatarUrl || null,
    ghlSubaccountId: user.ghlSubaccountId || env?.GHL_LOCATION_ID || 'y3KLRBUZzf2t45o7rzp9',
    isGhlConnected,
    hasCustomGhlKey,
    ghlApiKeyMasked: user.ghlApiKey
      ? `pit-••••••••${user.ghlApiKey.slice(-4)}`
      : null,
    creditBalance: user.creditBalance,
    streakCount: user.streakCount,
    totalPoints: user.totalPoints,
    onboardingCompleted: Boolean(user.onboardingCompleted),
    icpQuery: user.icpQuery || null,
    targetLocation: user.targetLocation || null,
    userIntent: user.userIntent || null,
    userMission: user.userMission || null,
    companyDescription: user.companyDescription || null,
    servicesOffered: parseJsonArray(user.servicesOffered),
    productsOffered: parseJsonArray(user.productsOffered),
    website: user.website || null,
    legalBusinessName: user.legalBusinessName || null,
    phone: user.phone || null,
    streetAddress: user.streetAddress || null,
    city: user.city || null,
    state: user.state || null,
    postalCode: user.postalCode || null,
    country: user.country || 'CA',
    timezone: user.timezone || 'America/Vancouver',
    targetIndustries: parseJsonArray(user.targetIndustries),
    targetTriggers: parseJsonArray(user.targetTriggers),
    targetRoles: parseJsonArray(user.targetRoles),
    valueProp: user.valueProp || null,
    createdAt: user.createdAt,
  };
}

// GET /api/user/profile - Return current operator profile & GHL connection status
userRouter.get('/profile', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database binding unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, authenticated: false, error: 'Unauthorized' }, 401);
  }

  return c.json({
    success: true,
    user: formatUserProfile(user, c.env),
  });
});

interface UpdateProfilePayload {
  name?: string;
  organization?: string;
  companyDescription?: string;
  servicesOffered?: string[];
  productsOffered?: string[];
  website?: string;
  legalBusinessName?: string;
  phone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  timezone?: string;
  targetLocation?: string;
  userIntent?: string;
  userMission?: string;
  valueProp?: string;
  targetIndustries?: string[];
  targetTriggers?: string[];
  targetRoles?: string[];
  syncToCrm?: boolean;
}

// PATCH /api/user/profile - Update user profile & recalibrate search radar with AI
userRouter.patch('/profile', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database binding unavailable' }, 500);
  }

  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized. Please sign in to update profile.' }, 401);
  }

  const body = await c.req.json<UpdateProfilePayload>().catch((): UpdateProfilePayload => ({}));
  const now = new Date().toISOString();

  const updates: Partial<typeof schema.users.$inferInsert> = {
    updatedAt: now,
  };

  if (body.name !== undefined) updates.name = body.name.trim() || 'Operator';
  if (body.organization !== undefined) updates.organization = body.organization.trim() || null;
  if (body.companyDescription !== undefined) updates.companyDescription = body.companyDescription.trim() || null;
  if (body.website !== undefined) updates.website = body.website.trim() || null;
  if (body.legalBusinessName !== undefined) updates.legalBusinessName = body.legalBusinessName.trim() || null;
  if (body.phone !== undefined) updates.phone = body.phone.trim() || null;
  if (body.streetAddress !== undefined) updates.streetAddress = body.streetAddress.trim() || null;
  if (body.city !== undefined) updates.city = body.city.trim() || null;
  if (body.state !== undefined) updates.state = body.state.trim() || null;
  if (body.postalCode !== undefined) updates.postalCode = body.postalCode.trim() || null;
  if (body.country !== undefined) updates.country = body.country.trim() || 'CA';
  if (body.timezone !== undefined) updates.timezone = body.timezone.trim() || 'America/Vancouver';
  if (body.targetLocation !== undefined) updates.targetLocation = body.targetLocation.trim() || null;
  if (body.userIntent !== undefined) updates.userIntent = body.userIntent.trim() || null;
  if (body.userMission !== undefined) updates.userMission = body.userMission.trim() || null;
  if (body.valueProp !== undefined) updates.valueProp = body.valueProp.trim() || null;

  if (body.servicesOffered !== undefined) {
    updates.servicesOffered = JSON.stringify(body.servicesOffered.map((s) => s.trim()).filter(Boolean));
  }
  if (body.productsOffered !== undefined) {
    updates.productsOffered = JSON.stringify(body.productsOffered.map((p) => p.trim()).filter(Boolean));
  }
  if (body.targetIndustries !== undefined) {
    updates.targetIndustries = JSON.stringify(body.targetIndustries);
  }
  if (body.targetTriggers !== undefined) {
    updates.targetTriggers = JSON.stringify(body.targetTriggers);
  }
  if (body.targetRoles !== undefined) {
    updates.targetRoles = JSON.stringify(body.targetRoles);
  }

  // Recalibrate AI News Query using the updated profile offerings & location
  const finalLocation = body.targetLocation !== undefined ? body.targetLocation : (user.targetLocation || 'Nationwide US');
  const finalIntent = body.userIntent !== undefined ? body.userIntent : (user.userIntent || 'sales_client_acquisition');
  const finalMission = body.userMission !== undefined ? body.userMission : (user.userMission || '');
  const finalIndustries = body.targetIndustries !== undefined
    ? body.targetIndustries
    : (user.targetIndustries ? JSON.parse(user.targetIndustries) : []);
  const finalTriggers = body.targetTriggers !== undefined
    ? body.targetTriggers
    : (user.targetTriggers ? JSON.parse(user.targetTriggers) : []);
  const finalServices = body.servicesOffered !== undefined
    ? body.servicesOffered
    : (user.servicesOffered ? JSON.parse(user.servicesOffered) : []);
  const finalProducts = body.productsOffered !== undefined
    ? body.productsOffered
    : (user.productsOffered ? JSON.parse(user.productsOffered) : []);
  const finalDesc = body.companyDescription !== undefined ? body.companyDescription : (user.companyDescription || '');

  const queryPlan = await planNewsQueryWithAI(
    {
      location: finalLocation,
      userIntent: finalIntent,
      userMission: finalMission,
      targetIndustries: finalIndustries,
      targetTriggers: finalTriggers,
      valueProp: body.valueProp !== undefined ? body.valueProp : (user.valueProp || ''),
      companyDescription: finalDesc,
      servicesOffered: finalServices,
      productsOffered: finalProducts,
      website: body.website !== undefined ? body.website : (user.website || ''),
    },
    c.env.OPENAI_API_KEY
  );

  updates.icpQuery = queryPlan.primaryQuery;

  await db.update(schema.users).set(updates).where(eq(schema.users.id, user.id));

  // If user has an active campaign, synchronize search parameters with it
  if (user.activeCampaignId) {
    await db
      .update(schema.campaigns)
      .set({
        targetLocation: finalLocation,
        userIntent: finalIntent,
        userMission: finalMission,
        companyDescription: finalDesc,
        servicesOffered: updates.servicesOffered,
        productsOffered: updates.productsOffered,
        website: updates.website,
        legalBusinessName: updates.legalBusinessName,
        phone: updates.phone,
        streetAddress: updates.streetAddress,
        city: updates.city,
        state: updates.state,
        postalCode: updates.postalCode,
        country: updates.country,
        timezone: updates.timezone,
        targetIndustries: updates.targetIndustries,
        targetTriggers: updates.targetTriggers,
        targetRoles: updates.targetRoles,
        icpQuery: queryPlan.primaryQuery,
        updatedAt: now,
      })
      .where(eq(schema.campaigns.id, user.activeCampaignId));
  }

  // Two-way synchronization with CRM (Business Profile & Custom Values)
  let crmSyncResult = null;
  const subaccountId = user.ghlSubaccountId || c.env.GHL_LOCATION_ID;
  const apiKey = user.ghlApiKey || c.env.GHL_API_KEY;

  if (body.syncToCrm && subaccountId) {
    try {
      crmSyncResult = await syncGhlBusinessProfileAndValues(
        subaccountId,
        {
          name: updates.name || user.name || undefined,
          organization: (updates.organization ?? user.organization) || undefined,
          legalBusinessName: (updates.legalBusinessName ?? user.legalBusinessName) || undefined,
          website: (updates.website ?? user.website) || undefined,
          email: user.email,
          phone: (updates.phone ?? user.phone) || undefined,
          streetAddress: (updates.streetAddress ?? user.streetAddress) || undefined,
          city: (updates.city ?? user.city) || undefined,
          state: (updates.state ?? user.state) || undefined,
          postalCode: (updates.postalCode ?? user.postalCode) || undefined,
          country: updates.country || user.country || 'CA',
          timezone: updates.timezone || user.timezone || 'America/Vancouver',
          companyDescription: finalDesc || undefined,
          servicesOffered: finalServices,
          productsOffered: finalProducts,
          valueProp: (body.valueProp ?? user.valueProp) || undefined,
          targetLocation: finalLocation || undefined,
          targetRoles: body.targetRoles || (user.targetRoles ? JSON.parse(user.targetRoles) : []),
          userMission: finalMission || undefined,
        },
        apiKey,
        c.env.GHL_COMPANY_ID,
        c.env.GHL_AGENCY_API_KEY
      );
    } catch (err) {
      console.warn('[User Profile] Error during auto CRM sync:', err);
    }
  }

  const updatedUser =
    (await db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
    })) || user;

  return c.json({
    success: true,
    user: formatUserProfile(updatedUser, c.env),
    queryPlan,
    crmSyncResult,
    message: crmSyncResult
      ? `Profile saved, AI radar calibrated, and ${crmSyncResult.message}`
      : 'Profile saved and AI search radar calibrated!',
  });
});

// Also support PUT /api/user/profile for convenience
userRouter.put('/profile', async (c) => {
  return userRouter.fetch(new Request(c.req.url, { method: 'PATCH', headers: c.req.raw.headers, body: c.req.raw.body }));
});

// POST /api/user/sync-crm - Explicitly sync profile, custom values, and tags to CRM
userRouter.post('/sync-crm', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database binding unavailable' }, 500);
  }

  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const subaccountId = user.ghlSubaccountId || c.env.GHL_LOCATION_ID;
  const apiKey = user.ghlApiKey || c.env.GHL_API_KEY;

  if (!subaccountId) {
    return c.json({ success: false, error: 'Please connect a CRM subaccount in settings first.' }, 400);
  }

  const services = user.servicesOffered ? JSON.parse(user.servicesOffered) : [];
  const products = user.productsOffered ? JSON.parse(user.productsOffered) : [];
  const roles = user.targetRoles ? JSON.parse(user.targetRoles) : [];

  const result = await syncGhlBusinessProfileAndValues(
    subaccountId,
    {
      name: user.name,
      organization: user.organization || undefined,
      legalBusinessName: user.legalBusinessName || undefined,
      website: user.website || undefined,
      email: user.email,
      phone: user.phone || undefined,
      streetAddress: user.streetAddress || undefined,
      city: user.city || undefined,
      state: user.state || undefined,
      postalCode: user.postalCode || undefined,
      country: user.country || 'CA',
      timezone: user.timezone || 'America/Vancouver',
      companyDescription: user.companyDescription || undefined,
      servicesOffered: services,
      productsOffered: products,
      valueProp: user.valueProp || undefined,
      targetLocation: user.targetLocation || undefined,
      targetRoles: roles,
      userMission: user.userMission || undefined,
    },
    apiKey,
    c.env.GHL_COMPANY_ID,
    c.env.GHL_AGENCY_API_KEY
  );

  return c.json({
    success: true,
    result,
    user: formatUserProfile(user, c.env),
  });
});

// POST /api/user/ghl-config - Save subaccount ID and Private Integration Token to user profile
userRouter.post('/ghl-config', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database binding unavailable' }, 500);
  }

  interface GhlConfigPayload {
    ghlSubaccountId?: string;
    ghlApiKey?: string;
  }

  const body = await c.req
    .json<GhlConfigPayload>()
    .catch((): GhlConfigPayload => ({}));

  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized. Please sign in to save your CRM settings.' }, 401);
  }
  const now = new Date().toISOString();

  const targetSubaccount = (
    body.ghlSubaccountId !== undefined ? body.ghlSubaccountId : user.ghlSubaccountId || c.env.GHL_LOCATION_ID || ''
  ).trim();

  const targetKey = (
    body.ghlApiKey !== undefined ? body.ghlApiKey : user.ghlApiKey || c.env.GHL_API_KEY || ''
  ).trim();

  let verificationResult = { valid: true, mock: true, message: 'Settings saved.' };

  // If a live key and subaccount are supplied, perform a test ping
  if (targetKey && targetSubaccount) {
    verificationResult = await verifyGhlCredentials(targetSubaccount, targetKey);
  }

  const updates: Partial<typeof schema.users.$inferInsert> = {
    updatedAt: now,
  };

  if (body.ghlSubaccountId !== undefined) {
    updates.ghlSubaccountId = body.ghlSubaccountId.trim() || null;
  }
  if (body.ghlApiKey !== undefined) {
    updates.ghlApiKey = body.ghlApiKey.trim() || null;
  }

  await db.update(schema.users).set(updates).where(eq(schema.users.id, user.id));

  const updatedUser =
    (await db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
    })) || user;

  return c.json({
    success: true,
    verification: verificationResult,
    user: formatUserProfile(updatedUser, c.env),
    message: verificationResult.valid
      ? 'CRM Sub-Account settings saved and verified successfully!'
      : `Saved, but verification warning: ${verificationResult.message}`,
  });
});
