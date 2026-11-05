import { isVerifiedEmailStatus } from './signalQuality';

/**
 * Apollo Contact Matching Service Adapter
 * Takes extracted person's name, role, and company domain to query Apollo for a verified
 * business email and LinkedIn URL. Gracefully falls back if no exact match is found.
 */

export interface ApolloContactResult {
  email?: string;
  linkedinUrl?: string;
  avatarUrl?: string;
  matched: boolean;
  status: 'verified' | 'inferred' | 'fallback';
}

export async function findApolloContact(
  name: string,
  role: string,
  companyDomain: string,
  apiKey?: string
): Promise<ApolloContactResult> {
  const cleanKey = (apiKey || '').trim();
  
  // Clean honorifics / titles from name so search and fallback email are clean
  const cleanFullName = name.replace(/^(dr|mr|mrs|ms|prof|hon)\.?\s+/i, '').trim() || name.trim();
  const nameParts = cleanFullName.split(/\s+/);
  const firstName = nameParts[0] || 'Executive';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  const cleanDomain = companyDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  // If live Apollo key is supplied, query Apollo People Match endpoint
  if (cleanKey && !cleanKey.includes('your_') && cleanKey.length > 10) {
    try {
      const response = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': cleanKey,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          domain: cleanDomain,
          title: role,
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          person?: {
            email?: string;
            email_status?: string;
            linkedin_url?: string;
            photo_url?: string;
            id?: string;
          };
        };

        let avatarUrl: string | undefined;
        if (json.person?.photo_url) {
          const p = json.person.photo_url.trim();
          // Filter out LinkedIn / social default silhouette placeholder SVGs
          const isPlaceholder =
            p.includes('licdn.com/aero-v1/sc/h/') ||
            p.includes('ghost_person') ||
            p.includes('default-avatar') ||
            p.includes('static.licdn.com');
          if (!isPlaceholder && p.startsWith('http')) {
            avatarUrl = p;
          }
        }

        if (json.person?.email && isVerifiedEmailStatus(json.person.email_status)) {
          return {
            email: json.person.email,
            linkedinUrl: json.person.linkedin_url,
            avatarUrl,
            matched: true,
            status: 'verified',
          };
        }
      }
    } catch (err) {
      console.warn(`Apollo match failed for ${name} @ ${cleanDomain}, falling back gracefully:`, err);
    }
  }

  // Do not invent an email or LinkedIn URL. A guessed address is not a reachable contact.
  return {
    matched: false,
    status: 'fallback',
  };
}
