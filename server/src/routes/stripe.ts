import { Hono } from 'hono';
import type { Bindings } from '../db';
import { verifyStripeSignature } from '../services/stripe';

export const stripeRouter = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/stripe/webhook
 * Rejects any payload that does not carry a valid Stripe signature.
 * A verified event is acknowledged only. Credit balances are never read
 * from the event body — grants and debits stay in server handlers that
 * use fixed amounts (see services/credits.ts).
 */
stripeRouter.post('/webhook', async (c) => {
  const rawBody = await c.req.text();
  const check = await verifyStripeSignature(
    rawBody,
    c.req.header('stripe-signature'),
    c.env?.STRIPE_WEBHOOK_SECRET
  );

  if (!check.valid) {
    return c.json({ success: false, error: 'Invalid Stripe signature' }, 400);
  }

  let eventType = 'unknown';
  try {
    const event = JSON.parse(rawBody) as { type?: string };
    if (event.type) eventType = event.type;
  } catch {
    return c.json({ success: false, error: 'Invalid JSON payload' }, 400);
  }

  return c.json({
    success: true,
    received: true,
    type: eventType,
    creditsApplied: 0,
  });
});
