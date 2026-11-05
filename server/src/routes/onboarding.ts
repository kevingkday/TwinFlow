import { Hono } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { eq } from 'drizzle-orm';
import { getSessionUser, sanitizeUser } from './auth';
import { fetchSerpNews } from '../services/serpNews';
import { crawlArticle } from '../services/firecrawl';
import { enrichSignalWithLLM } from '../services/llmEnricher';
import { findApolloContact } from '../services/apollo';
import { planNewsQueryWithAI } from '../services/aiQueryPlanner';
import { isLowYieldArticle, isNonBuyerRole, isSportsArticle, usableCompanyDomain } from '../services/signalQuality';
import { judgeArticleRelevance } from '../services/relevanceJudge';

export const onboardingRouter = new Hono<{ Bindings: Bindings }>();

// POST /api/user/onboarding - Save ICP preferences & trigger initial news scout
onboardingRouter.post('/', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Database unavailable' }, 500);
  }
  const db = getDb(c.env.DB);

  const authUser = await getSessionUser(c);
  if (!authUser) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  let body: {
    targetLocation?: string;
    userIntent?: string;
    userMission?: string;
    targetIndustries?: string[];
    targetTriggers?: string[];
    targetRoles?: string[];
    valueProp?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const targetLocation = (body.targetLocation || '').trim();
  const userIntent = (body.userIntent || 'sales_client_acquisition').trim();
  const userMission = (body.userMission || '').trim();
  const targetIndustries = Array.isArray(body.targetIndustries) ? body.targetIndustries : [];
  const targetTriggers = Array.isArray(body.targetTriggers) ? body.targetTriggers : [];
  const targetRoles = Array.isArray(body.targetRoles) ? body.targetRoles : [];
  const valueProp = (body.valueProp || '').trim();

  // 1. Synthesize precision Google News query using GPT-4o Goldilocks calibration
  const queryPlan = await planNewsQueryWithAI(
    {
      location: targetLocation,
      userIntent,
      userMission,
      targetIndustries,
      targetTriggers,
      valueProp,
    },
    c.env.OPENAI_API_KEY
  );

  const now = new Date().toISOString();

  // 2. Update user record in D1
  await db
    .update(schema.users)
    .set({
      targetLocation: targetLocation || null,
      userIntent: userIntent || 'sales_client_acquisition',
      userMission: userMission || null,
      icpQuery: queryPlan.primaryQuery,
      targetIndustries: JSON.stringify(targetIndustries),
      targetTriggers: JSON.stringify(targetTriggers),
      targetRoles: JSON.stringify(targetRoles),
      valueProp: valueProp || queryPlan.missionSummary,
      onboardingCompleted: true,
      updatedAt: now,
    })
    .where(eq(schema.users.id, authUser.id));

  // Fetch updated user
  const updatedUser = await db.query.users.findFirst({
    where: eq(schema.users.id, authUser.id),
  });

  // 3. Launch initial personalized news ingestion using calibrated query
  let ingestedCount = 0;
  try {
    const newsArticles = await fetchSerpNews(
      queryPlan.primaryQuery,
      c.env.SERP_API_KEY,
      8,
      queryPlan.geographicFocus.gl,
      queryPlan.fallbackQueries,
      { searchTiers: queryPlan.searchTiers, queryLadder: queryPlan.queryLadder }
    );

    for (const art of newsArticles) {
      try {
        if (isLowYieldArticle(art.title, art.publisher, art.url) || isSportsArticle(art.title, art.publisher)) continue;
        const crawl = await crawlArticle(art.url, c.env.FIRECRAWL_API_KEY, art.snippet);
        const profile = {
          location: targetLocation,
          userIntent,
          userMission,
          targetIndustries,
          targetTriggers,
          valueProp,
        };
        const judgment = await judgeArticleRelevance(
          profile,
          { title: art.title, publisher: art.publisher, text: `${art.snippet}\n${crawl.markdown}` },
          c.env.OPENAI_API_KEY
        );
        if (!judgment.relevant) {
          console.log(`[Relevance] rejected "${art.title}" from "${art.query || ''}": ${judgment.relevantReason}`);
          continue;
        }
        const enriched = await enrichSignalWithLLM(
          art.title,
          crawl.markdown,
          art.publisher || 'Google News',
          c.env.OPENAI_API_KEY,
          queryPlan.recommendedPitchAngle || valueProp,
          userIntent
        );

        if (!enriched.decisionMaker?.name || isNonBuyerRole(enriched.decisionMaker.role || '')) continue;
        const domain = usableCompanyDomain(enriched.companyDomain);
        const apollo = domain
          ? await findApolloContact(enriched.decisionMaker.name, enriched.decisionMaker.role, domain, c.env.APOLLO_API_KEY)
          : { matched: false, status: 'fallback' as const, email: undefined, linkedinUrl: undefined };

        const signalId = `sig_onb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const contactId = `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const draftId = `drf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        await db.insert(schema.signals).values({
          id: signalId,
          userId: authUser.id,
          parentSignalId: null,
          title: art.title,
          sourceUrl: art.url,
          publishedAt: art.publishedAt || new Date().toISOString(),
          summaryBullets: JSON.stringify(enriched.summaryBullets),
          companyName: enriched.companyName,
          signalType: enriched.signalType,
          industryTags: JSON.stringify(enriched.industryTags || targetIndustries),
          status: 'queued',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await db.insert(schema.contacts).values({
          id: contactId,
          signalId,
          name: enriched.decisionMaker.name,
          title: enriched.decisionMaker.role,
          email: apollo.email || null,
          linkedinUrl: apollo.linkedinUrl || null,
          avatarUrl: apollo.avatarUrl || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        await db.insert(schema.outreachDrafts).values({
          id: draftId,
          signalId,
          contactId,
          subject: enriched.pitchSubject,
          body: enriched.pitchBody,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Insert initial branch entities
        if (enriched.competitors) {
          for (const comp of enriched.competitors) {
            await db.insert(schema.relatedEntities).values({
              id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              signalId,
              entityType: 'competitor',
              name: comp.name,
              domain: comp.domain,
              reason: comp.reason,
              status: 'unexplored',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        ingestedCount++;
      } catch (itemErr) {
        console.warn('Error ingesting item during onboarding:', itemErr);
      }
    }
  } catch (ingestErr) {
    console.warn('Onboarding news ingest encountered issue:', ingestErr);
  }

  return c.json({
    success: true,
    user: sanitizeUser(updatedUser || authUser),
    queryPlan: {
      primaryQuery: queryPlan.primaryQuery,
      fallbackQueries: queryPlan.fallbackQueries,
      geographicFocus: queryPlan.geographicFocus,
      missionSummary: queryPlan.missionSummary,
      modelUsed: queryPlan.modelUsed,
    },
    icpQuery: queryPlan.primaryQuery,
    ingestedCount,
    message: `Onboarding complete! Initialized your deck with ${ingestedCount} tailored signals.`,
  });
});
