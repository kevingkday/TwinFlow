import { Hono } from 'hono';
import type { Bindings } from '../db';

export const healthRouter = new Hono<{ Bindings: Bindings }>();

healthRouter.get('/', async (c) => {
  const d1BindingPresent = !!c.env?.DB;

  let d1Status = 'available';
  if (d1BindingPresent) {
    try {
      // Execute a lightweight check against D1
      await c.env.DB.prepare('SELECT 1').run();
      d1Status = 'connected';
    } catch {
      d1Status = 'configured';
    }
  } else {
    d1Status = 'unbound';
  }

  return c.json({
    status: 'healthy',
    service: c.env?.APP_NAME || 'twinflow-server',
    environment: c.env?.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(performance.now() / 1000),
    checks: {
      worker: 'ok',
      d1Database: d1Status,
    },
  });
});
