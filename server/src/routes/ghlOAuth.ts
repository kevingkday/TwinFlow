/**
 * GoHighLevel OAuth 2.0 & Auto-Provisioning Routes
 *
 * Implements:
 * - GET  /api/oauth/ghl/start: Generates state & redirects to HighLevel Location Picker
 * - GET  /api/oauth/ghl/callback: Exchanges code for tokens, encrypts at rest, upserts connection
 * - GET  /api/oauth/ghl/status: Connection status & decrypted temporary subaccount credentials
 * - POST /api/oauth/ghl/disconnect: Clears stored OAuth tokens
 * - POST /api/oauth/ghl/provision-subaccount: On-demand provisioning helper
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Bindings } from '../db';
import { getDb } from '../db';
import { ghlOauthConnections, ghlOauthStates, users } from '../db/schema';
import { getSessionUser } from './auth';
import {
  GHL_MARKETPLACE_OAUTH_URL,
  GHL_OAUTH_SCOPES,
  createSubaccountAdminUser,
  exchangeGhlAuthCode,
  resolveUserGhlCredentials,
} from '../services/ghlOAuth';
import { createSubaccount } from '../services/ghl';
import { encryptAtRest, decryptAtRest } from '../services/crypto';

export const ghlOAuthRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/oauth/ghl/start
 * Initiates the OAuth 2.0 flow for the authenticated user.
 */
ghlOAuthRouter.get('/start', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);

  if (!user) {
    // If not authenticated, redirect to login page
    return c.redirect('/#login?error=auth_required');
  }

  // Generate cryptographically random 24-byte hex state token
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const state = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const redirectAfter = c.req.query('redirect') || '/#profile';

  await db.insert(ghlOauthStates).values({
    state,
    userId: user.id,
    creatorId: user.id,
    userEmail: user.email,
    redirectAfter,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  const origin = new URL(c.req.url).origin;
  const redirectUri = `${(c.env.APP_URL || origin).replace(/\/$/, '')}/api/oauth/ghl/callback`;
  const clientId = c.env.GHL_CLIENT_ID || '';

  const authUrl = `${GHL_MARKETPLACE_OAUTH_URL}?response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(
    GHL_OAUTH_SCOPES.join(' ')
  )}&state=${encodeURIComponent(state)}`;

  return c.redirect(authUrl, 302);
});

/**
 * GET /api/oauth/ghl/callback
 * Handles the OAuth 2.0 callback from HighLevel.
 */
ghlOAuthRouter.get('/callback', async (c) => {
  if (!c.env?.DB) {
    return c.redirect('/#profile?ghl_oauth=error&message=Database+unavailable');
  }
  const db = getDb(c.env.DB);

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error') || c.req.query('error_description');

  if (error) {
    return c.redirect(`/#profile?ghl_oauth=error&message=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.redirect(
      `/#profile?ghl_oauth=error&message=${encodeURIComponent('Missing authorization code or state token')}`
    );
  }

  // Atomically look up and delete state token (single-use CSRF defense)
  const stateRecord = await db.query.ghlOauthStates.findFirst({
    where: eq(ghlOauthStates.state, state),
  });

  if (!stateRecord) {
    return c.redirect(
      `/#profile?ghl_oauth=error&message=${encodeURIComponent('Invalid or already used state token')}`
    );
  }

  await db.delete(ghlOauthStates).where(eq(ghlOauthStates.state, state));

  if (Date.now() > stateRecord.expiresAt) {
    return c.redirect(
      `/#profile?ghl_oauth=error&message=${encodeURIComponent('State token has expired. Please initiate connection again.')}`
    );
  }

  // Exchange code for tokens
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${(c.env.APP_URL || origin).replace(/\/$/, '')}/api/oauth/ghl/callback`;
  const tokenRes = await exchangeGhlAuthCode(code, redirectUri, c.env);

  if (!tokenRes.success || !tokenRes.accessToken || !tokenRes.locationId) {
    return c.redirect(
      `/#profile?ghl_oauth=error&message=${encodeURIComponent(
        tokenRes.error || 'Failed to exchange authorization code for HighLevel access tokens'
      )}`
    );
  }

  // Strict location validation: Ensure no other TwinFlow account is bound to this location
  const existingConn = await db.query.ghlOauthConnections.findFirst({
    where: eq(ghlOauthConnections.locationId, tokenRes.locationId),
  });

  if (existingConn && existingConn.userId !== stateRecord.userId) {
    return c.redirect(
      `/#profile?ghl_oauth=error&message=${encodeURIComponent(
        'This HighLevel Sub-Account is already linked to another TwinFlow account.'
      )}`
    );
  }

  // Encrypt tokens at rest
  const encSecret = c.env.GHL_TOKEN_ENCRYPTION_KEY;
  const encAccess = await encryptAtRest(tokenRes.accessToken, encSecret);
  const encRefresh = tokenRes.refreshToken
    ? await encryptAtRest(tokenRes.refreshToken, encSecret)
    : null;
  const expiresAt = Date.now() + (Number(tokenRes.expiresIn) || 86399) * 1000;
  const now = new Date().toISOString();

  // Upsert connection
  const userConn = await db.query.ghlOauthConnections.findFirst({
    where: eq(ghlOauthConnections.userId, stateRecord.userId),
  });

  if (userConn) {
    await db
      .update(ghlOauthConnections)
      .set({
        locationId: tokenRes.locationId,
        companyId: tokenRes.companyId || userConn.companyId,
        userType: tokenRes.userType || 'Location',
        scope: tokenRes.scope || userConn.scope,
        accessTokenEnc: encAccess,
        refreshTokenEnc: encRefresh || userConn.refreshTokenEnc,
        expiresAt,
        connectedByEmail: stateRecord.userEmail,
        updatedAt: now,
      })
      .where(eq(ghlOauthConnections.userId, stateRecord.userId));
  } else {
    await db.insert(ghlOauthConnections).values({
      userId: stateRecord.userId,
      creatorId: stateRecord.userId,
      locationId: tokenRes.locationId,
      companyId: tokenRes.companyId || null,
      userType: tokenRes.userType || 'Location',
      scope: tokenRes.scope || null,
      accessTokenEnc: encAccess,
      refreshTokenEnc: encRefresh,
      expiresAt,
      connectedByEmail: stateRecord.userEmail,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Update user's ghlSubaccountId
  await db
    .update(users)
    .set({
      ghlSubaccountId: tokenRes.locationId,
      updatedAt: now,
    })
    .where(eq(users.id, stateRecord.userId));

  console.log(`[GHL OAuth] User ${stateRecord.userId} successfully connected HighLevel location ${tokenRes.locationId}`);

  // Redirect back to profile page
  const targetBase = stateRecord.redirectAfter || '/#profile';
  const redirectTarget = targetBase.includes('?')
    ? `${targetBase}&ghl_oauth=connected`
    : `${targetBase}?ghl_oauth=connected`;

  return c.redirect(redirectTarget);
});

/**
 * GET /api/oauth/ghl/status
 * Returns current connection status, auth method, and auto-provisioned admin credentials.
 */
ghlOAuthRouter.get('/status', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const creds = await resolveUserGhlCredentials(db, user, c.env);
  const conn = await db.query.ghlOauthConnections.findFirst({
    where: eq(ghlOauthConnections.userId, user.id),
  });

  return c.json({
    success: true,
    connected: creds.authMethod === 'oauth' || creds.authMethod === 'pit',
    locationId: creds.locationId || user.ghlSubaccountId || null,
    authMethod: creds.authMethod,
    scope: conn?.scope || null,
    expiresAt: conn?.expiresAt || null,
    subaccountLoginEmail: creds.subaccountLoginEmail || conn?.subaccountLoginEmail || user.email,
    subaccountTempPassword: creds.subaccountTempPassword || null,
  });
});

/**
 * POST /api/oauth/ghl/disconnect
 * Disconnects OAuth connection (and optionally clears manual PIT key).
 */
ghlOAuthRouter.post('/disconnect', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const now = new Date().toISOString();

  await db
    .update(ghlOauthConnections)
    .set({
      accessTokenEnc: null,
      refreshTokenEnc: null,
      expiresAt: null,
      scope: null,
      updatedAt: now,
    })
    .where(eq(ghlOauthConnections.userId, user.id));

  let body: { clearPit?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    // Body is optional
  }

  if (body.clearPit) {
    await db
      .update(users)
      .set({
        ghlApiKey: null,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));
  }

  return c.json({
    success: true,
    message: 'HighLevel CRM disconnected successfully.',
  });
});

/**
 * POST /api/oauth/ghl/provision-subaccount
 * On-demand helper to provision Sub-Account + Sub-Account Admin User.
 */
ghlOAuthRouter.post('/provision-subaccount', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  // 1. Provision location if missing or placeholder
  let locationId = user.ghlSubaccountId;
  if (!locationId || locationId.startsWith('loc_')) {
    const locRes = await createSubaccount(
      {
        name: user.organization || `${user.name}'s Workspace`,
        email: user.email,
        companyName: user.organization || `${user.name}'s Workspace`,
        country: user.country || c.env.GHL_DEFAULT_COUNTRY || 'CA',
        timezone: user.timezone || c.env.GHL_DEFAULT_TIMEZONE || 'America/Vancouver',
        snapshotId: c.env.GHL_SNAPSHOT_ID,
      },
      c.env.GHL_AGENCY_API_KEY,
      c.env.GHL_COMPANY_ID,
      c.env.GHL_SNAPSHOT_ID
    );
    locationId = locRes.id;
    await db
      .update(users)
      .set({
        ghlSubaccountId: locationId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));
  }

  // 2. Create subaccount admin user
  const adminRes = await createSubaccountAdminUser(
    {
      locationId,
      email: user.email,
      name: user.name,
    },
    c.env.GHL_AGENCY_API_KEY,
    c.env.GHL_COMPANY_ID
  );

  const encSecret = c.env.GHL_TOKEN_ENCRYPTION_KEY;
  const tempPassEnc = await encryptAtRest(adminRes.password, encSecret);
  const now = new Date().toISOString();

  const userConn = await db.query.ghlOauthConnections.findFirst({
    where: eq(ghlOauthConnections.userId, user.id),
  });

  if (userConn) {
    await db
      .update(ghlOauthConnections)
      .set({
        locationId,
        subaccountUserId: adminRes.userId || userConn.subaccountUserId,
        subaccountLoginEmail: adminRes.email,
        subaccountTempPasswordEnc: tempPassEnc,
        updatedAt: now,
      })
      .where(eq(ghlOauthConnections.userId, user.id));
  } else {
    await db.insert(ghlOauthConnections).values({
      userId: user.id,
      creatorId: user.id,
      locationId,
      subaccountUserId: adminRes.userId || null,
      subaccountLoginEmail: adminRes.email,
      subaccountTempPasswordEnc: tempPassEnc,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({
    success: true,
    locationId,
    subaccountLoginEmail: adminRes.email,
    subaccountTempPassword: adminRes.password,
    mock: adminRes.mock,
    message: 'HighLevel sub-account and login credentials provisioned successfully.',
  });
});
