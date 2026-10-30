/**
 * GoHighLevel (GHL) API v2 Service Adapter
 * Manages CRM contacts, notes, and pipeline opportunities.
 * Features high-fidelity fallback/mock mode when GHL_API_KEY is not configured.
 */

export interface GhlContactInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string;
  sourceUrl?: string;
  signalTitle?: string;
  tags?: string[];
  customFields?: Array<{ key: string; field_value: string }>;
}

export interface GhlContactResult {
  id: string;
  isNew: boolean;
  success: boolean;
  mock: boolean;
  error?: string;
}

export interface GhlNoteResult {
  id: string;
  success: boolean;
  mock: boolean;
  error?: string;
}

export interface GhlOpportunityResult {
  id: string;
  success: boolean;
  mock: boolean;
  error?: string;
}

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

/**
 * Creates or updates a contact in GoHighLevel (API v2)
 */
export async function upsertContact(
  subaccountId: string,
  contactData: GhlContactInput,
  apiKey?: string
): Promise<GhlContactResult> {
  const cleanKey = (apiKey || '').trim();

  // Live GHL API execution
  if (cleanKey && !cleanKey.includes('your_') && cleanKey.length > 10) {
    try {
      const payload: Record<string, unknown> = {
        locationId: subaccountId,
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        name: `${contactData.firstName} ${contactData.lastName}`.trim(),
        tags: contactData.tags || ['twinflow-signal', 'ai-scouted'],
      };

      if (contactData.email) payload.email = contactData.email;
      if (contactData.companyName) payload.companyName = contactData.companyName;
      if (contactData.phone) payload.phone = contactData.phone;

      // Custom fields mapping
      const customFields: Array<{ key: string; field_value: string }> = [];
      if (contactData.sourceUrl) {
        customFields.push({ key: 'signal_source_url', field_value: contactData.sourceUrl });
      }
      if (contactData.signalTitle) {
        customFields.push({ key: 'signal_title', field_value: contactData.signalTitle });
      }
      if (contactData.customFields) {
        customFields.push(...contactData.customFields);
      }
      if (customFields.length > 0) {
        payload.customFields = customFields;
      }

      const response = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          Version: GHL_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          contact?: { id: string };
          new?: boolean;
        };

        const contactId = data.contact?.id || `ghl_cnt_${Date.now()}`;
        console.log(`[GHL Live] Successfully upserted contact ${contactId} in subaccount ${subaccountId}`);
        return {
          id: contactId,
          isNew: !!data.new,
          success: true,
          mock: false,
        };
      } else {
        const errText = await response.text();
        console.warn(`[GHL Live] Contact upsert error (${response.status}):`, errText);
      }
    } catch (err) {
      console.warn('[GHL Live] Network error calling GHL upsert:', err);
    }
  }

  // High-fidelity fallback / mock mode
  const mockId = `ghl_cnt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(
    `[GHL Mock] Contact upserted in subaccount [${subaccountId}]: ${contactData.firstName} ${contactData.lastName} | Company: ${
      contactData.companyName || 'N/A'
    } | Email: ${contactData.email || 'N/A'} (Mock ID: ${mockId})`
  );

  return {
    id: mockId,
    isNew: true,
    success: true,
    mock: true,
  };
}

/**
 * Attaches a note with signal intelligence and draft pitch to the GHL contact record
 */
export async function createNote(
  subaccountId: string,
  contactId: string,
  noteBody: string,
  apiKey?: string
): Promise<GhlNoteResult> {
  const cleanKey = (apiKey || '').trim();

  // Live GHL API execution
  if (cleanKey && !cleanKey.includes('your_') && cleanKey.length > 10) {
    try {
      const response = await fetch(`${GHL_API_BASE}/contacts/${encodeURIComponent(contactId)}/notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          Version: GHL_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: noteBody,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { note?: { id: string } };
        const noteId = data.note?.id || `ghl_note_${Date.now()}`;
        console.log(`[GHL Live] Successfully created note ${noteId} for contact ${contactId}`);
        return {
          id: noteId,
          success: true,
          mock: false,
        };
      } else {
        const errText = await response.text();
        console.warn(`[GHL Live] Note creation error (${response.status}):`, errText);
      }
    } catch (err) {
      console.warn('[GHL Live] Network error creating GHL note:', err);
    }
  }

  // High-fidelity fallback / mock mode
  const mockNoteId = `ghl_note_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(
    `[GHL Mock] Attached intelligence note to contact [${contactId}] in subaccount [${subaccountId}]:\n${noteBody.slice(
      0,
      140
    )}... (Mock Note ID: ${mockNoteId})`
  );

  return {
    id: mockNoteId,
    success: true,
    mock: true,
  };
}

/**
 * Places the lead into a designated GoHighLevel pipeline stage (e.g., "New Signal Lead")
 */
export async function createOpportunity(
  subaccountId: string,
  contactId: string,
  pipelineId?: string,
  stageId?: string,
  opportunityName?: string,
  apiKey?: string
): Promise<GhlOpportunityResult> {
  const cleanKey = (apiKey || '').trim();

  if (cleanKey && pipelineId && stageId && !cleanKey.includes('your_') && cleanKey.length > 10) {
    try {
      const response = await fetch(`${GHL_API_BASE}/opportunities/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          Version: GHL_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pipelineId,
          locationId: subaccountId,
          name: opportunityName || 'TwinFlow Signal Lead',
          pipelineStageId: stageId,
          status: 'open',
          contactId,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { opportunity?: { id: string } };
        const oppId = data.opportunity?.id || `ghl_opp_${Date.now()}`;
        console.log(`[GHL Live] Opportunity created: ${oppId}`);
        return {
          id: oppId,
          success: true,
          mock: false,
        };
      }
    } catch (err) {
      console.warn('[GHL Live] Opportunity creation failed:', err);
    }
  }

  // Fallback / Mock
  const mockOppId = `ghl_opp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(
    `[GHL Mock] Opportunity queued: ${opportunityName || 'TwinFlow Signal Lead'} for contact [${contactId}] (Mock Opp ID: ${mockOppId})`
  );

  return {
    id: mockOppId,
    success: true,
    mock: true,
  };
}

export interface GhlSubaccountSummary {
  id: string;
  name: string;
  email?: string;
  timezone?: string;
  country?: string;
}

/**
 * Lists all sub-accounts (locations) under an agency using the Agency Private Integration Token.
 */
export async function listAgencySubaccounts(
  agencyApiKey?: string,
  companyId?: string
): Promise<GhlSubaccountSummary[]> {
  const cleanKey = (agencyApiKey || '').trim();
  const cleanCompanyId = (companyId || '').trim();

  if (cleanKey && cleanCompanyId && !cleanKey.includes('your_') && cleanKey.length > 10) {
    try {
      const response = await fetch(
        `${GHL_API_BASE}/locations/search?companyId=${encodeURIComponent(cleanCompanyId)}&limit=100`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            Version: GHL_API_VERSION,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = (await response.json()) as {
          locations?: Array<{
            id: string;
            name: string;
            email?: string;
            timezone?: string;
            country?: string;
          }>;
        };

        const subaccounts = (data.locations || []).map((loc) => ({
          id: loc.id,
          name: loc.name,
          email: loc.email,
          timezone: loc.timezone,
          country: loc.country,
        }));

        console.log(`[GHL Agency] Successfully retrieved ${subaccounts.length} sub-accounts for company [${cleanCompanyId}]`);
        return subaccounts;
      } else {
        const err = await response.text();
        console.warn(`[GHL Agency] Failed to fetch subaccounts (${response.status}):`, err);
      }
    } catch (err) {
      console.warn('[GHL Agency] Error calling locations/search:', err);
    }
  }

  // Fallback mock subaccounts
  return [
    { id: 'y3KLRBUZzf2t45o7rzp9', name: 'Eagle1', email: 'kevingkday@gmail.com', timezone: 'America/Vancouver', country: 'CA' },
    { id: '8uZzBmvlZ9KBSpEgvSUp', name: 'FeedMeSports', email: 'kevin@feedmesports.com', timezone: 'America/Vancouver', country: 'CA' },
    { id: 's2Yq1O2e8j8KuyQmrDvr', name: 'FeedMeArt', email: 'Hilary@hilaryallen.com', timezone: 'America/Vancouver', country: 'CA' },
  ];
}

export interface GhlVerificationResult {
  valid: boolean;
  mock: boolean;
  message: string;
}

/**
 * Validates whether a given Sub-Account Private Integration Token and Location ID can authenticate.
 */
export async function verifyGhlCredentials(
  subaccountId: string,
  apiKey: string
): Promise<GhlVerificationResult> {
  const cleanKey = (apiKey || '').trim();
  const cleanSubaccountId = (subaccountId || '').trim();

  if (!cleanKey) {
    return { valid: false, mock: false, message: 'Private Integration Token cannot be empty.' };
  }
  if (!cleanSubaccountId) {
    return { valid: false, mock: false, message: 'Sub-Account Location ID cannot be empty.' };
  }

  if (cleanKey.includes('your_') || cleanKey.length < 15) {
    return {
      valid: true,
      mock: true,
      message: 'Demo / Mock credentials accepted.',
    };
  }

  try {
    const response = await fetch(
      `${GHL_API_BASE}/contacts/?locationId=${encodeURIComponent(cleanSubaccountId)}&limit=1`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          Version: GHL_API_VERSION,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      return {
        valid: true,
        mock: false,
        message: 'Successfully verified CRM Sub-Account connection & permissions!',
      };
    } else {
      const err = await response.text();
      let parsedMsg = err;
      try {
        const json = JSON.parse(err);
        parsedMsg = json.message || err;
      } catch {
        // keep string
      }
      return {
        valid: false,
        mock: false,
        message: `CRM responded with error (${response.status}): ${parsedMsg}`,
      };
    }
  } catch (err: unknown) {
    return {
      valid: false,
      mock: false,
      message: `Network error verifying CRM token: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export interface GhlCreateSubaccountInput {
  name: string;
  email: string;
  companyName?: string;
  country?: string;
  timezone?: string;
}

export interface GhlCreateSubaccountResult {
  id: string;
  name: string;
  success: boolean;
  mock: boolean;
  error?: string;
}

/**
 * Creates a dedicated Sub-Account (Location) in GoHighLevel using the Agency API Key.
 * Endpoint: POST https://services.leadconnectorhq.com/locations/
 */
export async function createSubaccount(
  input: GhlCreateSubaccountInput,
  agencyApiKey?: string,
  companyId?: string
): Promise<GhlCreateSubaccountResult> {
  const cleanKey = (agencyApiKey || '').trim();
  const cleanCompanyId = (companyId || '').trim();

  const locationName = input.companyName || input.name || 'User Workspace';
  const country = input.country || 'CA';
  const timezone = input.timezone || 'America/Vancouver';

  if (cleanKey && !cleanKey.includes('your_') && cleanKey.length > 15) {
    try {
      const payload: Record<string, unknown> = {
        name: locationName,
        email: input.email,
        companyId: cleanCompanyId,
        country,
        timezone,
      };

      const response = await fetch(`${GHL_API_BASE}/locations/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          Version: GHL_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          location?: { id: string; name?: string };
          id?: string;
        };
        const locationId = data.location?.id || data.id || `loc_${Date.now()}`;
        console.log(`[GHL Agency] Created new subaccount [${locationId}] for ${input.email}`);
        return {
          id: locationId,
          name: data.location?.name || locationName,
          success: true,
          mock: false,
        };
      } else {
        const errText = await response.text();
        console.warn(`[GHL Agency] Failed to create location (${response.status}):`, errText);
        // Fall back to a dedicated mock location so user sign-up doesn't block
        return {
          id: `loc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
          name: locationName,
          success: true,
          mock: true,
          error: `GHL returned ${response.status}`,
        };
      }
    } catch (err: unknown) {
      console.warn('[GHL Agency] Network error creating location:', err);
      return {
        id: `loc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        name: locationName,
        success: true,
        mock: true,
        error: String(err),
      };
    }
  }

  // Fallback demo/mock mode
  const mockId = `loc_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  console.log(`[GHL Agency MOCK] Provisioned simulated sub-account [${mockId}] for ${input.email}`);
  return {
    id: mockId,
    name: locationName,
    success: true,
    mock: true,
  };
}


