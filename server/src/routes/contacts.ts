import { Hono } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { eq, desc, and } from 'drizzle-orm';
import { getSessionUser } from './auth';
import { upsertContact, createNote } from '../services/ghl';
import { resolveUserGhlCredentials } from '../services/ghlOAuth';
import { RESEARCH_BRIEF_CREDIT_COST, RESEARCH_BRIEF_XP_AWARD } from '../services/credits';
import { generateVerifiedResearchBrief } from '../services/briefGenerator';
import {
  enrichApolloOrganization,
  extractBusinessDomain,
  findApolloPersonSeed,
  revealApolloPerson,
  searchApolloPeople,
  type ApolloPersonHit,
} from '../services/apollo';

export const contactsRouter = new Hono<{ Bindings: Bindings }>();

function authenticationRequired(c: { json: (body: unknown, status?: number) => Response }) {
  return c.json({ success: false, error: 'Authentication required' }, 401);
}

/**
 * GET /api/contacts
 * Returns approved contacts and organizations with linked signals and pitch drafts.
 * Supports filtering by campaignId, status ('approved' | 'queued' | 'all'), and search string.
 */
contactsRouter.get('/', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const user = await getSessionUser(c);
    if (!user) return authenticationRequired(c);

    const targetCampaignId = c.req.query('campaignId');
    const requestedStatus = c.req.query('status') || 'approved';
    const searchQuery = (c.req.query('q') || '').toLowerCase().trim();

    // Always constrain the D1 query to the signed-in account. Signals with a
    // null or different user_id are another tenant's records.
    const conditions: any[] = [eq(schema.signals.userId, user.id)];
    if (requestedStatus !== 'all') {
      conditions.push(eq(schema.signals.status, requestedStatus as any));
    }
    if (targetCampaignId) {
      conditions.push(eq(schema.signals.campaignId, targetCampaignId));
    }

    const matchedSignals = await db.query.signals.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(schema.signals.updatedAt)],
      with: {
        contacts: {
          with: {
            outreachDrafts: true,
          },
        },
        outreachDrafts: true,
        campaign: true,
      },
    });

    // Flatten into contact records
    const allContacts: Array<{
      id: string;
      name: string;
      title: string;
      email: string | null;
      linkedinUrl: string | null;
      avatarUrl: string | null;
      ghlContactId: string | null;
      createdAt: string;
      updatedAt: string;
      companyName: string;
      signalId: string;
      signalTitle: string;
      signalType: string;
      sourceUrl: string;
      publishedAt: string;
      articleSummary: string | null;
      summaryBullets: string[];
      industryTags: string[];
      signalStatus: string;
      campaignId: string | null;
      campaignName: string | null;
      outreachDraft: {
        id: string;
        subject: string;
        body: string;
        status: string;
      } | null;
    }> = [];

    for (const sig of matchedSignals) {
      let bullets: string[] = [];
      try {
        bullets = JSON.parse(sig.summaryBullets);
      } catch {
        bullets = sig.summaryBullets ? [sig.summaryBullets] : [];
      }

      let tags: string[] = [];
      try {
        tags = sig.industryTags ? JSON.parse(sig.industryTags) : [];
      } catch {
        tags = [];
      }

      const sigContacts = sig.contacts || [];

      if (sigContacts.length > 0) {
        for (const ct of sigContacts) {
          // Find matching draft for this contact or use first draft on signal
          const matchedDraft =
            ct.outreachDrafts?.[0] ||
            sig.outreachDrafts?.find((d) => d.contactId === ct.id) ||
            sig.outreachDrafts?.[0] ||
            null;

          allContacts.push({
            id: ct.id,
            name: ct.name,
            title: ct.title,
            email: ct.email || null,
            linkedinUrl: ct.linkedinUrl || null,
            avatarUrl: ct.avatarUrl || null,
            ghlContactId: ct.ghlContactId || null,
            createdAt: ct.createdAt || sig.createdAt,
            updatedAt: ct.updatedAt || sig.updatedAt,
            companyName: sig.companyName,
            signalId: sig.id,
            signalTitle: sig.title,
            signalType: sig.signalType,
            sourceUrl: sig.sourceUrl,
            publishedAt: sig.publishedAt,
            articleSummary: sig.articleSummary || null,
            summaryBullets: bullets,
            industryTags: tags,
            signalStatus: sig.status,
            campaignId: sig.campaignId || null,
            campaignName: sig.campaign?.name || null,
            outreachDraft: matchedDraft
              ? {
                  id: matchedDraft.id,
                  subject: matchedDraft.subject,
                  body: matchedDraft.body,
                  status: matchedDraft.status,
                }
              : null,
          });
        }
      } else {
        // Fallback for signals with no explicit contact row
        const defaultDraft = sig.outreachDrafts?.[0] || null;
        allContacts.push({
          id: `ct_virtual_${sig.id}`,
          name: 'Target Decision Maker',
          title: 'Executive',
          email: null,
          linkedinUrl: null,
          avatarUrl: null,
          ghlContactId: null,
          createdAt: sig.createdAt,
          updatedAt: sig.updatedAt,
          companyName: sig.companyName,
          signalId: sig.id,
          signalTitle: sig.title,
          signalType: sig.signalType,
          sourceUrl: sig.sourceUrl,
          publishedAt: sig.publishedAt,
          articleSummary: sig.articleSummary || null,
          summaryBullets: bullets,
          industryTags: tags,
          signalStatus: sig.status,
          campaignId: sig.campaignId || null,
          campaignName: sig.campaign?.name || null,
          outreachDraft: defaultDraft
            ? {
                id: defaultDraft.id,
                subject: defaultDraft.subject,
                body: defaultDraft.body,
                status: defaultDraft.status,
              }
            : null,
        });
      }
    }

    // Apply search filter if provided
    let filtered = allContacts;
    if (searchQuery) {
      filtered = allContacts.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery) ||
          c.title.toLowerCase().includes(searchQuery) ||
          (c.email && c.email.toLowerCase().includes(searchQuery)) ||
          c.companyName.toLowerCase().includes(searchQuery) ||
          c.signalTitle.toLowerCase().includes(searchQuery) ||
          c.signalType.toLowerCase().includes(searchQuery)
      );
    }

    // Calculate aggregated metrics
    const totalCount = filtered.length;
    const orgsSet = new Set(filtered.map((c) => c.companyName.toLowerCase()));
    const organizationsCount = orgsSet.size;
    const crmSyncedCount = filtered.filter((c) => Boolean(c.ghlContactId)).length;
    const withEmailCount = filtered.filter((c) => Boolean(c.email)).length;

    return c.json({
      success: true,
      contacts: filtered,
      stats: {
        totalCount,
        organizationsCount,
        crmSyncedCount,
        withEmailCount,
      },
    });
  } catch (err: any) {
    console.error('Error in GET /api/contacts:', err);
    return c.json({ success: false, error: err.message || 'Failed to fetch contacts.' }, 500);
  }
});

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.trim()) : [];
  } catch {
    return [];
  }
}

function buildLookalikeOutreachDraft(
  user: {
    name?: string | null;
    organization?: string | null;
    companyDescription?: string | null;
    valueProp?: string | null;
  },
  contactName: string,
  companyName: string,
  sourceRef?: string
): { subject: string; body: string } {
  const firstName = contactName.split(/\s+/)[0] || 'there';
  const senderOrg = (user.organization || 'our team').replace(/\s*-\s*TwinFlow$/i, '').trim();
  const senderName = user.name || 'Team';
  const offer = (user.valueProp || user.companyDescription || '').trim();
  const shortOffer = offer
    ? offer.split(/[.!?]/)[0].trim()
    : `${senderOrg} services`;

  const subject = `quick question for ${companyName}`;
  const contextLine = sourceRef
    ? `We work with similar teams in your space (like ${sourceRef}) and wanted to reach out directly.`
    : `We work with organizations like ${companyName} and wanted to reach out directly.`;

  const body = `Hi ${firstName},\n\n${contextLine}\n\nAt ${senderOrg}, we help with ${shortOffer.charAt(0).toLowerCase() + shortOffer.slice(1)}. Would you be open to a quick conversation or quote for ${companyName}?\n\nBest regards,\n${senderName}\n${senderOrg}`;
  return { subject, body };
}

/**
 * GET /api/contacts/organization/similar?companyName=...
 * Finds similar organizations and their decision-makers via Apollo lookalike_organization_ids
 * (with industry/role peer fallback) so every account leads to new opportunities.
 */
contactsRouter.get('/organization/similar', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const user = await getSessionUser(c);
    if (!user) return authenticationRequired(c);

    const companyName = (c.req.query('companyName') || '').trim();
    if (!companyName) {
      return c.json({ success: false, error: 'companyName query parameter is required.' }, 400);
    }

    const apolloKey = c.env.APOLLO_API_KEY;
    if (!apolloKey) {
      return c.json({ success: true, mode: 'no_key', similarOrganizations: [] });
    }

    // Load user's signals/contacts for this company to extract domain & industry tags
    const userSignals = await db.query.signals.findMany({
      where: eq(schema.signals.userId, user.id),
      with: { contacts: true },
    });

    const matchingSignals = userSignals.filter(
      (s) => s.companyName.trim().toLowerCase() === companyName.toLowerCase()
    );

    let domain: string | undefined;
    const industryTags = new Set<string>();
    for (const sig of matchingSignals) {
      for (const tag of parseJsonArray(sig.industryTags)) industryTags.add(tag);
      for (const ct of sig.contacts || []) {
        if (!domain && ct.companyDomain) domain = ct.companyDomain;
        if (!domain && ct.email) domain = extractBusinessDomain(ct.email);
      }
    }

    const buyerTitles = parseJsonArray(user.buyerRoles || user.targetRoles);
    const locations = user.targetLocation ? [user.targetLocation] : undefined;

    let hits: ApolloPersonHit[] = [];
    let mode: 'lookalike_org' | 'industry_peers' = 'lookalike_org';

    // Try enriching the organization by domain to get Apollo org ID for lookalike search
    let orgSeedId: string | undefined;
    if (domain) {
      const org = await enrichApolloOrganization(domain, apolloKey);
      if (org?.id) {
        orgSeedId = org.id;
        if (org.industry) industryTags.add(org.industry);
      }
    } else if (matchingSignals[0]?.contacts?.[0]) {
      const firstCt = matchingSignals[0].contacts[0];
      const seed = await findApolloPersonSeed(
        { email: firstCt.email, name: firstCt.name, companyName },
        apolloKey
      );
      orgSeedId = seed?.apolloOrganizationId;
      if (seed?.industry) industryTags.add(seed.industry);
    }

    if (orgSeedId) {
      hits = await searchApolloPeople(
        {
          lookalikeOrganizationIds: [orgSeedId],
          organizationLocations: locations,
          personTitles: buyerTitles.length > 0 ? buyerTitles : undefined,
          perPage: 15,
        },
        apolloKey
      );
      if (hits.length === 0 && locations) {
        hits = await searchApolloPeople(
          {
            lookalikeOrganizationIds: [orgSeedId],
            personTitles: buyerTitles.length > 0 ? buyerTitles : undefined,
            perPage: 15,
          },
          apolloKey
        );
      }
    }

    // Fallback to industry/buyer-profile peer search if lookalike returned nothing
    if (hits.length === 0) {
      mode = 'industry_peers';
      const tags = Array.from(industryTags).slice(0, 5);
      hits = await searchApolloPeople(
        {
          ...(tags.length > 0 ? { organizationKeywordTags: tags } : {}),
          organizationLocations: locations,
          personTitles: buyerTitles.length > 0 ? buyerTitles : undefined,
          perPage: 15,
        },
        apolloKey
      );
    }

    // Exclude the current organization and group by organizationName
    const grouped = new Map<
      string,
      Array<{
        apolloPersonId: string;
        firstName: string;
        title: string;
        organizationName: string;
        hasEmail: boolean;
      }>
    >();

    for (const h of hits) {
      const orgName = h.organizationName.trim();
      if (!orgName || orgName.toLowerCase() === companyName.toLowerCase()) continue;
      if (!grouped.has(orgName)) grouped.set(orgName, []);
      const list = grouped.get(orgName)!;
      if (list.length < 3) {
        list.push({
          apolloPersonId: h.id,
          firstName: h.firstName,
          title: h.title,
          organizationName: orgName,
          hasEmail: h.hasEmail,
        });
      }
    }

    const similarOrganizations = Array.from(grouped.entries())
      .slice(0, 6)
      .map(([organizationName, orgContacts]) => ({
        organizationName,
        contacts: orgContacts,
      }));

    return c.json({
      success: true,
      mode,
      similarOrganizations,
    });
  } catch (err: any) {
    console.error('Error in GET /api/contacts/organization/similar:', err);
    return c.json({ success: false, error: err.message || 'Failed to find similar organizations.' }, 500);
  }
});

/**
 * GET /api/contacts/:id/similar
 * Finds similar contacts via Apollo lookalike_person_ids (with role/industry peer fallback).
 */
contactsRouter.get('/:id/similar', async (c) => {
  const contactId = c.req.param('id');
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const user = await getSessionUser(c);
    if (!user) return authenticationRequired(c);

    const contact = await db.query.contacts.findFirst({
      where: eq(schema.contacts.id, contactId),
      with: { signal: true },
    });

    if (!contact || !contact.signal || contact.signal.userId !== user.id) {
      return c.json({ success: false, error: 'Contact not found.' }, 404);
    }

    const apolloKey = c.env.APOLLO_API_KEY;
    if (!apolloKey) {
      return c.json({ success: true, mode: 'no_key', candidates: [] });
    }

    const domain = contact.companyDomain || extractBusinessDomain(contact.email);
    const seed = await findApolloPersonSeed(
      {
        email: contact.email,
        name: contact.name,
        companyName: contact.company || contact.signal.companyName,
        domain,
      },
      apolloKey
    );

    const locations = user.targetLocation ? [user.targetLocation] : undefined;
    const buyerTitles = parseJsonArray(user.buyerRoles || user.targetRoles);
    const titleFilters = contact.title ? [contact.title, ...buyerTitles].slice(0, 5) : buyerTitles;

    let hits: ApolloPersonHit[] = [];
    let mode: 'lookalike_person' | 'role_peers' = 'lookalike_person';

    if (seed?.apolloPersonId) {
      hits = await searchApolloPeople(
        {
          lookalikePersonIds: [seed.apolloPersonId],
          organizationLocations: locations,
          perPage: 10,
        },
        apolloKey
      );
      if (hits.length === 0 && locations) {
        hits = await searchApolloPeople(
          {
            lookalikePersonIds: [seed.apolloPersonId],
            perPage: 10,
          },
          apolloKey
        );
      }
    }

    if (hits.length === 0) {
      mode = 'role_peers';
      const tags = parseJsonArray(contact.signal.industryTags).slice(0, 5);
      hits = await searchApolloPeople(
        {
          personTitles: titleFilters.length > 0 ? titleFilters : undefined,
          ...(tags.length > 0 ? { organizationKeywordTags: tags } : {}),
          organizationLocations: locations,
          perPage: 10,
        },
        apolloKey
      );
    }

    const candidates = hits
      .filter((h) => h.id !== seed?.apolloPersonId && h.organizationName)
      .slice(0, 8)
      .map((h) => ({
        apolloPersonId: h.id,
        firstName: h.firstName,
        title: h.title,
        organizationName: h.organizationName,
        hasEmail: h.hasEmail,
      }));

    return c.json({
      success: true,
      mode,
      candidates,
    });
  } catch (err: any) {
    console.error('Error in GET /api/contacts/:id/similar:', err);
    return c.json({ success: false, error: err.message || 'Failed to find similar contacts.' }, 500);
  }
});

/**
 * POST /api/contacts/unlock-similar
 * Reveals a similar Apollo contact, adds them + their organization as an approved pipeline contact,
 * deducts 5 credits, and awards +25 XP + increments streak.
 */
contactsRouter.post('/unlock-similar', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const user = await getSessionUser(c);
    if (!user) return authenticationRequired(c);

    const body = (await c.req.json()) as {
      apolloPersonId?: string;
      sourceCompanyName?: string;
      sourceContactName?: string;
      parentSignalId?: string;
      campaignId?: string | null;
    };

    const apolloPersonId = (body.apolloPersonId || '').trim();
    if (!apolloPersonId) {
      return c.json({ success: false, error: 'apolloPersonId is required.' }, 400);
    }

    const UNLOCK_COST = 5;
    const XP_REWARD = 25;

    if (user.creditBalance < UNLOCK_COST) {
      return c.json(
        {
          success: false,
          error: `Insufficient credits. Need ${UNLOCK_COST} credits to unlock a similar contact.`,
        },
        402
      );
    }

    const apolloKey = c.env.APOLLO_API_KEY;
    if (!apolloKey) {
      return c.json({ success: false, error: 'APOLLO_API_KEY is not configured.' }, 500);
    }

    const revealed = await revealApolloPerson(apolloPersonId, apolloKey);
    if (!revealed) {
      return c.json({ success: false, error: 'Could not reveal contact details from Apollo.' }, 404);
    }

    const now = new Date().toISOString();
    const companyName = revealed.company || body.sourceCompanyName || 'Target Organization';
    const campaignId = body.campaignId || user.activeCampaignId || null;
    const newSignalId = `sig_lookalike_${crypto.randomUUID().slice(0, 12)}`;
    const newContactId = `ct_lookalike_${crypto.randomUUID().slice(0, 12)}`;
    const newDraftId = `dr_lookalike_${crypto.randomUUID().slice(0, 12)}`;
    const sourceRef = body.sourceCompanyName || body.sourceContactName || 'your pipeline';

    const bullets = [
      `Discovered via Apollo Lookalike chaining from ${sourceRef}.`,
      `Decision-maker: ${revealed.name} (${revealed.title || 'Executive'}) at ${companyName}.`,
      revealed.email
        ? `Verified direct email unlocked: ${revealed.email}.`
        : 'Profile unlocked with LinkedIn & company context.',
    ];

    await db.insert(schema.signals).values({
      id: newSignalId,
      userId: user.id,
      campaignId,
      parentSignalId: body.parentSignalId || null,
      title: `Lookalike account discovered from ${sourceRef}: ${companyName}`,
      sourceUrl: revealed.companyDomain ? `https://${revealed.companyDomain}` : '',
      publishedAt: now,
      summaryBullets: JSON.stringify(bullets),
      articleSummary: `${companyName} was surfaced as a lookalike opportunity from ${sourceRef}.`,
      companyName,
      signalType: 'Lookalike Discovery',
      industryTags: JSON.stringify([]),
      status: 'approved',
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.contacts).values({
      id: newContactId,
      signalId: newSignalId,
      name: revealed.name,
      title: revealed.title || 'Executive',
      email: revealed.email || null,
      linkedinUrl: revealed.linkedinUrl || null,
      avatarUrl: revealed.avatarUrl || null,
      company: companyName,
      companyDomain: revealed.companyDomain || null,
      source: 'lookalike',
      createdAt: now,
      updatedAt: now,
    });

    const draft = buildLookalikeOutreachDraft(user, revealed.name, companyName, body.sourceCompanyName);
    await db.insert(schema.outreachDrafts).values({
      id: newDraftId,
      signalId: newSignalId,
      contactId: newContactId,
      subject: draft.subject,
      body: draft.body,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });

    const newCredits = user.creditBalance - UNLOCK_COST;
    const newPoints = user.totalPoints + XP_REWARD;
    const newStreak = user.streakCount + 1;

    await db
      .update(schema.users)
      .set({
        creditBalance: newCredits,
        totalPoints: newPoints,
        streakCount: newStreak,
        updatedAt: now,
      })
      .where(eq(schema.users.id, user.id));

    await db.insert(schema.creditTransactions).values({
      id: `tx_${crypto.randomUUID().slice(0, 12)}`,
      userId: user.id,
      amount: -UNLOCK_COST,
      balanceAfter: newCredits,
      type: 'lookalike_unlock',
      referenceId: newContactId,
      description: `Unlocked lookalike contact ${revealed.name} at ${companyName} (+${XP_REWARD} XP)`,
      createdAt: now,
    });

    return c.json({
      success: true,
      pointsAwarded: XP_REWARD,
      totalPoints: newPoints,
      streakCount: newStreak,
      creditsRemaining: newCredits,
      contact: {
        id: newContactId,
        name: revealed.name,
        title: revealed.title || 'Executive',
        email: revealed.email || null,
        linkedinUrl: revealed.linkedinUrl || null,
        avatarUrl: revealed.avatarUrl || null,
        ghlContactId: null,
        createdAt: now,
        updatedAt: now,
        companyName,
        signalId: newSignalId,
        signalTitle: `Lookalike account discovered from ${sourceRef}: ${companyName}`,
        signalType: 'Lookalike Discovery',
        sourceUrl: revealed.companyDomain ? `https://${revealed.companyDomain}` : '',
        publishedAt: now,
        articleSummary: `${companyName} was surfaced as a lookalike opportunity from ${sourceRef}.`,
        summaryBullets: bullets,
        industryTags: [],
        signalStatus: 'approved',
        campaignId,
        campaignName: null,
        outreachDraft: {
          id: newDraftId,
          subject: draft.subject,
          body: draft.body,
          status: 'draft',
        },
      },
    });
  } catch (err: any) {
    console.error('Error in POST /api/contacts/unlock-similar:', err);
    return c.json({ success: false, error: err.message || 'Failed to unlock similar contact.' }, 500);
  }
});

/**
 * POST /api/contacts/:id/sync-crm
 * Manually pushes/re-syncs an individual contact and its note to the operator's CRM
 */
contactsRouter.post('/:id/sync-crm', async (c) => {
  const contactId = c.req.param('id');
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const currentUser = await getSessionUser(c);
    if (!currentUser) return authenticationRequired(c);

    const creds = await resolveUserGhlCredentials(db, currentUser, c.env);
    if (creds.authMethod === 'mock' || !creds.token || creds.token.length <= 10 || creds.token.includes('your_')) {
      return c.json(
        {
          success: false,
          crmNotConnected: true,
          error: 'GoHighLevel CRM connection required. Please connect your HighLevel account or configure your token in CRM Settings.',
        },
        400
      );
    }

    const contact = await db.query.contacts.findFirst({
      where: eq(schema.contacts.id, contactId),
      with: {
        signal: true,
        outreachDrafts: true,
      },
    });

    if (!contact || !contact.signal || contact.signal.userId !== currentUser.id) {
      return c.json({ success: false, error: `Contact "${contactId}" not found.` }, 404);
    }

    const sig = contact.signal;
    const nameParts = contact.name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Executive';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const email = contact.email || null;
    const companyName = sig?.companyName || 'Target Organization';

    const subaccountId = creds.locationId || currentUser.ghlSubaccountId || c.env?.GHL_LOCATION_ID || 'y3KLRBUZzf2t45o7rzp9';

    const ghlContact = await upsertContact(
      subaccountId,
      {
        firstName,
        lastName,
        email,
        companyName,
        sourceUrl: sig?.sourceUrl || '',
        signalTitle: sig?.title || '',
        tags: ['twinflow-signal', sig?.signalType || 'General'].filter(Boolean),
      },
      creds.token
    );

    if (!ghlContact.success) {
      return c.json(
        {
          success: false,
          error: ghlContact.error || 'Failed to push contact to CRM.',
        },
        400
      );
    }

    // Add note with intelligence and pitch
    const draft = contact.outreachDrafts?.[0];
    let bulletsFormatted = '';
    if (sig?.summaryBullets) {
      try {
        const bullets = JSON.parse(sig.summaryBullets) as string[];
        bulletsFormatted = bullets.map((b, i) => `${i + 1}. ${b}`).join('\n');
      } catch {
        bulletsFormatted = sig.summaryBullets;
      }
    }

    const finalSubject = draft?.subject || `Re: ${sig?.title || companyName}`;
    const finalBody = draft?.body || '';

    const noteContent = `🎯 TWINFLOW SIGNAL INTELLIGENCE
Headline: ${sig?.title || ''}
Signal Type: ${sig?.signalType || ''}
Source: ${sig?.sourceUrl || ''}

KEY REASONS TO REACH OUT:
${bulletsFormatted}

----------------------------------------
GENERATED OUTREACH PITCH:
Subject: ${finalSubject}

${finalBody}`;

    await createNote(subaccountId, ghlContact.id, noteContent, creds.token);

    // Update contacts table with ghl_contact_id
    const now = new Date().toISOString();
    await db
      .update(schema.contacts)
      .set({ ghlContactId: ghlContact.id, updatedAt: now })
      .where(eq(schema.contacts.id, contact.id));

    return c.json({
      success: true,
      ghlContactId: ghlContact.id,
      message: 'Contact and signal dossier successfully synchronized with CRM.',
    });
  } catch (err: any) {
    console.error('Error in POST /api/contacts/:id/sync-crm:', err);
    return c.json({ success: false, error: err.message || 'Failed to sync contact to CRM.' }, 500);
  }
});

/**
 * DELETE /api/contacts/:id
 * Removes a contact from the user's pipeline
 */
contactsRouter.delete('/:id', async (c) => {
  const contactId = c.req.param('id');
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const currentUser = await getSessionUser(c);
    if (!currentUser) return authenticationRequired(c);

    const existing = await db.query.contacts.findFirst({
      where: eq(schema.contacts.id, contactId),
      with: { signal: true },
    });

    if (!existing || !existing.signal || existing.signal.userId !== currentUser.id) {
      return c.json({ success: false, error: 'Contact not found.' }, 404);
    }

    await db.delete(schema.contacts).where(eq(schema.contacts.id, contactId));

    return c.json({ success: true, message: 'Contact successfully removed from pipeline.' });
  } catch (err: any) {
    console.error('Error in DELETE /api/contacts/:id:', err);
    return c.json({ success: false, error: err.message || 'Failed to delete contact.' }, 500);
  }
});

/**
 * PATCH /api/contacts/drafts/:draftId
 * Updates subject/body/status of an outreach draft owned by the current user.
 */
contactsRouter.patch('/drafts/:draftId', async (c) => {
  const draftId = c.req.param('draftId');
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const currentUser = await getSessionUser(c);
    if (!currentUser) return authenticationRequired(c);

    const draft = await db.query.outreachDrafts.findFirst({
      where: eq(schema.outreachDrafts.id, draftId),
      with: { signal: true },
    });

    if (!draft || !draft.signal || draft.signal.userId !== currentUser.id) {
      return c.json({ success: false, error: 'Outreach draft not found.' }, 404);
    }

    const body = (await c.req.json()) as {
      subject?: string;
      body?: string;
      status?: 'draft' | 'queued' | 'sent';
    };

    const now = new Date().toISOString();
    const updates: Partial<typeof schema.outreachDrafts.$inferInsert> = {
      updatedAt: now,
    };

    if (typeof body.subject === 'string' && body.subject.trim()) {
      updates.subject = body.subject.trim();
    }
    if (typeof body.body === 'string' && body.body.trim()) {
      updates.body = body.body.trim();
    }
    if (body.status === 'draft' || body.status === 'queued' || body.status === 'sent') {
      updates.status = body.status;
    }

    await db
      .update(schema.outreachDrafts)
      .set(updates)
      .where(eq(schema.outreachDrafts.id, draftId));

    return c.json({
      success: true,
      draft: {
        id: draft.id,
        subject: updates.subject ?? draft.subject,
        body: updates.body ?? draft.body,
        status: updates.status ?? draft.status,
        updatedAt: now,
      },
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/contacts/drafts/:draftId:', err);
    return c.json({ success: false, error: err.message || 'Failed to update outreach draft.' }, 500);
  }
});

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  const parsed = safeParseJson<unknown>(raw, []);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
}

function serializeBriefRow(row: typeof schema.researchBriefs.$inferSelect) {
  return {
    id: row.id,
    organizationName: row.organizationName,
    companyDomain: row.companyDomain,
    signalId: row.signalId,
    briefTitle: row.briefTitle,
    verifiedFacts: safeParseJson(row.verifiedFacts, []),
    inferredOpportunities: safeParseJson(row.inferredOpportunities, []),
    investigationQuestions: safeParseJson(row.investigationQuestions, []),
    verificationLog: safeParseJson(row.verificationLog, null),
    createdAt: row.createdAt,
  };
}

/**
 * GET /api/contacts/organization/brief?orgName=...
 * Returns the latest existing Research Brief for the authenticated user and organization.
 */
contactsRouter.get('/organization/brief', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const user = await getSessionUser(c);
    if (!user) return authenticationRequired(c);

    const orgName = (c.req.query('orgName') || '').trim();
    if (!orgName) {
      return c.json({ success: false, error: 'orgName query parameter is required.' }, 400);
    }

    const row = await db.query.researchBriefs.findFirst({
      where: and(
        eq(schema.researchBriefs.userId, user.id),
        eq(schema.researchBriefs.organizationName, orgName)
      ),
      orderBy: [desc(schema.researchBriefs.createdAt)],
    });

    return c.json({
      success: true,
      brief: row ? serializeBriefRow(row) : null,
    });
  } catch (err: any) {
    console.error('Error in GET /api/contacts/organization/brief:', err);
    return c.json({ success: false, error: err.message || 'Failed to load research brief.' }, 500);
  }
});

/**
 * POST /api/contacts/organization/brief
 * Credit-gated (10 credits) generator for an evidence-verified Research Brief (+15 XP).
 */
contactsRouter.post('/organization/brief', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const user = await getSessionUser(c);
    if (!user) return authenticationRequired(c);

    const body = (await c.req.json().catch(() => ({}))) as {
      organizationName?: string;
      companyDomain?: string | null;
      signalId?: string | null;
    };

    const organizationName = (body.organizationName || '').trim();
    if (!organizationName) {
      return c.json({ success: false, error: 'organizationName is required.' }, 400);
    }

    if (user.creditBalance < RESEARCH_BRIEF_CREDIT_COST) {
      return c.json(
        {
          success: false,
          error: `Insufficient credits. ${RESEARCH_BRIEF_CREDIT_COST} credits required to generate a Research Brief.`,
          creditBalance: user.creditBalance,
        },
        402
      );
    }

    // Load the target signal (owned by this user) and infer companyDomain if not supplied
    let targetSignal: typeof schema.signals.$inferSelect | undefined;
    if (body.signalId) {
      targetSignal = await db.query.signals.findFirst({
        where: and(eq(schema.signals.id, body.signalId), eq(schema.signals.userId, user.id)),
      });
    }
    if (!targetSignal) {
      targetSignal = await db.query.signals.findFirst({
        where: and(
          eq(schema.signals.userId, user.id),
          eq(schema.signals.companyName, organizationName)
        ),
        orderBy: [desc(schema.signals.updatedAt)],
      });
    }

    let resolvedDomain = (body.companyDomain || '').trim() || null;
    if (!resolvedDomain && targetSignal) {
      const orgContact = await db.query.contacts.findFirst({
        where: eq(schema.contacts.signalId, targetSignal.id),
      });
      if (orgContact?.companyDomain) {
        resolvedDomain = orgContact.companyDomain;
      }
    }

    const activeCampaign = user.activeCampaignId
      ? await db.query.campaigns.findFirst({
          where: and(eq(schema.campaigns.id, user.activeCampaignId), eq(schema.campaigns.userId, user.id)),
        })
      : undefined;

    const generated = await generateVerifiedResearchBrief({
      signal: targetSignal || null,
      organizationName,
      companyDomain: resolvedDomain,
      sellerProfile: {
        organization: activeCampaign?.legalBusinessName || user.organization || user.legalBusinessName,
        companyDescription: activeCampaign?.companyDescription || user.companyDescription,
        valueProp: activeCampaign?.valueProp || user.valueProp,
        userMission: activeCampaign?.userMission || user.userMission,
        servicesOffered: parseJsonStringArray(activeCampaign?.servicesOffered || user.servicesOffered),
        productsOffered: parseJsonStringArray(activeCampaign?.productsOffered || user.productsOffered),
        targetIndustries: parseJsonStringArray(activeCampaign?.targetIndustries || user.targetIndustries),
        targetRoles: parseJsonStringArray(activeCampaign?.targetRoles || user.targetRoles),
        userIntent: activeCampaign?.userIntent || user.userIntent,
      },
      env: c.env,
    });

    const now = new Date().toISOString();
    const freshUser = await db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
    });
    const currentCredits = freshUser?.creditBalance ?? user.creditBalance;
    if (currentCredits < RESEARCH_BRIEF_CREDIT_COST) {
      return c.json(
        {
          success: false,
          error: `Insufficient credits. ${RESEARCH_BRIEF_CREDIT_COST} credits required to generate a Research Brief.`,
          creditBalance: currentCredits,
        },
        402
      );
    }

    const newBalance = currentCredits - RESEARCH_BRIEF_CREDIT_COST;
    const newTotalPoints = (freshUser?.totalPoints ?? user.totalPoints) + RESEARCH_BRIEF_XP_AWARD;
    const briefId = `rb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await db
      .update(schema.users)
      .set({
        creditBalance: newBalance,
        totalPoints: newTotalPoints,
        updatedAt: now,
      })
      .where(eq(schema.users.id, user.id));

    await db.insert(schema.creditTransactions).values({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      amount: -RESEARCH_BRIEF_CREDIT_COST,
      balanceAfter: newBalance,
      type: 'research_brief',
      referenceId: briefId,
      description: `Generated verified Research Brief for ${organizationName} (+${RESEARCH_BRIEF_XP_AWARD} XP)`,
      createdAt: now,
    });

    const briefRow: typeof schema.researchBriefs.$inferInsert = {
      id: briefId,
      userId: user.id,
      organizationName,
      companyDomain: resolvedDomain,
      signalId: targetSignal?.id || null,
      briefTitle: generated.briefTitle,
      verifiedFacts: JSON.stringify(generated.verifiedFacts),
      inferredOpportunities: JSON.stringify(generated.inferredOpportunities),
      investigationQuestions: JSON.stringify(generated.investigationQuestions),
      verificationLog: JSON.stringify(generated.verificationLog),
      createdAt: now,
    };

    await db.insert(schema.researchBriefs).values(briefRow);

    return c.json({
      success: true,
      brief: serializeBriefRow(briefRow as typeof schema.researchBriefs.$inferSelect),
      creditBalance: newBalance,
      totalPoints: newTotalPoints,
    });
  } catch (err: any) {
    console.error('Error in POST /api/contacts/organization/brief:', err);
    return c.json({ success: false, error: err.message || 'Failed to generate research brief.' }, 500);
  }
});

/**
 * POST /api/contacts/organization/brief/save-crm
 * Pushes a generated Research Brief as a note to GoHighLevel on the organization's contact.
 */
contactsRouter.post('/organization/brief/save-crm', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const currentUser = await getSessionUser(c);
    if (!currentUser) return authenticationRequired(c);

    const creds = await resolveUserGhlCredentials(db, currentUser, c.env);
    if (creds.authMethod === 'mock' || !creds.token || creds.token.length <= 10 || creds.token.includes('your_')) {
      return c.json(
        {
          success: false,
          crmNotConnected: true,
          error: 'GoHighLevel CRM connection required. Please connect your HighLevel account in CRM Settings.',
        },
        400
      );
    }

    const body = (await c.req.json().catch(() => ({}))) as {
      organizationName?: string;
      briefId?: string;
    };
    const organizationName = (body.organizationName || '').trim();
    if (!organizationName) {
      return c.json({ success: false, error: 'organizationName is required.' }, 400);
    }

    const briefRow = body.briefId
      ? await db.query.researchBriefs.findFirst({
          where: and(eq(schema.researchBriefs.id, body.briefId), eq(schema.researchBriefs.userId, currentUser.id)),
        })
      : await db.query.researchBriefs.findFirst({
          where: and(
            eq(schema.researchBriefs.userId, currentUser.id),
            eq(schema.researchBriefs.organizationName, organizationName)
          ),
          orderBy: [desc(schema.researchBriefs.createdAt)],
        });

    if (!briefRow) {
      return c.json({ success: false, error: 'Research Brief not found for this organization.' }, 404);
    }

    const orgSignals = await db.query.signals.findMany({
      where: and(
        eq(schema.signals.userId, currentUser.id),
        eq(schema.signals.companyName, organizationName)
      ),
      with: { contacts: true },
    });

    const orgContacts = orgSignals.flatMap((s) => s.contacts || []);
    const primaryContact = orgContacts.find((ct) => Boolean(ct.ghlContactId)) || orgContacts[0];

    if (!primaryContact) {
      return c.json(
        { success: false, error: `No contacts found for ${organizationName} to attach CRM note.` },
        404
      );
    }

    const subaccountId =
      creds.locationId || currentUser.ghlSubaccountId || c.env?.GHL_LOCATION_ID || 'y3KLRBUZzf2t45o7rzp9';

    let ghlContactId = primaryContact.ghlContactId;
    if (!ghlContactId) {
      const nameParts = primaryContact.name.trim().split(/\s+/);
      const upserted = await upsertContact(
        subaccountId,
        {
          firstName: nameParts[0] || 'Executive',
          lastName: nameParts.slice(1).join(' '),
          email: primaryContact.email || null,
          companyName: organizationName,
          tags: ['twinflow-research-brief'],
        },
        creds.token
      );
      if (!upserted.success) {
        return c.json({ success: false, error: upserted.error || 'Failed to sync contact to CRM.' }, 400);
      }
      ghlContactId = upserted.id;
      await db
        .update(schema.contacts)
        .set({ ghlContactId, updatedAt: new Date().toISOString() })
        .where(eq(schema.contacts.id, primaryContact.id));
    }

    const brief = serializeBriefRow(briefRow);
    const factsText = (brief.verifiedFacts as Array<{ statement: string; sourceLabel: string; sourceDate: string }>)
      .map((f, i) => `${i + 1}. ${f.statement} (${f.sourceLabel}, ${f.sourceDate})`)
      .join('\n');
    const oppsText = (brief.inferredOpportunities as Array<{ area: string; rationale: string; confidence: string }>)
      .map((o, i) => `${i + 1}. [${o.confidence.toUpperCase()}] ${o.area}: ${o.rationale}`)
      .join('\n');
    const questionsText = (brief.investigationQuestions as string[])
      .map((q, i) => `${i + 1}. ${q}`)
      .join('\n');

    const noteContent = `📋 ${brief.briefTitle}
Generated: ${brief.createdAt.slice(0, 10)}

VERIFIED FACTS:
${factsText || 'None recorded.'}

ANALYTICAL ASSESSMENT — STRATEGIC OPPORTUNITIES:
${oppsText || 'None recorded.'}

QUESTIONS WORTH INVESTIGATING:
${questionsText || 'None recorded.'}`;

    const noteResult = await createNote(subaccountId, ghlContactId, noteContent, creds.token);
    if (!noteResult.success) {
      return c.json({ success: false, error: noteResult.error || 'Failed to save note to CRM.' }, 400);
    }

    return c.json({
      success: true,
      ghlContactId,
      message: 'Research Brief saved to GoHighLevel CRM Notes.',
    });
  } catch (err: any) {
    console.error('Error in POST /api/contacts/organization/brief/save-crm:', err);
    return c.json({ success: false, error: err.message || 'Failed to save Research Brief to CRM.' }, 500);
  }
});

