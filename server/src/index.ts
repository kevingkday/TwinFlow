import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Bindings } from './db';
import { resolveAllowedOrigin } from './cors';
import { healthRouter } from './routes/health';
import { signalsRouter } from './routes/signals';
import { userRouter } from './routes/user';
import { authRouter } from './routes/auth';
import { onboardingRouter } from './routes/onboarding';
import { adminRouter } from './routes/admin';
import { campaignsRouter } from './routes/campaigns';
import { socialRouter } from './routes/social';
import { contactsRouter } from './routes/contacts';
import { stripeRouter } from './routes/stripe';

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

export default app;
