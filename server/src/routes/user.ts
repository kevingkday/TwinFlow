import { Hono } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { eq } from 'drizzle-orm';
import { verifyGhlCredentials } from '../services/ghl';
import { getSessionUser } from './auth';

export const userRouter = new Hono<{ Bindings: Bindings }>();

/**
 * Helper to retrieve or initialize the default operator user
 */
export async function getOrCreateUser(db: ReturnType<typeof getDb>): Promise<typeof schema.users.$inferSelect> {
  const existing = await db.query.users.findFirst();
  if (existing) return existing;

  const newUser: typeof schema.users.$inferInsert = {
    id: 'usr_default',
    email: 'operator@twinflow.ai',
    name: 'Operator',
    organization: 'TwinFlow Demo',
    passwordHash: null,
    googleId: null,
    avatarUrl: null,
    ghlSubaccountId: 'y3KLRBUZzf2t45o7rzp9',
    ghlApiKey: null,
    creditBalance: 500,
    streakCount: 0,
    totalPoints: 0,
    icpQuery: null,
    targetIndustries: null,
    targetTriggers: null,
    targetRoles: null,
    valueProp: null,
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.insert(schema.users).values(newUser);
  return newUser as typeof schema.users.$inferSelect;
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

  const hasCustomGhlKey = Boolean(
    user.ghlApiKey && user.ghlApiKey.length > 10 && !user.ghlApiKey.includes('your_')
  );
  const isGhlConnected = hasCustomGhlKey;

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || 'Operator',
      organization: user.organization || null,
      avatarUrl: user.avatarUrl || null,
      ghlSubaccountId: user.ghlSubaccountId || c.env.GHL_LOCATION_ID || 'y3KLRBUZzf2t45o7rzp9',
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
      targetIndustries: user.targetIndustries ? JSON.parse(user.targetIndustries) : [],
      targetTriggers: user.targetTriggers ? JSON.parse(user.targetTriggers) : [],
      targetRoles: user.targetRoles ? JSON.parse(user.targetRoles) : [],
      valueProp: user.valueProp || null,
      createdAt: user.createdAt,
    },
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
  const user = (await getSessionUser(c)) || (await getOrCreateUser(db));
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
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      ghlSubaccountId: updatedUser.ghlSubaccountId || c.env.GHL_LOCATION_ID || null,
      isGhlConnected: Boolean(
        updatedUser.ghlApiKey && updatedUser.ghlApiKey.length > 10 && !updatedUser.ghlApiKey.includes('your_')
      ),
      hasCustomGhlKey: Boolean(
        updatedUser.ghlApiKey && updatedUser.ghlApiKey.length > 10 && !updatedUser.ghlApiKey.includes('your_')
      ),
      ghlApiKeyMasked: updatedUser.ghlApiKey
        ? `pit-••••••••${updatedUser.ghlApiKey.slice(-4)}`
        : null,
      creditBalance: updatedUser.creditBalance,
      streakCount: updatedUser.streakCount,
      totalPoints: updatedUser.totalPoints,
    },
    message: verificationResult.valid
      ? 'CRM Sub-Account settings saved and verified successfully!'
      : `Saved, but verification warning: ${verificationResult.message}`,
  });
});
