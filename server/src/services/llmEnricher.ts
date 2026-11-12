import {
  classifyArticleType,
  extractNamedPeople,
  isLowYieldArticle,
  isNonBuyerRole,
  isSportsArticle,
  nameAppearsInText,
  profileTerms,
  usableCompanyDomain,
  type ArticleType,
} from './signalQuality';
import { isPolicyCommentary } from './buyerProfile';
import { buildLocationLock, mentionsLockedPlace, type LocationLock } from './aiQueryPlanner';
import { hasJevKey, jevSystemOne, noulOf, type JevConfig, type JevQuestion } from './jev';

/**
 * OpenAI (gpt-4o-mini) LLM Enrichment Service Adapter
 * Parses article markdown into structured B2B intelligence:
 * - Company Name and Domain
 * - Signal Type (funding, hiring, acquisition, expansion)
 * - 3-bullet executive summary focusing on "Why reach out now?"
 * - Extracted Decision Maker (Name, Role, Company)
 * - Personalized 2-sentence cold intro hook ("I saw in [Source] that [Company] recently...")
 * - High-converting cold pitch email subject & body
 */

export interface CompetitorBranch {
  name: string;
  domain?: string;
  reason: string;
}

export interface PeerRoleBranch {
  title: string;
  reason: string;
}

export interface DetectedContact {
  name: string;
  role: string;
  company?: string;
}

export interface EnrichedSignalData {
  companyName: string;
  companyDomain: string;
  signalType: string;
  industryTags: string[];
  summaryBullets: [string, string, string];
  articleSummary?: string;
  decisionMaker: {
    name: string;
    role: string;
    company: string;
  };
  detectedContacts?: DetectedContact[];
  coldIntroHook: string;
  pitchSubject: string;
  pitchBody: string;
  competitors: CompetitorBranch[];
  suggestedPeerRoles: PeerRoleBranch[];
}

/* ------------------------------------------------------------------ */
/* Fast batch headline + snippet triage                                */
/* ------------------------------------------------------------------ */

export interface TriageCandidate {
  index: number;
  title: string;
  snippet: string;
  publisher: string;
  url?: string;
  publishedAt?: string;
}

export interface TriageBuyerProfile {
  /** What the seller sells (value prop, mission, services). */
  offering?: string;
  targetIndustries?: string[];
  buyerIndustries?: string[];
  targetTriggers?: string[];
  userIntent?: string;
  /** local = hard geographic filter on the location below. national = no geo filter. */
  serviceArea?: 'local' | 'national';
  /** Free-form target location, e.g. "Vancouver, British Columbia, Canada". */
  location?: string;
  /** Explicit lock; derived from `location` + `serviceArea` when absent. */
  locationLock?: LocationLock;
}

export interface TriageResult {
  /** Candidate indices ranked by relevance, at most `maxWinners`. */
  selectedIndices: number[];
  /** Short reason per selected index. */
  reasoning: Record<number, string>;
  /** `jev:<model>` when TypeSafe Jev decided, otherwise `keyword_fallback`. */
  modelUsed: `jev:${string}` | 'keyword_fallback';
}

const TRIGGER_TYPES: ArticleType[] = [
  'leadership_hire',
  'funding',
  'expansion',
  'contract_award',
  'ground_breaking',
  'lease_real_estate',
  'acquisition',
];

const TRIGGER_WEIGHT: Partial<Record<ArticleType, number>> = {
  leadership_hire: 3,
  funding: 3,
  acquisition: 3,
  contract_award: 3,
  ground_breaking: 3,
  expansion: 2,
  lease_real_estate: 2,
};

const STOCK_BLURB =
  /\b(shares? (?:rose|fell|jumped|slid|gained|dropped|up\b|down\b)|stock (?:price|rises|falls|jumps)|price target|52-week|nyse:|nasdaq:|tsx:|tsxv:|otc:|short interest|dividend declared|earnings call transcript|analyst (?:rating|upgrade|downgrade)|(?:upgraded|downgraded) to (?:buy|sell|hold|outperform|underperform))/i;

const OPINION_PIECE = /\b(opinion|op-ed|editorial|columnist|column:|commentary|letters? to the editor|perspective:|analysis:|viewpoint)/i;

function triageLock(profile: TriageBuyerProfile): LocationLock {
  return profile.locationLock || buildLocationLock(profile.location || '', profile.serviceArea || 'local');
}

/** Deterministic hard rejects shared by the LLM guard and the keyword fallback. */
function hardRejectReason(candidate: TriageCandidate): string | null {
  const text = `${candidate.title} ${candidate.snippet}`;
  if (isSportsArticle(candidate.title, candidate.publisher)) return 'Sports story.';
  if (isLowYieldArticle(candidate.title, candidate.publisher, candidate.url || '')) {
    return 'Listicle, wire roundup, or low-yield source.';
  }
  if (classifyArticleType(candidate.title, candidate.snippet) === 'listicle_roundup') return 'Listicle or roundup.';
  if (STOCK_BLURB.test(text)) return 'Stock ticker blurb.';
  if (OPINION_PIECE.test(candidate.title) || isPolicyCommentary(candidate.title, candidate.snippet)) {
    return 'Opinion or policy commentary.';
  }
  return null;
}

/**
 * Keyword + location fallback used when OPENAI_API_KEY is absent or the
 * batch call fails. Same hard geographic rule as the LLM: a local seller only
 * keeps stories whose headline or snippet names the locked city or region.
 */
export function keywordTriageCandidates(
  candidates: TriageCandidate[],
  profile: TriageBuyerProfile,
  maxWinners = 5
): TriageResult {
  const lock = triageLock(profile);
  const { topic } = profileTerms({
    targetIndustries: [...(profile.targetIndustries || []), ...(profile.buyerIndustries || [])],
    targetTriggers: profile.targetTriggers,
    userMission: profile.offering,
  });
  const scored: Array<{ index: number; score: number; reason: string }> = [];

  for (const candidate of candidates) {
    if (hardRejectReason(candidate)) continue;
    const text = `${candidate.title} ${candidate.snippet}`;
    const type = classifyArticleType(candidate.title, candidate.snippet);
    if (!TRIGGER_TYPES.includes(type)) continue;

    const place = mentionsLockedPlace(text, lock);
    if (lock.enforced && !place.city && !place.region) continue;

    const lower = text.toLowerCase();
    const topicHits = topic.filter((term) => lower.includes(term)).length;
    const score = (TRIGGER_WEIGHT[type] || 1) + Math.min(topicHits, 4) * 2 + (place.city ? 2 : place.region ? 1 : 0);
    const where = place.city ? lock.city : place.region ? lock.region : 'no location constraint';
    scored.push({
      index: candidate.index,
      score,
      reason: `Keyword fallback: ${type.replace(/_/g, ' ')} trigger, ${topicHits} profile term match(es), location: ${where}.`,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const winners = scored.slice(0, Math.max(0, maxWinners));
  return {
    selectedIndices: winners.map((item) => item.index),
    reasoning: Object.fromEntries(winners.map((item) => [item.index, item.reason])),
    modelUsed: 'keyword_fallback',
  };
}

/** Candidates evaluated per Jev System One request (4 per-article questions each). */
export const JEV_TRIAGE_CHUNK_SIZE = 8;

/** Jev probability thresholds. `local` is the hard geographic gate. */
export const JEV_TRIAGE_THRESHOLDS = { trigger: 0.5, fit: 0.5, local: 0.6, noise: 0.5 };

const TRIGGER_EVENT_TEXT =
  'a leadership appointment, funding raise, acquisition, expansion or new facility, groundbreaking, contract award, or lease / headquarters move';

function jevQuestionsFor(index: number, profile: TriageBuyerProfile, lock: LocationLock): Record<string, JevQuestion> {
  const ref = `the article with key "${index}" in state.articles`;
  const area = [lock.city, lock.region].filter(Boolean).join(' / ');
  const questions: Record<string, JevQuestion> = {
    [`a${index}_trigger`]: {
      type: 'noul',
      instructions: `Does ${ref} report ${TRIGGER_EVENT_TEXT} at one identifiable operating company?`,
      criteria: {
        true: 'A named operating company (not a government, charity, sports team, or index) had a concrete trigger event.',
        false: 'No identifiable operating company, or no concrete trigger event.',
      },
    },
    [`a${index}_fit`]: {
      type: 'noul',
      instructions: `Would the company in ${ref} plausibly buy what state.seller offers, given the seller's buyer industries?`,
    },
    [`a${index}_noise`]: {
      type: 'noul',
      instructions: `Is ${ref} a listicle, "top N" list, wire roundup, stock ticker or earnings blurb, opinion or editorial piece, policy commentary, sports, crime, or obituary?`,
    },
  };
  if (lock.enforced) {
    questions[`a${index}_local`] = {
      type: 'noul',
      instructions: `Is the company or the event in ${ref} located in ${area}?`,
      criteria: {
        true: `The headline or snippet places the company or event in ${area}.`,
        false: `The company or event is located elsewhere, or the location is not indicated.`,
      },
    };
  }
  return questions;
}

/**
 * Batch headline + snippet triage. TypeSafe AI's Jev (System One) makes the
 * keep / reject / rank decision: each candidate gets calibrated yes/no
 * probabilities for trigger event, buyer fit, noise, and (for local sellers) a
 * hard in-service-area gate. The 30–40 candidate pool is evaluated in a few
 * chunked requests. Only winners (max `maxWinners`) proceed to Firecrawl,
 * full enrichment, and Apollo. Falls back to keyword + location scoring when
 * TYPESAFE_API_KEY is absent or Jev fails.
 */
export async function triageCandidates(
  candidates: TriageCandidate[],
  buyerProfile: TriageBuyerProfile,
  maxWinners = 5,
  jev?: JevConfig
): Promise<TriageResult> {
  const cap = Math.max(0, Math.floor(maxWinners));
  if (candidates.length === 0 || cap === 0) {
    return { selectedIndices: [], reasoning: {}, modelUsed: 'keyword_fallback' };
  }
  if (!hasJevKey(jev)) {
    return keywordTriageCandidates(candidates, buyerProfile, cap);
  }

  const lock = triageLock(buyerProfile);
  // Deterministic guard first: sports, listicles, tickers, and opinion never reach Jev.
  const eligible = candidates.filter((candidate) => !hardRejectReason(candidate));
  const seller = {
    offering: buyerProfile.offering || 'B2B commercial services',
    buyerIndustries: [...(buyerProfile.buyerIndustries || []), ...(buyerProfile.targetIndustries || [])].filter(Boolean),
    preferredTriggers: buyerProfile.targetTriggers || [],
    intent: buyerProfile.userIntent || 'sales_client_acquisition',
    serviceArea: lock.enforced ? `LOCAL: ${[lock.city, lock.region].filter(Boolean).join(', ')} only` : 'National',
  };

  const chunks: TriageCandidate[][] = [];
  for (let i = 0; i < eligible.length; i += JEV_TRIAGE_CHUNK_SIZE) {
    chunks.push(eligible.slice(i, i + JEV_TRIAGE_CHUNK_SIZE));
  }

  let modelName = jev?.model || 'jev';
  let failedChunks = 0;
  const failedCandidates: TriageCandidate[] = [];
  const scored: Array<{ index: number; score: number; reason: string }> = [];

  const results = await Promise.allSettled(
    chunks.map((chunk) =>
      jevSystemOne(
        jev!,
        {
          seller,
          articles: Object.fromEntries(
            chunk.map((c) => [String(c.index), { title: c.title, snippet: (c.snippet || '').slice(0, 320), publisher: c.publisher }])
          ),
        },
        Object.assign({}, ...chunk.map((c) => jevQuestionsFor(c.index, buyerProfile, lock)))
      )
    )
  );

  results.forEach((result, chunkIndex) => {
    if (result.status === 'rejected') {
      failedChunks += 1;
      failedCandidates.push(...chunks[chunkIndex]);
      console.warn('[Triage] Jev chunk failed, using keyword + location fallback for it:', result.reason);
      return;
    }
    modelName = result.value.model || modelName;
    for (const candidate of chunks[chunkIndex]) {
      const answers = result.value.answers;
      const trigger = noulOf(answers[`a${candidate.index}_trigger`]);
      const fit = noulOf(answers[`a${candidate.index}_fit`]);
      const noise = noulOf(answers[`a${candidate.index}_noise`], 1);
      const local = lock.enforced ? noulOf(answers[`a${candidate.index}_local`]) : 1;
      const t = JEV_TRIAGE_THRESHOLDS;
      if (trigger < t.trigger || fit < t.fit || noise >= t.noise || local < t.local) continue;
      const where = lock.enforced ? `, in ${[lock.city, lock.region].filter(Boolean).join('/')} ${local.toFixed(2)}` : '';
      scored.push({
        index: candidate.index,
        score: trigger * fit * local * (1 - noise),
        reason: `Jev: trigger ${trigger.toFixed(2)}, buyer fit ${fit.toFixed(2)}${where}.`,
      });
    }
  });

  if (failedChunks === chunks.length && chunks.length > 0) {
    return keywordTriageCandidates(candidates, buyerProfile, cap);
  }

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const winners = scored.slice(0, cap);
  const reasoning: Record<number, string> = Object.fromEntries(winners.map((w) => [w.index, w.reason]));
  const selectedIndices = winners.map((w) => w.index);

  // Partial outage: fill remaining slots from the keyword fallback over the failed chunks only.
  if (failedCandidates.length > 0 && selectedIndices.length < cap) {
    const backup = keywordTriageCandidates(failedCandidates, buyerProfile, cap - selectedIndices.length);
    for (const index of backup.selectedIndices) {
      selectedIndices.push(index);
      reasoning[index] = backup.reasoning[index];
    }
  }

  return { selectedIndices, reasoning, modelUsed: `jev:${modelName}` };
}

export async function enrichSignalWithLLM(
  headline: string,
  articleMarkdown: string,
  publisher: string,
  apiKey?: string,
  operatorValueProp?: string,
  userIntent?: string
): Promise<EnrichedSignalData> {
  const cleanKey = (apiKey || '').trim();

  // If live OpenAI API key is supplied, query gpt-4o-mini with JSON mode
  if (cleanKey && !cleanKey.includes('your_') && cleanKey.startsWith('sk-')) {
    try {
      const systemPrompt = `You are a direct, pragmatic executive assistant and B2B communication specialist.
Analyze the provided news headline and article text to extract actionable outbound intelligence and knowledge-graph branching targets.

PERSON RULES (STRICTLY ENFORCED):
- Name a person only when the article prints their first and last name. Copy it verbatim.
- Only decision makers employed by the company the story is about. Each detected contact must include that person's own company and domain.
- If the article is a roundup naming people at more than one company, return no decision maker and an empty detectedContacts list.
- Exclude journalists, reporters, analysts, politicians, and public officials. Preserve Unicode letters in names.
- "the CEO", "a spokesperson", "executives", and "new leadership" are not a person. Leave decisionMaker.name as "" in that case.
- Never invent, infer, or recall a name from outside the article.
- companyDomain is the subject company's real website domain if the article states it. Use "" if it is not known. Do not invent a domain.
- Set relevantToSender to false when the story is a listicle, wire roundup, stock recap, charity drive, or is outside the sender's industry and geography.

CRITICAL EMAIL COPY RULES (STRICTLY ENFORCED):
- NO AI SLOP. Absolutely NO buzzwords, clichés, or marketing jargon (e.g. do NOT use "synergy", "game-changer", "delighted", "streamlining", "frictionless", "hyper-tailored", "leverage", "exponential", "in today's fast-paced environment", "catalyst", "unleash", "triage deck", "supercharge").
- PITCH BODY MUST BE LITERALLY 2 SENTENCES. Exactly two sentences of body text:
  1. Sentence 1: Acknowledge reading the article / news about the company (e.g. "I saw the recent article in [Publisher] regarding [Company]'s [project/expansion/milestone].").
  2. Sentence 2: Ask directly if there is an opportunity to connect and present or offer products/services (e.g. "Given our work in [relevant field/services], would there be an opportunity to connect and see if we can present our services for your upcoming plans?").
- Subject line must be simple, lowercase/casual, and human (e.g. "quick question re: [topic]" or "[Company] / [Sender Company]" or "re: [project/expansion]"). Under 7 words. No corporate spam subjects.

You must respond with valid JSON adhering exactly to this structure:
{
  "companyName": "Company name",
  "companyDomain": "companyname.com",
  "signalType": "Facility / Branch Opening" | "Major Contract Awarded" | "Leadership Appointment" | "Merger & Acquisition" | "Capital Investment" | "Commercial Expansion" | "Funding & Growth",
  "industryTags": ["Primary Vertical", "Milestone", "Sector Keyword"],
  "summaryBullets": [
    "Trigger point: What major milestone or event occurred",
    "Operational impact: What bottleneck, hiring expansion, or scaling challenge arose",
    "Commercial angle: Why reaching out now gives an unfair advantage"
  ],
  "articleSummary": "2-3 sentence executive synopsis summarizing the core story, key figures, and background context of the article",
  "relevantToSender": true,
  "decisionMaker": {
    "name": "Full name copied verbatim from the article, or empty string if the article does not print a person's first and last name",
    "role": "Title printed next to that person, or empty string",
    "company": "Company name"
  },
  "detectedContacts": [
    { "name": "Full name at the subject company", "role": "Their title", "company": "That person's employer", "domain": "employer.com" }
  ],
  "coldIntroHook": "I saw the recent article regarding [Company]'s [milestone].",
  "pitchSubject": "quick question re: [milestone / Company]",
  "pitchBody": "Hi [First Name],\\n\\nI saw the recent article in [Publisher] regarding [Company]'s [milestone]. Given our work in [offerings / commercial services], would there be an opportunity to connect and see if we can present our services for your upcoming plans?\\n\\nBest,\\n[User Name]",
  "competitors": [
    { "name": "Key Competitor Name", "domain": "competitor.com", "reason": "Direct market competitor operating in the same industry and geographic market" },
    { "name": "Secondary Competitor Name", "domain": "competitor2.com", "reason": "Alternative provider in this vertical" }
  ],
  "suggestedPeerRoles": [
    { "title": "Industry-appropriate secondary decision maker title", "reason": "Why this role is impacted by the trigger milestone" }
  ]
};`;

      const intentGuidance =
        userIntent === 'job_seeking'
          ? 'NOTE: The sender is exploring senior executive leadership or career opportunities. Tailor the coldIntroHook, pitchSubject, and pitchBody as a peer-to-peer executive career introduction rather than a software sales pitch.'
          : userIntent === 'subcontractor_partners'
          ? 'NOTE: The sender is a trade contractor or commercial vendor seeking subcontracting, project bidding, or vendor partnership opportunities. Tailor the pitch to request bidding specifications or project review.'
          : userIntent === 'investing'
          ? 'NOTE: The sender is an investor or acquisition buyer. Tailor the outreach to express strategic growth capital or succession acquisition interest.'
          : '';

      const userPrompt = `News Publisher: ${publisher}
Headline: ${headline}
${operatorValueProp ? `Sender Value Proposition / What we do: ${operatorValueProp}\nAlign the commercial angle, pitchSubject, and pitchBody to present this solution naturally to the trigger event.` : ''}
${intentGuidance}

Article Content:
${articleMarkdown.slice(0, 18000)}

Extract and generate the structured JSON intelligence object.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as Partial<EnrichedSignalData>;
            if (parsed.companyName && Array.isArray(parsed.summaryBullets) && parsed.summaryBullets.length >= 3) {
            const defaultCompetitors: CompetitorBranch[] = Array.isArray(parsed.competitors) && parsed.competitors.length > 0
              ? parsed.competitors.map((c) => ({
                  name: c.name || 'Key Competitor',
                  domain: c.domain || `${(c.name || 'competitor').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
                  reason: c.reason || 'Direct market competitor in the same sector',
                }))
              : generateHeuristicCompetitors(parsed.companyName, parsed.signalType || 'Enterprise Expansion');

            const defaultPeerRoles: PeerRoleBranch[] = Array.isArray(parsed.suggestedPeerRoles) && parsed.suggestedPeerRoles.length > 0
              ? parsed.suggestedPeerRoles.map((p) => ({
                  title: p.title || 'VP of Engineering',
                  reason: p.reason || 'Strategic internal peer involved in operational execution',
                }))
              : generateHeuristicPeerRoles(parsed.signalType || 'Enterprise Expansion');

            const sourceText = `${headline}\n${articleMarkdown}`;
            const fromModel = [
              ...(parsed.detectedContacts || []),
              ...(parsed.decisionMaker?.name ? [parsed.decisionMaker] : []),
            ].filter((person) => person?.name && nameAppearsInText(person.name, sourceText) && !isNonBuyerRole(person.role || ''));
            const companies = new Set(
              fromModel.map((person) => (person.company || parsed.companyName || '').trim().toLowerCase()).filter(Boolean)
            );
            const uniquePeople = companies.size > 1
              ? []
              : fromModel.filter(
                  (person, index, list) => list.findIndex((item) => item.name.toLowerCase() === person.name.toLowerCase()) === index
                );
            const modelName = parsed.decisionMaker?.name || '';
            const modelRole = parsed.decisionMaker?.role || '';
            const modelOk =
              uniquePeople.length > 0 && nameAppearsInText(modelName, sourceText) && !isNonBuyerRole(modelRole);
            const verifiedName = uniquePeople.length === 0 ? '' : modelOk ? modelName : uniquePeople[0]?.name || '';
            const verifiedRole = uniquePeople.length === 0 ? '' : modelOk ? modelRole : uniquePeople[0]?.role || '';

            return {
              companyName: parsed.companyName,
              companyDomain: usableCompanyDomain(parsed.companyDomain),
              signalType: parsed.signalType || 'Enterprise Expansion',
              industryTags: Array.isArray(parsed.industryTags) && parsed.industryTags.length > 0
                ? parsed.industryTags
                : [parsed.signalType || 'Enterprise Expansion', 'B2B Growth'],
              summaryBullets: [
                parsed.summaryBullets[0],
                parsed.summaryBullets[1],
                parsed.summaryBullets[2],
              ],
              articleSummary: parsed.articleSummary,
              decisionMaker: {
                name: verifiedName,
                role: verifiedRole,
                company: parsed.companyName,
              },
              detectedContacts: uniquePeople.map((person) => ({
                name: person.name,
                role: person.role || '',
                company: parsed.companyName,
              })),
              coldIntroHook: parsed.coldIntroHook || `I saw the recent article in ${publisher} regarding ${parsed.companyName}'s upcoming plans.`,
              pitchSubject: parsed.pitchSubject || `quick question re: ${parsed.companyName}`,
              pitchBody: parsed.pitchBody || `Hi ${(verifiedName || 'there').split(' ')[0] || 'there'},\n\nI saw the recent article in ${publisher} regarding ${parsed.companyName}'s expansion plans. Given our work in commercial services, would there be an opportunity to connect and see if we can present our services for your upcoming milestones?\n\nBest,`,
              competitors: defaultCompetitors,
              suggestedPeerRoles: defaultPeerRoles,
            };
          }
        }
      }
    } catch (err) {
      console.warn('OpenAI gpt-4o-mini enrichment failed, using intelligent heuristic fallback:', err);
    }
  }

  // Intelligent heuristic fallback (works seamlessly when API key is not yet set)
  return generateHeuristicEnrichment(headline, articleMarkdown, publisher);
}

export function generateHeuristicCompetitors(company: string, signalType: string): CompetitorBranch[] {
  const compLower = company.toLowerCase();
  if (compLower.includes('aethon') || compLower.includes('robot') || compLower.includes('defense') || signalType.includes('Defense')) {
    return [
      { name: 'Anduril Industries', domain: 'anduril.com', reason: 'Direct competitor in autonomous defense robotics and operational platforms' },
      { name: 'Shield AI', domain: 'shield.ai', reason: 'Peer aerospace AI and unmanned tactical systems manufacturer' },
      { name: 'Skydio', domain: 'skydio.com', reason: 'Autonomous hardware & situational awareness AI pioneer' },
    ];
  }

  if (compLower.includes('finmatrix') || compLower.includes('fin') || compLower.includes('stripe') || signalType.includes('Fintech')) {
    return [
      { name: 'Ramp', domain: 'ramp.com', reason: 'Direct modern corporate card & finance automation rival' },
      { name: 'Brex', domain: 'brex.com', reason: 'Key competitor targeting fast-scaling enterprise teams' },
      { name: 'Modern Treasury', domain: 'moderntreasury.com', reason: 'Core payment operations and real-time ledger platform' },
    ];
  }

  if (compLower.includes('neuro') || compLower.includes('health') || compLower.includes('bio')) {
    return [
      { name: 'Recursion Pharma', domain: 'recursion.com', reason: 'Leading AI-native biology and molecular target mapping platform' },
      { name: 'Insitro', domain: 'insitro.com', reason: 'Direct peer in machine learning drug discovery' },
      { name: 'Benchling', domain: 'benchling.com', reason: 'Cloud R&D platform serving life sciences operations' },
    ];
  }

  return [
    { name: `${company} Rival Corp`, domain: `rival-${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`, reason: `Direct challenger in the ${signalType} space` },
    { name: 'OmniScale Systems', domain: 'omniscale.io', reason: 'Category peer expanding in parallel enterprise market' },
    { name: 'NextWave Velocity', domain: 'nextwavevelocity.com', reason: 'High-growth alternative solution provider' },
  ];
}

export function generateHeuristicPeerRoles(signalType: string): PeerRoleBranch[] {
  if (signalType.includes('Leadership') || signalType.includes('Executive')) {
    return [
      { title: 'VP of Engineering', reason: 'Critical internal peer executing on the technical vision set by new leadership' },
      { title: 'Head of People & Talent', reason: 'Leading aggressive headcount scaling following executive onboarding' },
    ];
  }
  if (signalType.includes('Funding') || signalType.includes('Series')) {
    return [
      { title: 'Chief Product Officer', reason: 'Allocates freshly raised capital into product expansion & partner integrations' },
      { title: 'VP of Revenue Operations', reason: 'Constructs commercial tech stack to support rapid customer acquisition' },
    ];
  }
  return [
    { title: 'VP of Product Strategy', reason: 'Aligns go-to-market initiatives with newly launched enterprise capabilities' },
    { title: 'Head of Strategic Partnerships', reason: 'Manages ecosystem expansion and ecosystem co-selling opportunities' },
  ];
}

export function generateHeuristicEnrichment(
  headline: string,
  text: string,
  publisher: string
): EnrichedSignalData {
  // Extract company name heuristically from common headline patterns
  let company = 'Enterprise Tech';
  const firstWordMatch = headline.match(/^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/);
  if (firstWordMatch && firstWordMatch[1]) {
    company = firstWordMatch[1].trim();
  }

  const cleanDomain = '';

  // Detect signal type
  let signalType = 'Enterprise Expansion';
  const lower = headline.toLowerCase();
  if (lower.includes('series') || lower.includes('raises') || lower.includes('seed') || lower.includes('million') || lower.includes('$')) {
    signalType = 'Series A/B Funding';
  } else if (lower.includes('appoints') || lower.includes('hires') || lower.includes('ceo') || lower.includes('cro') || lower.includes('vp')) {
    signalType = 'Executive Leadership';
  } else if (lower.includes('launch') || lower.includes('unveil') || lower.includes('announces')) {
    signalType = 'Product Launch';
  }

  const named = extractNamedPeople(`${headline}\n${text}`);
  const dmName = named[0]?.name || '';
  const dmRole = named[0]?.role || '';

  const firstName = dmName.split(' ')[0] || 'there';
  const cleanHeadline = headline.replace(/["']/g, '').slice(0, 65).trim();
  const coldIntroHook = `I saw the recent article in ${publisher} regarding ${company}'s announcement on ${cleanHeadline}.`;
  const pitchSubject = `quick question re: ${company}`;
  const pitchBody = `Hi ${firstName},\n\nI saw the recent article in ${publisher} regarding ${company}'s announcement on ${cleanHeadline}. Given our work in commercial services, would there be an opportunity to connect and see if we can present our offerings for your upcoming plans?\n\nBest,`;

  return {
    companyName: company,
    companyDomain: cleanDomain,
    signalType,
    industryTags: [signalType, 'High Growth', 'Enterprise Tech'],
    summaryBullets: [
      `Headline trigger: ${headline}.`,
      `Commercial and operational infrastructure expanding rapidly across target regional accounts.`,
      `Immediate pipeline demand to eliminate manual review latency and accelerate outbound conversion.`,
    ],
    articleSummary: `${company} published an announcement regarding "${headline}". This strategic catalyst signals significant operational scaling, active leadership mobilization, and market expansion across core commercial sectors.`,
    decisionMaker: {
      name: dmName,
      role: dmRole,
      company,
    },
    detectedContacts: named.map((person) => ({ ...person, company })),
    coldIntroHook,
    pitchSubject,
    pitchBody,
    competitors: generateHeuristicCompetitors(company, signalType),
    suggestedPeerRoles: generateHeuristicPeerRoles(signalType),
  };
}

export function adaptPitchForContact(
  enriched: EnrichedSignalData,
  contact: { name: string; title: string; company: string; source: string },
  context: { publisher: string; offering?: string }
): { subject: string; body: string } {
  const firstName = (contact.name || 'there').split(' ')[0] || 'there';
  const targetCompany = contact.company || enriched.companyName;
  const isSameCompany = targetCompany.toLowerCase().trim() === enriched.companyName.toLowerCase().trim();

  let subject = enriched.pitchSubject || `quick question re: ${targetCompany}`;
  let body = enriched.pitchBody;

  if (isSameCompany) {
    if (enriched.pitchBody) {
      body = enriched.pitchBody.replace(/^Hi\s+[A-Za-z'.-]+,/i, `Hi ${firstName},`);
    } else {
      body = `Hi ${firstName},\n\nI saw the recent article in ${context.publisher} regarding ${targetCompany}'s upcoming plans. Given our work in ${context.offering || 'commercial services'}, would there be an opportunity to connect and see if we can present our services for your upcoming milestones?\n\nBest,`;
    }
  } else {
    // Lookalike or related company lead
    subject = `quick question re: ${targetCompany}`;
    body = `Hi ${firstName},\n\nI came across ${targetCompany} following recent industry milestones around ${enriched.companyName}'s ${enriched.signalType.toLowerCase()}. Given our work in ${context.offering || 'commercial solutions'}, would there be an opportunity to connect and see if we can present our services for your upcoming priorities?\n\nBest,`;
  }

  return { subject, body };
}

