import { Hono } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { getSessionUser } from './auth';
import { getSocialAccounts, publishSocialPost } from '../services/ghl';
import { resolveUserGhlCredentials } from '../services/ghlOAuth';

export const socialRouter = new Hono<{ Bindings: Bindings }>();

// GET /api/social/accounts - Fetch connected social accounts for the user's CRM sub-account
socialRouter.get('/accounts', async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const db = getDb(c.env.DB);
  const creds = await resolveUserGhlCredentials(db, user, c.env);
  const subaccountId = creds.locationId || user.ghlSubaccountId || c.env.GHL_LOCATION_ID || 'default_subaccount';
  const apiKey = creds.token || user.ghlApiKey || c.env.GHL_API_KEY || '';

  const result = await getSocialAccounts(subaccountId, apiKey);

  return c.json({
    success: true,
    accounts: result.accounts,
    mock: result.mock,
    subaccountId,
    isCrmConnected: creds.authMethod === 'oauth' || creds.authMethod === 'pit',
  });
});

interface PublishNewsPayload {
  title: string;
  summary: string;
  accountIds: string[];
  mediaUrls?: string[];
  scheduledAt?: string;
  companyName?: string;
}

// POST /api/social/publish - Push announcement/news to CRM Social Planner channels & store in signals
socialRouter.post('/publish', async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json<PublishNewsPayload>().catch((): PublishNewsPayload => ({
    title: '',
    summary: '',
    accountIds: [],
  }));

  const title = (body.title || '').trim();
  const summary = (body.summary || '').trim();
  const accountIds = Array.isArray(body.accountIds) ? body.accountIds : [];

  if (!title || !summary) {
    return c.json({ success: false, error: 'Headline and announcement summary are required.' }, 400);
  }

  if (accountIds.length === 0) {
    return c.json({ success: false, error: 'Please select at least one social media channel to publish to.' }, 400);
  }

  const db = getDb(c.env.DB);
  const creds = await resolveUserGhlCredentials(db, user, c.env);
  const subaccountId = creds.locationId || user.ghlSubaccountId || c.env.GHL_LOCATION_ID || 'default_subaccount';
  const apiKey = creds.token || user.ghlApiKey || c.env.GHL_API_KEY || '';

  // 1. Post to GoHighLevel Social Planner API
  const ghlResult = await publishSocialPost(
    subaccountId,
    {
      accountIds,
      summary: `${title}\n\n${summary}`,
      media: (body.mediaUrls || []).map((url) => ({ url, type: 'image' })),
      scheduledAt: body.scheduledAt,
    },
    apiKey
  );

  // 2. Also register this published announcement as a signal in the user's intelligence deck
  if (c.env?.DB) {
    try {
      const db = getDb(c.env.DB);
      const signalId = `news_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();

      await db.insert(schema.signals).values({
        id: signalId,
        userId: user.id,
        campaignId: user.activeCampaignId || null,
        parentSignalId: 'user-broadcast',
        title,
        sourceUrl: 'https://twinflow.co/broadcast',
        publishedAt: now,
        summaryBullets: JSON.stringify([
          'Company news announcement published to social media channels via CRM',
          summary.slice(0, 140) + '...',
          `Broadcasted across ${accountIds.length} connected channel(s)`,
        ]),
        companyName: body.companyName || user.organization || user.name || 'Our Company',
        signalType: 'Company Announcement',
        articleSummary: summary,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      console.warn('[Social Publish] Could not persist signal to DB:', err);
    }
  }

  return c.json({
    success: true,
    ghlResult,
    channelsPushed: accountIds.length,
    message: ghlResult.message || `Published to ${accountIds.length} social channels successfully!`,
  });
});

interface AiDraftPayload {
  topic: string;
  keyPoints?: string;
  companyName?: string;
  tone?: 'executive' | 'exciting' | 'educational';
}

// POST /api/social/ai-draft - AI assistant to generate multi-platform social announcements
socialRouter.post('/ai-draft', async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json<AiDraftPayload>().catch((): AiDraftPayload => ({ topic: '' }));
  const topic = (body.topic || '').trim();
  const keyPoints = (body.keyPoints || '').trim();
  const company = (body.companyName || user.organization || user.name || 'Our Company').trim();

  if (!topic) {
    return c.json({ success: false, error: 'Please enter a topic or rough announcement notes.' }, 400);
  }

  const cleanKey = (c.env.OPENAI_API_KEY || '').trim();

  if (cleanKey && cleanKey.startsWith('sk-') && !cleanKey.includes('your_')) {
    try {
      const systemPrompt = `You are a corporate communications officer and B2B social media strategist.
Your task is to take a company's announcement or rough news bullets and generate:
1. A crisp, authoritative Press Release / News Headline (under 90 chars)
2. A formal announcement summary for the company press wire
3. A LinkedIn post (professional, formatting with line breaks, strong hook, business impact)
4. An X/Twitter post (punchy, under 260 characters, with 2 relevant hashtags)
5. A Google Business / Facebook update (customer-oriented, direct call to connect)

Return ONLY valid JSON matching this schema:
{
  "headline": "String",
  "summary": "String",
  "linkedinPost": "String",
  "twitterPost": "String",
  "facebookPost": "String"
}`;

      const userPrompt = `Company: ${company}
Announcement Topic: ${topic}
Additional Key Points / Specifics: ${keyPoints || 'None specified'}
Tone: ${body.tone || 'executive'}`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        const rawContent = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(rawContent);

        return c.json({
          success: true,
          draft: parsed,
        });
      }
    } catch (err) {
      console.warn('[Social AI Draft] OpenAI error:', err);
    }
  }

  // High-fidelity fallback draft
  return c.json({
    success: true,
    draft: {
      headline: `${company} Announces Milestone: ${topic}`,
      summary: `${company} is proud to announce significant operational progress regarding ${topic}. ${keyPoints ? `Key highlights include: ${keyPoints}.` : ''} This catalyst marks an exciting next chapter for our team and clients.`,
      linkedinPost: `Excited to share our latest milestone at ${company}!\n\nWe're officially rolling out our new updates around ${topic}.\n\n${keyPoints ? `Here's what this means:\n• ${keyPoints.split('\n').join('\n• ')}\n\n` : ''}Looking forward to partnering with industry leaders as we expand. What are your thoughts on this shift? Let's connect below!`,
      twitterPost: `Big news from ${company}! We're officially announcing: ${topic}. Stay tuned as we scale up our pipeline. #B2B #Growth`,
      facebookPost: `We're thrilled to share our latest announcement with our community! ${topic}. Thank you for your continued trust and partnership with ${company}.`,
    },
  });
});
