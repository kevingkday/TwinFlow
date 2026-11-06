/**
 * GoHighLevel OAuth 2.0 & Sub-Account Provisioning Service
 *
 * Implements HighLevel's OAuth 2.0 Marketplace App authorization code flow,
 * automated Sub-Account + Sub-Account Admin User provisioning, encrypted token storage,
 * and automatic token refresh with fallback to Private Integration Tokens (PIT).
 */

import { eq } from 'drizzle-orm';
import type { Database, Bindings } from '../db';
import { ghlOauthConnections, ghlOauthStates, users } from '../db/schema';
import { encryptAtRest, decryptAtRest, generateSubaccountPassword } from './crypto';

export const GHL_API_BASE = 'https://services.leadconnectorhq.com';
export const GHL_MARKETPLACE_OAUTH_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
export const GHL_TOKEN_URL = `${GHL_API_BASE}/oauth/token`;
export const GHL_API_VERSION = '2021-07-28';
export const GHL_DEFAULT_COMPANY_ID = 'ycxGZPk2GALkmii5NPkO';

// Required Marketplace App permission scopes
export const GHL_OAUTH_SCOPES = [
  'chat-widget.readonly',
  'chat-widget.write',
  'contacts.readonly',
  'contacts.write',
  'conversations.readonly',
  'conversations.write',
  'conversations/message.readonly',
  'conversations/message.write',
  'locations.readonly',
];

export interface SubaccountAdminUserInput {
  locationId: string;
  email: string;
  name?: string;
  password?: string;
}

export interface SubaccountAdminUserResult {
  success: boolean;
  userId?: string;
  email: string;
  password: string;
  mock: boolean;
  error?: string;
}

export interface ExchangeCodeResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  locationId?: string;
  companyId?: string;
  scope?: string;
  userType?: string;
  error?: string;
}

export interface ResolvedGhlCredentials {
  token: string;
  locationId: string;
  authMethod: 'oauth' | 'pit' | 'mock';
  subaccountLoginEmail?: string | null;
  subaccountTempPassword?: string | null;
}

/**
 * Creates a Sub-Account Admin login user on HighLevel using the Agency API Key.
 * Endpoint: POST https://services.leadconnectorhq.com/users/
 */
export async function createSubaccountAdminUser(
  input: SubaccountAdminUserInput,
  agencyApiKey?: string,
  companyId?: string
): Promise<SubaccountAdminUserResult> {
  const cleanKey = (agencyApiKey || '').trim();
  const cleanCompanyId = (companyId || '').trim() || GHL_DEFAULT_COMPANY_ID;
  const initialPassword = input.password || generateSubaccountPassword();

  const nameParts = (input.name || 'Workspace Admin').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Workspace';
  const lastName = nameParts.slice(1).join(' ') || 'Admin';

  if (cleanKey && !cleanKey.includes('your_') && cleanKey.length > 15) {
    try {
      const payload = {
        companyId: cleanCompanyId,
        firstName,
        lastName,
        email: input.email.trim().toLowerCase(),
        password: initialPassword,
        type: 'account',
        role: 'admin',
        locationIds: [input.locationId],
      };

      const res = await fetch(`${GHL_API_BASE}/users/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          Version: GHL_API_VERSION,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = (await res.json()) as { id?: string; user?: { id: string } };
        const userId = data.user?.id || data.id || `usr_ghl_${Date.now()}`;
        console.log(`[GHL Agency] Created sub-account admin user [${userId}] for ${input.email}`);
        return {
          success: true,
          userId,
          email: input.email,
          password: initialPassword,
          mock: false,
        };
      } else {
        const errText = await res.text();
        console.warn(`[GHL Agency] Failed to create subaccount admin user (${res.status}):`, errText);
        return {
          success: false,
          email: input.email,
          password: initialPassword,
          mock: false,
          error: `GHL returned ${res.status}: ${errText}`,
        };
      }
    } catch (err) {
      console.warn('[GHL Agency] Network error creating subaccount admin user:', err);
      return {
        success: false,
        email: input.email,
        password: initialPassword,
        mock: true,
        error: String(err),
      };
    }
  }

  // Mock fallback when agency key not configured
  return {
    success: true,
    userId: `mock_usr_${Date.now().toString(36)}`,
    email: input.email,
    password: initialPassword,
    mock: true,
  };
}

/**
 * Exchanges an OAuth 2.0 authorization code for access and refresh tokens.
 * CRITICAL: Content-Type must be application/x-www-form-urlencoded
 */
export async function exchangeGhlAuthCode(
  code: string,
  redirectUri: string,
  env: Bindings
): Promise<ExchangeCodeResult> {
  const clientId = env.GHL_CLIENT_ID?.trim();
  const clientSecret = env.GHL_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'GHL_CLIENT_ID or GHL_CLIENT_SECRET is missing in server environment.',
    };
  }

  try {
    const formBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      user_type: 'Location',
      redirect_uri: redirectUri,
    });

    const res = await fetch(GHL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody.toString(),
    });

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      locationId?: string;
      companyId?: string;
      scope?: string;
      userType?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !data.access_token) {
      return {
        success: false,
        error: data.error_description || data.error || `HTTP ${res.status} from GHL OAuth token exchange`,
      };
    }

    if (!data.locationId) {
      return {
        success: false,
        error: 'HighLevel token response did not contain a valid sub-account locationId.',
      };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: Number(data.expires_in) || 86399,
      locationId: data.locationId,
      companyId: data.companyId,
      scope: data.scope,
      userType: data.userType || 'Location',
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error during GHL token exchange: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Refreshes an expired or expiring HighLevel OAuth access token.
 * Note: HighLevel rotates refresh tokens on every refresh call.
 */
export async function refreshGhlAccessToken(
  refreshToken: string,
  env: Bindings
): Promise<ExchangeCodeResult> {
  const clientId = env.GHL_CLIENT_ID?.trim();
  const clientSecret = env.GHL_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'GHL_CLIENT_ID or GHL_CLIENT_SECRET is missing.',
    };
  }

  try {
    const formBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      user_type: 'Location',
    });

    const res = await fetch(GHL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody.toString(),
    });

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      locationId?: string;
      companyId?: string;
      scope?: string;
      userType?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !data.access_token) {
      return {
        success: false,
        error: data.error_description || data.error || `HTTP ${res.status} from GHL OAuth token refresh`,
      };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: Number(data.expires_in) || 86399,
      locationId: data.locationId,
      companyId: data.companyId,
      scope: data.scope,
      userType: data.userType || 'Location',
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error during GHL token refresh: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Resolves the active HighLevel credentials for a given user.
 * 1. Checks OAuth connection. If valid, decrypts access token.
 * 2. If within 5 minutes of expiry, auto-refreshes token and updates DB.
 * 3. Falls back to Private Integration Token (ghlApiKey) if OAuth not connected.
 * 4. Falls back to environment GHL_API_KEY if configured.
 */
export async function resolveUserGhlCredentials(
  db: Database,
  user: { id: string; ghlSubaccountId?: string | null; ghlApiKey?: string | null },
  env: Bindings
): Promise<ResolvedGhlCredentials> {
  const encSecret = env.GHL_TOKEN_ENCRYPTION_KEY;

  // 1. Check OAuth connection
  const conn = await db.query.ghlOauthConnections.findFirst({
    where: eq(ghlOauthConnections.userId, user.id),
  });

  if (conn && conn.accessTokenEnc) {
    const isExpiredOrSoon =
      !conn.expiresAt || Date.now() >= conn.expiresAt - 5 * 60 * 1000;

    if (!isExpiredOrSoon) {
      const decrypted = await decryptAtRest(conn.accessTokenEnc, encSecret);
      if (decrypted) {
        let tempPassword: string | null = null;
        if (conn.subaccountTempPasswordEnc) {
          tempPassword = await decryptAtRest(conn.subaccountTempPasswordEnc, encSecret);
        }
        return {
          token: decrypted,
          locationId: conn.locationId || user.ghlSubaccountId || env.GHL_LOCATION_ID || '',
          authMethod: 'oauth',
          subaccountLoginEmail: conn.subaccountLoginEmail,
          subaccountTempPassword: tempPassword,
        };
      }
    } else if (conn.refreshTokenEnc) {
      // Token is expiring or expired, perform auto-refresh
      const decryptedRefresh = await decryptAtRest(conn.refreshTokenEnc, encSecret);
      if (decryptedRefresh) {
        console.log(`[GHL OAuth] Refreshing expired access token for user ${user.id}`);
        const refreshRes = await refreshGhlAccessToken(decryptedRefresh, env);
        if (refreshRes.success && refreshRes.accessToken) {
          const encAccess = await encryptAtRest(refreshRes.accessToken, encSecret);
          const encRefresh = refreshRes.refreshToken
            ? await encryptAtRest(refreshRes.refreshToken, encSecret)
            : conn.refreshTokenEnc;

          const newExpiresAt = Date.now() + (refreshRes.expiresIn || 86399) * 1000;
          const newLocationId = refreshRes.locationId || conn.locationId;

          await db
            .update(ghlOauthConnections)
            .set({
              accessTokenEnc: encAccess,
              refreshTokenEnc: encRefresh,
              expiresAt: newExpiresAt,
              locationId: newLocationId,
              scope: refreshRes.scope || conn.scope,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(ghlOauthConnections.userId, user.id));

          let tempPassword: string | null = null;
          if (conn.subaccountTempPasswordEnc) {
            tempPassword = await decryptAtRest(conn.subaccountTempPasswordEnc, encSecret);
          }

          return {
            token: refreshRes.accessToken,
            locationId: newLocationId,
            authMethod: 'oauth',
            subaccountLoginEmail: conn.subaccountLoginEmail,
            subaccountTempPassword: tempPassword,
          };
        } else {
          console.warn(`[GHL OAuth] Token refresh failed for user ${user.id}:`, refreshRes.error);
        }
      }
    }
  }

  // 2. Fall back to user's Private Integration Token (PIT)
  if (user.ghlApiKey && user.ghlApiKey.length > 10 && !user.ghlApiKey.includes('your_')) {
    return {
      token: user.ghlApiKey,
      locationId: user.ghlSubaccountId || env.GHL_LOCATION_ID || '',
      authMethod: 'pit',
      subaccountLoginEmail: conn?.subaccountLoginEmail || null,
      subaccountTempPassword: conn?.subaccountTempPasswordEnc
        ? await decryptAtRest(conn.subaccountTempPasswordEnc, encSecret)
        : null,
    };
  }

  // 3. Fall back to environment default or mock
  const fallbackKey = env.GHL_API_KEY || '';
  const fallbackLoc = user.ghlSubaccountId || env.GHL_LOCATION_ID || '';
  return {
    token: fallbackKey,
    locationId: fallbackLoc,
    authMethod: fallbackKey && fallbackKey.length > 10 ? 'pit' : 'mock',
    subaccountLoginEmail: conn?.subaccountLoginEmail || null,
    subaccountTempPassword: conn?.subaccountTempPasswordEnc
      ? await decryptAtRest(conn.subaccountTempPasswordEnc, encSecret)
      : null,
  };
}
