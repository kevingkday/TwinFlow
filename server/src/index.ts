import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { eq } from 'drizzle-orm';
import type { Bindings } from './db';
import { getDb, schema } from './db';
import { resolveAllowedOrigin } from './cors';
import { healthRouter } from './routes/health';
import { signalsRouter, ingestManualArticleForUser } from './routes/signals';
import { userRouter } from './routes/user';
import { authRouter } from './routes/auth';
import { onboardingRouter } from './routes/onboarding';
import { adminRouter } from './routes/admin';
import { campaignsRouter } from './routes/campaigns';
import { socialRouter } from './routes/social';
import { contactsRouter } from './routes/contacts';
import { stripeRouter } from './routes/stripe';
import { ghlOAuthRouter } from './routes/ghlOAuth';
import { gmailOAuthRouter } from './routes/gmailOAuth';

const app = new Hono<{ Bindings: Bindings }>();

// Global middlewares
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => resolveAllowedOrigin(origin),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-session-token', 'Stripe-Signature'],
    credentials: true,
    maxAge: 600,
  })
);

// Health check endpoint (GET /api/health)
app.route('/api/health', healthRouter);

// Authentication endpoints (/api/auth/signup, /api/auth/login, /api/auth/google, /api/auth/me, /api/auth/logout)
app.route('/api/auth', authRouter);

// GoHighLevel OAuth 2.0 & Auto-Provisioning endpoints (/api/oauth/ghl/start, /callback, /status, /disconnect)
app.route('/api/oauth/ghl', ghlOAuthRouter);

// Gmail OAuth 2.0 & Direct Email Sending endpoints (/api/oauth/gmail/start, /callback, /status, /disconnect, /send)
app.route('/api/oauth/gmail', gmailOAuthRouter);

// Campaigns management endpoints (/api/campaigns)
app.route('/api/campaigns', campaignsRouter);

// User onboarding questionnaire & signal trigger
app.route('/api/user/onboarding', onboardingRouter);

// User profile & GHL settings endpoint (GET /api/user/profile, POST /api/user/ghl-config)
app.route('/api/user', userRouter);

// Signals & Outbound Pipeline endpoint
app.route('/api/signals', signalsRouter);

// Approved Contacts & Organizations Pipeline endpoint
app.route('/api/contacts', contactsRouter);

// Social Media Posting & News Broadcast endpoints (/api/social/accounts, /api/social/publish, /api/social/ai-draft)
app.route('/api/social', socialRouter);

// Admin Management Console (/api/admin/stats, /api/admin/users)
app.route('/api/admin', adminRouter);

// Stripe webhooks. Signature is required; the handler does not mint credits.
app.route('/api/stripe', stripeRouter);

// Fallback to client-side static assets / SPA frontend
app.get('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json({
    app: 'TwinFlow Worker API',
    status: 'online',
    endpoints: {
      health: '/api/health',
      signals: '/api/signals',
      campaigns: '/api/campaigns',
      auth: '/api/auth',
    },
  });
});

function extractTokenFromEmailAddress(toAddress: string): string | null {
  const addr = (toAddress || '').trim().toLowerCase();
  const plusMatch = addr.match(/\+(tf_[a-z0-9]+)@/i);
  if (plusMatch) return plusMatch[1];
  const localMatch = addr.match(/^(tf_[a-z0-9]+)@/i);
  return localMatch ? localMatch[1] : null;
}

function extractArticleFromRawEmail(raw: string): { title: string; url: string; text: string } {
  const unfolded = raw.replace(/=\r?\n/g, '').replace(/=3D/gi, '=');
  const subjectMatch = unfolded.match(/^Subject:\s*(.+)$/im);
  const title = subjectMatch ? subjectMatch[1].replace(/^(fwd:|re:)\s*/i, '').trim() : '';
  const urls = unfolded.match(/https?:\/\/[^\s<>"')]+/gi) || [];
  const articleUrl =
    urls.find((u) => !/unsubscribe|optout|preferences|mailto:|tracking|pixel|twinflow\.co|w3\.org|schema\.org/i.test(u)) || '';
  const bodyIdx = unfolded.search(/\r?\n\r?\n/);
  const bodyRaw = bodyIdx >= 0 ? unfolded.slice(bodyIdx).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return { title, url: articleUrl, text: bodyRaw.slice(0, 12000) };
}

export default {
  fetch: app.fetch,
  request: app.request.bind(app),
  async email(
    message: { to: string; from: string; raw: ReadableStream<Uint8Array> },
    env: Bindings,
    ctx: ExecutionContext
  ) {
    if (!env?.DB) return;
    const token = extractTokenFromEmailAddress(message.to);
    if (!token) {
      console.warn('[Email Ingest] No tf_ token found in recipient:', message.to);
      return;
    }
    const db = getDb(env.DB);
    const user = await db.query.users.findFirst({ where: eq(schema.users.ingestToken, token) });
    if (!user) {
      console.warn('[Email Ingest] Unknown ingest token:', token);
      return;
    }
    const rawText = await new Response(message.raw).text();
    const extracted = extractArticleFromRawEmail(rawText);
    ctx.waitUntil(
      ingestManualArticleForUser(db, env, user, {
        url: extracted.url || undefined,
        title: extracted.title || undefined,
        text: extracted.text || undefined,
        sourceLabel: 'Email Forward',
      }).catch((err) => console.error('[Email Ingest] failed:', err))
    );
  },
};
