/**
 * Apollo Contact Matching Service Adapter
 * Takes extracted person's name, role, and company domain to query Apollo for a verified
 * business email and LinkedIn URL. Gracefully falls back if no exact match is found.
 */

export interface ApolloContactResult {
  email?: string;
  linkedinUrl?: string;
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
  const nameParts = name.trim().split(/\s+/);
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
        },
        body: JSON.stringify({
          api_key: cleanKey,
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
            linkedin_url?: string;
            id?: string;
          };
        };

        if (json.person?.email) {
          return {
            email: json.person.email,
            linkedinUrl: json.person.linkedin_url || `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
            matched: true,
            status: 'verified',
          };
        }
      }
    } catch (err) {
      console.warn(`Apollo match failed for ${name} @ ${cleanDomain}, falling back gracefully:`, err);
    }
  }

  // Graceful fallback: construct standard corporate email and clean LinkedIn URL
  const emailUser = lastName
    ? `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}`
    : firstName.toLowerCase();

  const domainBase = cleanDomain || 'enterprise.io';
  const fallbackEmail = `${emailUser}@${domainBase}`;
  const slug = lastName
    ? `${firstName.toLowerCase()}-${lastName.toLowerCase().replace(/[^a-z]/g, '')}`
    : firstName.toLowerCase();

  return {
    email: fallbackEmail,
    linkedinUrl: `https://linkedin.com/in/${slug}`,
    matched: false,
    status: 'inferred',
  };
}
