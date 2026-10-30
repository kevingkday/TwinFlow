import { Hono, type Context } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { eq } from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  parseGoogleJwt,
  verifyGoogleIdToken,
  exchangeGoogleAuthCode,
} from '../services/auth';
import { createSubaccount } from '../services/ghl';

export const authRouter = new Hono<{ Bindings: Bindings }>();

/**
 * Helper to retrieve currently authenticated user from Bearer header or cookie
 */
export async function getSessionUser(c: Context<{ Bindings: Bindings }>) {
  if (!c.env?.DB) return null;
  const db = getDb(c.env.DB);

  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    token = c.req.header('x-session-token') || undefined;
  }

  if (!token) {
    const cookie = c.req.header('Cookie');
    if (cookie) {
      const match = cookie.match(/session_token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (token) {
    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, token),
    });

    if (session) {
      const now = new Date().toISOString();
      if (session.expiresAt > now) {
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, session.userId),
        });
        if (user) return user;
      }
    }
  }

  return null;
}

function sanitizeUser(user: typeof schema.users.$inferSelect) {
  const { passwordHash, ...safe } = user;
  const isAdmin = safe.role === 'admin' || safe.email.toLowerCase() === 'kevingkday@gmail.com';
  return {
    ...safe,
    role: isAdmin ? 'admin' : (safe.role || 'user'),
    isAdmin,
    isGhlConnected: Boolean(safe.ghlApiKey && safe.ghlApiKey.length > 10),
    hasCustomGhlKey: Boolean(safe.ghlApiKey && safe.ghlApiKey.length > 10),
  };
}

// POST /api/auth/signup - Create new account & provision GHL sub-account
authRouter.post('/signup', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);

  let body: {
    name?: string;
    email?: string;
    password?: string;
    organization?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const organization = (body.organization || '').trim() || null;

  if (!name) {
    return c.json({ success: false, error: 'Name is required' }, 400);
  }
  if (!email || !email.includes('@')) {
    return c.json({ success: false, error: 'Valid email is required' }, 400);
  }
  if (!password || password.length < 6) {
    return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400);
  }

  // Check email uniqueness
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (existing) {
    return c.json({ success: false, error: 'An account with this email already exists. Please sign in.' }, 409);
  }

  const hashedPassword = await hashPassword(password);
  const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // 1. Auto-create dedicated GoHighLevel sub-account for this user
  const subaccount = await createSubaccount(
    {
      name: organization || `${name}'s Workspace`,
      email,
      companyName: organization || `${name}'s Workspace`,
      country: c.env.GHL_DEFAULT_COUNTRY || 'CA',
      timezone: c.env.GHL_DEFAULT_TIMEZONE || 'America/Vancouver',
    },
    c.env.GHL_AGENCY_API_KEY,
    c.env.GHL_COMPANY_ID
  );

  // 2. Insert user into D1
  const newUser: typeof schema.users.$inferInsert = {
    id: userId,
    email,
    name,
    organization,
    passwordHash: hashedPassword,
    role: email === 'kevingkday@gmail.com' ? 'admin' : 'user',
    avatarUrl: null,
    ghlSubaccountId: subaccount.id,
    creditBalance: 500,
    streakCount: 0,
    totalPoints: 0,
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.users).values(newUser);

  // 3. Grant starter 500 credits transaction
  await db.insert(schema.creditTransactions).values({
    id: `ctx_init_${Date.now()}`,
    userId,
    amount: 500,
    balanceAfter: 500,
    type: 'bonus',
    description: 'Welcome bonus (Starter Credits)',
    createdAt: now,
  });

  // 4. Create active session token (valid 30 days)
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(schema.sessions).values({
    id: token,
    userId,
    expiresAt,
    createdAt: now,
  });

  return c.json({
    success: true,
    user: sanitizeUser(newUser as typeof schema.users.$inferSelect),
    token,
    subaccount: {
      id: subaccount.id,
      name: subaccount.name,
      mock: subaccount.mock,
    },
    message: 'Account created successfully! Welcome to TwinFlow.',
  });
});

// POST /api/auth/login - Email + Password Authentication
authRouter.post('/login', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);

  let body: { email?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    return c.json({ success: false, error: 'Email and password are required' }, 400);
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (!user || !user.passwordHash) {
    return c.json({ success: false, error: 'Invalid email or password' }, 401);
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return c.json({ success: false, error: 'Invalid email or password' }, 401);
  }

  // Create active session
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(schema.sessions).values({
    id: token,
    userId: user.id,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  return c.json({
    success: true,
    user: sanitizeUser(user),
    token,
  });
});

// POST /api/auth/google - Google SSO Authentication (Supports ID Token or credential payload)
authRouter.post('/google', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);

  let body: {
    credential?: string;
    code?: string;
    redirectUri?: string;
    email?: string;
    name?: string;
    googleId?: string;
    avatarUrl?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  let email = '';
  let name = '';
  let googleId = '';
  let avatarUrl: string | undefined;

  // 1. If an authorization code was received (Google OAuth Code flow)
  if (body.code && c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET) {
    const profile = await exchangeGoogleAuthCode(
      body.code,
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET,
      body.redirectUri || 'postmessage'
    );
    if (!profile) {
      return c.json({ success: false, error: 'Failed to verify Google authorization code' }, 400);
    }
    email = profile.email;
    name = profile.name || 'Google User';
    googleId = profile.sub;
    avatarUrl = profile.picture;
  } else if (body.credential) {
    // 2. If a Google ID Token was received (Google One Tap / GIS button)
    const profile = await verifyGoogleIdToken(body.credential, c.env.GOOGLE_CLIENT_ID);
    if (!profile) {
      return c.json({ success: false, error: 'Invalid Google credential token' }, 400);
    }
    email = profile.email;
    name = profile.name || 'Google User';
    googleId = profile.sub;
    avatarUrl = profile.picture;
  } else {
    // 3. Fallback direct payload
    email = (body.email || '').trim().toLowerCase();
    name = (body.name || 'Google User').trim();
    googleId = body.googleId || `g_${Date.now()}`;
    avatarUrl = body.avatarUrl;
  }

  if (!email || !email.includes('@')) {
    return c.json({ success: false, error: 'Valid Google email required' }, 400);
  }

  // Check if user exists by email or googleId
  let user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  const now = new Date().toISOString();

  if (user) {
    // Existing user: link Google ID if missing
    if (!user.googleId) {
      await db
        .update(schema.users)
        .set({
          googleId,
          avatarUrl: avatarUrl || user.avatarUrl,
          updatedAt: now,
        })
        .where(eq(schema.users.id, user.id));
      user = (await db.query.users.findFirst({ where: eq(schema.users.id, user.id) })) || user;
    }
  } else {
    // New Google user: Auto-create GHL subaccount
    const subaccount = await createSubaccount(
      {
        name: `${name}'s Workspace`,
        email,
        companyName: `${name}'s Workspace`,
        country: c.env.GHL_DEFAULT_COUNTRY || 'CA',
        timezone: c.env.GHL_DEFAULT_TIMEZONE || 'America/Vancouver',
      },
      c.env.GHL_AGENCY_API_KEY,
      c.env.GHL_COMPANY_ID
    );

    const userId = `usr_g_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newUser: typeof schema.users.$inferInsert = {
      id: userId,
      email,
      name,
      googleId,
      organization: null,
      role: email === 'kevingkday@gmail.com' ? 'admin' : 'user',
      avatarUrl: avatarUrl || null,
      ghlSubaccountId: subaccount.id,
      creditBalance: 500,
      streakCount: 0,
      totalPoints: 0,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.users).values(newUser);

    // Initial 500 credit grant
    await db.insert(schema.creditTransactions).values({
      id: `ctx_init_${Date.now()}`,
      userId,
      amount: 500,
      balanceAfter: 500,
      type: 'bonus',
      description: 'Welcome bonus (Google Sign-In)',
      createdAt: now,
    });

    user = newUser as typeof schema.users.$inferSelect;
  }

  // Create session
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(schema.sessions).values({
    id: token,
    userId: user.id,
    expiresAt,
    createdAt: now,
  });

  return c.json({
    success: true,
    user: sanitizeUser(user),
    token,
  });
});

// GET /api/auth/me - Return currently authenticated user
authRouter.get('/me', async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, authenticated: false }, 401);
  }

  return c.json({
    success: true,
    authenticated: true,
    user: sanitizeUser(user),
  });
});

// POST /api/auth/logout - Terminate session
authRouter.post('/logout', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: true });
  }
  const db = getDb(c.env.DB);

  const authHeader = c.req.header('Authorization');
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    token = c.req.header('x-session-token') || undefined;
  }

  if (token) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
  }

  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});
