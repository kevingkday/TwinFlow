import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Bindings } from './db';
import { healthRouter } from './routes/health';
import { signalsRouter } from './routes/signals';
import { userRouter } from './routes/user';
import { authRouter } from './routes/auth';
import { onboardingRouter } from './routes/onboarding';

const app = new Hono<{ Bindings: Bindings }>();

// Global middlewares
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-session-token'],
  })
);

// Health check endpoint (GET /api/health)
app.route('/api/health', healthRouter);

// Authentication endpoints (/api/auth/signup, /api/auth/login, /api/auth/google, /api/auth/me, /api/auth/logout)
app.route('/api/auth', authRouter);

// User onboarding questionnaire & signal trigger
app.route('/api/user/onboarding', onboardingRouter);

// User profile & GHL settings endpoint (GET /api/user/profile, POST /api/user/ghl-config)
app.route('/api/user', userRouter);

// Signals & Outbound Pipeline endpoint
app.route('/api/signals', signalsRouter);

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
      auth: '/api/auth',
    },
  });
});

export default app;
