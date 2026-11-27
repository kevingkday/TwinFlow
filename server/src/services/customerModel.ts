export interface CustomerModelInput {
  location?: string;
  userIntent?: string;
  userMission?: string;
  companyDescription?: string;
  valueProp?: string;
  servicesOffered?: string[];
  productsOffered?: string[];
  targetIndustries?: string[];
  targetTriggers?: string[];
  buyerIndustries?: string[];
  buyerCompanySize?: string;
  serviceArea?: 'local' | 'national';
}

export interface CustomerModel {
  idealCustomerTypes: string[];
  customerSize: string;
  buyingSignals: string[];
  serviceArea: 'local' | 'national';
}

function cleanList(items: unknown, max = 8): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function buildFallbackCustomerModel(input: CustomerModelInput): CustomerModel {
  const fromProfile = cleanList([...(input.buyerIndustries || []), ...(input.targetIndustries || [])], 6);
  const idealCustomerTypes = fromProfile.length > 0 ? fromProfile : ['local businesses', 'commercial companies'];

  const fromTriggers = cleanList(input.targetTriggers || [], 6);
  const buyingSignals =
    fromTriggers.length > 0
      ? fromTriggers
      : ['expansion', 'new location', 'hiring', 'contract', 'opening'];

  const sizeMap: Record<string, string> = {
    smb: 'small and mid-sized businesses',
    midmarket: 'mid-market businesses',
    enterprise: 'enterprise organizations',
    any: 'businesses of any size',
  };
  const customerSize = sizeMap[input.buyerCompanySize || ''] || 'small and mid-sized businesses';
  const serviceArea: 'local' | 'national' =
    input.serviceArea === 'national' || /national|nationwide|anywhere|global/i.test(input.location || '')
      ? 'national'
      : 'local';

  return {
    idealCustomerTypes,
    customerSize,
    buyingSignals,
    serviceArea,
  };
}

/**
 * Derive a structured CustomerModel once per campaign using gpt-4.1-mini
 * (falling back to gpt-4o-mini, then generic profile parsing).
 */
export async function generateCustomerModel(
  input: CustomerModelInput,
  openAiApiKey?: string
): Promise<CustomerModel> {
  const fallback = buildFallbackCustomerModel(input);
  const cleanKey = (openAiApiKey || '').trim();
  if (!cleanKey || !cleanKey.startsWith('sk-') || cleanKey.includes('your_')) {
    return fallback;
  }

  const systemPrompt = `You build a structured B2B Customer Model from a seller's profile.
Given what the business sells, who they sell to, and where they operate, output JSON only:
{
  "idealCustomerTypes": ["3 to 6 short, concrete types of businesses that buy this offering"],
  "customerSize": "e.g. small and mid-sized local businesses, mid-market companies, or enterprise",
  "buyingSignals": ["4 to 6 ordinary, observable business events/news signals showing a reason to buy now"],
  "serviceArea": "local" | "national"
}
Rules:
- idealCustomerTypes are the BUYERS (e.g. for a bakery supplier: cafes, restaurants, grocery stores, hotels; for a commercial cleaner: offices, medical clinics, warehouses, retail stores). Never list competitors/vendors of the seller's own offering.
- buyingSignals must be ordinary 1-3 word events likely to appear in news (e.g. "opens new location", "expansion", "renovation", "hiring", "new contract", "funding", "acquires").
- serviceArea is "local" for physical, licensed, or regional businesses, and "national" for software/SaaS/remote-only agencies.`;

  const userPrompt = `What they sell: ${(input.servicesOffered || []).join(', ') || input.userMission || input.valueProp || 'B2B services'}
Products: ${(input.productsOffered || []).join(', ') || 'None specified'}
Description / Who they sell to: ${input.companyDescription || input.userMission || ''}
Target sectors selected: ${(input.targetIndustries || []).join(', ') || 'Not specified'}
Target location: ${input.location || 'Unspecified'}`;

  const callModel = async (model: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      return await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let res = await callModel('gpt-4.1-mini');
    if (!res.ok) res = await callModel('gpt-4o-mini');
    if (res.ok) {
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content) as Partial<CustomerModel>;
        const types = cleanList(parsed.idealCustomerTypes, 6);
        const signals = cleanList(parsed.buyingSignals, 6);
        if (types.length > 0 && signals.length > 0) {
          return {
            idealCustomerTypes: types,
            customerSize: (parsed.customerSize || '').trim() || fallback.customerSize,
            buyingSignals: signals,
            serviceArea: parsed.serviceArea === 'national' ? 'national' : input.serviceArea || fallback.serviceArea,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[CustomerModel] OpenAI generation failed, using fallback:', err);
  }

  return fallback;
}
