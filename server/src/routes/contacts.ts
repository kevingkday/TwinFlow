import { Hono } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { eq, desc, and } from 'drizzle-orm';
import { getSessionUser } from './auth';
import { upsertContact, createNote } from '../services/ghl';

export const contactsRouter = new Hono<{ Bindings: Bindings }>();

// Helper to get authenticated session user or fallback to first user
async function getUser(c: any, db: ReturnType<typeof getDb>): Promise<typeof schema.users.$inferSelect> {
  const sessionUser = await getSessionUser(c);
  if (sessionUser) return sessionUser;
  const existing = await db.query.users.findFirst();
  if (existing) return existing;
  throw new Error('No user found');
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
    const user = await getUser(c, db);

    const targetCampaignId = c.req.query('campaignId');
    const requestedStatus = c.req.query('status') || 'approved';
    const searchQuery = (c.req.query('q') || '').toLowerCase().trim();

    // Build conditions for signals query
    const conditions: any[] = [];
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
    const currentUser = await getUser(c, db);

    const userCrmKey = currentUser.ghlApiKey;
    if (!userCrmKey || userCrmKey.length <= 10 || userCrmKey.includes('your_')) {
      return c.json(
        {
          success: false,
          crmNotConnected: true,
          error: 'CRM Private Integration Token required. Please configure your token in CRM Settings.',
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

    if (!contact) {
      return c.json({ success: false, error: `Contact "${contactId}" not found.` }, 404);
    }

    const sig = contact.signal;
    const nameParts = contact.name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Executive';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const email = contact.email || null;
    const companyName = sig?.companyName || 'Target Organization';

    const subaccountId = currentUser.ghlSubaccountId || c.env?.GHL_LOCATION_ID || 'y3KLRBUZzf2t45o7rzp9';

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
      userCrmKey
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

    await createNote(subaccountId, ghlContact.id, noteContent, userCrmKey);

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
    await getUser(c, db);

    const existing = await db.query.contacts.findFirst({
      where: eq(schema.contacts.id, contactId),
    });

    if (!existing) {
      return c.json({ success: false, error: 'Contact not found.' }, 404);
    }

    await db.delete(schema.contacts).where(eq(schema.contacts.id, contactId));

    return c.json({ success: true, message: 'Contact successfully removed from pipeline.' });
  } catch (err: any) {
    console.error('Error in DELETE /api/contacts/:id:', err);
    return c.json({ success: false, error: err.message || 'Failed to delete contact.' }, 500);
  }
});

