import { Hono } from 'hono';
import { eq, desc, sql } from 'drizzle-orm';
import type { Bindings } from '../db';
import { getDb } from '../db';
import * as schema from '../db/schema';
import { getSessionUser } from './auth';

export const adminRouter = new Hono<{ Bindings: Bindings }>();

// Security middleware: Ensure caller has valid session and role === 'admin'
adminRouter.use('*', async (c, next) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }

  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const isAdmin = user.role === 'admin' || user.email.toLowerCase() === 'kevingkday@gmail.com';
  if (!isAdmin) {
    return c.json({ success: false, error: 'Access denied: Admin privileges required.' }, 403);
  }

  return next();
});

/**
 * GET /api/admin/stats
 * High-level system vitals across users, pipeline signals, and CRM workspaces
 */
adminRouter.get('/stats', async (c) => {
  const db = getDb(c.env.DB);

  const [usersCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.users);

  const [creditsSum] = await db
    .select({ total: sql<number>`sum(credit_balance)` })
    .from(schema.users);

  const [signalsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.signals);

  const [approvedCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.signals)
    .where(eq(schema.signals.status, 'approved'));

  const [contactsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.contacts);

  return c.json({
    success: true,
    stats: {
      totalUsers: usersCount?.count || 0,
      totalCreditsActive: creditsSum?.total || 0,
      totalSignalsIngested: signalsCount?.count || 0,
      totalLeadsApproved: approvedCount?.count || 0,
      totalContactsExtracted: contactsCount?.count || 0,
    },
  });
});

/**
 * GET /api/admin/users
 * Returns list of all registered users with their targeting profile, CRM setup, and balance
 */
adminRouter.get('/users', async (c) => {
  const db = getDb(c.env.DB);

  const allUsers = await db.query.users.findMany({
    orderBy: [desc(schema.users.createdAt)],
  });

  const formatted = allUsers.map((u) => {
    let targetIndustries: string[] = [];
    let targetTriggers: string[] = [];
    let targetRoles: string[] = [];
    try {
      if (u.targetIndustries) targetIndustries = JSON.parse(u.targetIndustries);
      if (u.targetTriggers) targetTriggers = JSON.parse(u.targetTriggers);
      if (u.targetRoles) targetRoles = JSON.parse(u.targetRoles);
    } catch {
      // ignore
    }

    const hasCustomGhlKey = Boolean(u.ghlApiKey && u.ghlApiKey.length > 10);
    const isAdmin = u.role === 'admin' || u.email.toLowerCase() === 'kevingkday@gmail.com';

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      organization: u.organization,
      role: isAdmin ? 'admin' : (u.role || 'user'),
      isAdmin,
      avatarUrl: u.avatarUrl,
      creditBalance: u.creditBalance,
      streakCount: u.streakCount,
      totalPoints: u.totalPoints,
      ghlSubaccountId: u.ghlSubaccountId,
      hasCustomGhlKey,
      ghlApiKeyMasked: u.ghlApiKey ? `pit-••••••••${u.ghlApiKey.slice(-4)}` : null,
      targetLocation: u.targetLocation,
      userIntent: u.userIntent,
      userMission: u.userMission,
      targetIndustries,
      targetTriggers,
      targetRoles,
      onboardingCompleted: Boolean(u.onboardingCompleted),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  });

  return c.json({
    success: true,
    count: formatted.length,
    users: formatted,
  });
});

/**
 * POST /api/admin/users/:id/credits
 * Adjust or replenish credits for a specific user
 */
adminRouter.post('/users/:id/credits', async (c) => {
  const db = getDb(c.env.DB);
  const targetUserId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const amount = Number(body.amount);
  if (isNaN(amount) || amount === 0) {
    return c.json({ success: false, error: 'Valid numeric amount required' }, 400);
  }

  const mode = body.mode === 'set' ? 'set' : 'add';
  const targetUser = await db.query.users.findFirst({
    where: eq(schema.users.id, targetUserId),
  });

  if (!targetUser) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const newBalance = mode === 'set' ? Math.max(0, amount) : Math.max(0, targetUser.creditBalance + amount);
  const delta = newBalance - targetUser.creditBalance;
  const now = new Date().toISOString();

  await db
    .update(schema.users)
    .set({ creditBalance: newBalance, updatedAt: now })
    .where(eq(schema.users.id, targetUserId));

  // Log to audit ledger
  await db.insert(schema.creditTransactions).values({
    id: `ctx_adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: targetUserId,
    amount: delta,
    balanceAfter: newBalance,
    type: delta >= 0 ? 'replenish' : 'admin_adjustment',
    referenceId: 'admin_action',
    description: body.reason || `Admin credit adjustment (${delta > 0 ? '+' : ''}${delta})`,
    createdAt: now,
  });

  return c.json({
    success: true,
    user: {
      id: targetUserId,
      creditBalance: newBalance,
    },
    message: `Updated credit balance to ${newBalance} (${delta > 0 ? '+' : ''}${delta})`,
  });
});

/**
 * PATCH /api/admin/users/:id/role
 * Promote or demote user role
 */
adminRouter.patch('/users/:id/role', async (c) => {
  const db = getDb(c.env.DB);
  const targetUserId = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { role?: string };

  if (body.role !== 'admin' && body.role !== 'user') {
    return c.json({ success: false, error: "Role must be 'admin' or 'user'" }, 400);
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(schema.users.id, targetUserId),
  });

  if (!targetUser) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // Prevent demoting primary superadmin
  if (targetUser.email.toLowerCase() === 'kevingkday@gmail.com' && body.role !== 'admin') {
    return c.json({ success: false, error: 'Cannot demote the primary system administrator.' }, 400);
  }

  const now = new Date().toISOString();
  await db
    .update(schema.users)
    .set({ role: body.role, updatedAt: now })
    .where(eq(schema.users.id, targetUserId));

  return c.json({
    success: true,
    user: {
      id: targetUserId,
      role: body.role,
    },
    message: `Role updated to ${body.role}`,
  });
});

/**
 * POST /api/admin/users/:id/reset-onboarding
 * Resets user onboarding to allow re-running the ICP intake questionnaire
 */
adminRouter.post('/users/:id/reset-onboarding', async (c) => {
  const db = getDb(c.env.DB);
  const targetUserId = c.req.param('id');

  const targetUser = await db.query.users.findFirst({
    where: eq(schema.users.id, targetUserId),
  });

  if (!targetUser) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  await db
    .update(schema.users)
    .set({ onboardingCompleted: false, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, targetUserId));

  return c.json({
    success: true,
    message: `Onboarding status reset for ${targetUser.email}`,
  });
});

/**
 * DELETE /api/admin/users/:id
 * Deletes user and cascades related records
 */
adminRouter.delete('/users/:id', async (c) => {
  const db = getDb(c.env.DB);
  const currentAdmin = await getSessionUser(c);
  const targetUserId = c.req.param('id');

  const targetUser = await db.query.users.findFirst({
    where: eq(schema.users.id, targetUserId),
  });

  if (!targetUser) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  if (targetUser.email.toLowerCase() === 'kevingkday@gmail.com') {
    return c.json({ success: false, error: 'Cannot delete primary system administrator.' }, 400);
  }

  if (currentAdmin && currentAdmin.id === targetUserId) {
    return c.json({ success: false, error: 'Cannot delete your own active administrator account.' }, 400);
  }

  await db.delete(schema.users).where(eq(schema.users.id, targetUserId));

  return c.json({
    success: true,
    message: `User ${targetUser.email} has been permanently deleted.`,
  });
});
