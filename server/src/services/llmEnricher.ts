import {
  classifyArticleType,
  cleanCompanyName,
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
import { buildFallbackCustomerModel, type CustomerModel } from './customerModel';
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
  verbatimQuotes?: string[];
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
  /** Structured customer model driving triage & relevance. */
  customerModel?: CustomerModel;
}

export interface TriageResult {
  /** Candidate indices ranked by relevance, at most `maxWinners`. */
  selectedIndices: number[];
  /** Short reason per selected index. */
  reasoning: Record<number, string>;
  /** `jev:<model>` when TypeSafe Jev decided, otherwise `keyword_fallback`. */
  modelUsed: `jev:${string}` | 'keyword_fallback';
}

const STOCK_BLURB =
  /\b(shares? (?:rose|fell|jumped|slid|gained|dropped|up\b|down\b)|stock (?:price|rises|falls|jumps)|why\b[^.]{0,60}\b(?:stock|shares)\b[^.]{0,40}\bmoved|market wrap|daily market|pre-market movers|after-hours movers|price target|52-week|short interest|dividend declared|earnings call transcript|analyst (?:rating|upgrade|downgrade)|(?:upgraded|downgraded) to (?:buy|sell|hold|outperform|underperform))/i;

const OPINION_PIECE = /\b(opinion|op-ed|editorial|columnist|column:|commentary|letters? to the editor|perspective:|analysis:|viewpoint)/i;

function triageLock(profile: TriageBuyerProfile): LocationLock {
  return profile.locationLock || buildLocationLock(profile.location || '', profile.serviceArea || 'local');
}

/** Deterministic hard rejects shared by the LLM guard and the keyword fallback. */
export function hardRejectReason(candidate: TriageCandidate): string | null {
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
  const model = profile.customerModel || buildFallbackCustomerModel({
    userMission: profile.offering,
    targetIndustries: profile.targetIndustries,
    buyerIndustries: profile.buyerIndustries,
    targetTriggers: profile.targetTriggers,
    location: profile.location,
    serviceArea: profile.serviceArea,
  });
  const { topic } = profileTerms({
    targetIndustries: [...(profile.targetIndustries || []), ...(profile.buyerIndustries || []), ...model.idealCustomerTypes],
    targetTriggers: [...(profile.targetTriggers || []), ...model.buyingSignals],
    userMission: profile.offering,
  });
  const modelTerms = [...new Set([...model.idealCustomerTypes, ...model.buyingSignals].map((t) => t.toLowerCase()).filter((t) => t.length >= 3))];
  const scored: Array<{ index: number; score: number; reason: string }> = [];

  for (const candidate of candidates) {
    if (hardRejectReason(candidate)) continue;
    const text = `${candidate.title} ${candidate.snippet}`;
    const lower = text.toLowerCase();
    const type = classifyArticleType(candidate.title, candidate.snippet);
    const place = mentionsLockedPlace(text, lock);
    if (lock.enforced && !place.city && !place.region) continue;

    const topicHits = topic.filter((term) => lower.includes(term)).length;
    const modelHits = modelTerms.filter((term) => lower.includes(term)).length;
    const isConcreteEvent = type !== 'other' && type !== 'listicle_roundup';
    if (!isConcreteEvent && topicHits === 0 && modelHits === 0) continue;

    const score =
      (isConcreteEvent ? 3 : 0) +
      Math.min(modelHits, 4) * 3 +
      Math.min(topicHits, 4) * 2 +
      (place.city ? 2 : place.region ? 1 : 0);
    const where = place.city ? lock.city : place.region ? lock.region : 'no location constraint';
    scored.push({
      index: candidate.index,
      score,
      reason: `Keyword fallback: ${modelHits} customer-model hit(s), ${topicHits} profile term(s), location: ${where}.`,
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

/**
 * Sort-only candidate ranker for the judge: never drops articles on keyword or
 * location gates (only skips deterministic hardRejectReason like sports/listicles).
 * Used to ensure fresh articles reach Jev/judge instead of being starved by pre-filters.
 */
export function rankCandidatesForJudge(
  candidates: TriageCandidate[],
  profile: TriageBuyerProfile,
  maxWinners = 40
): TriageResult {
  const lock = triageLock(profile);
  const model = profile.customerModel || buildFallbackCustomerModel({
    userMission: profile.offering,
    targetIndustries: profile.targetIndustries,
    buyerIndustries: profile.buyerIndustries,
    targetTriggers: profile.targetTriggers,
    location: profile.location,
    serviceArea: profile.serviceArea,
  });
  const { topic } = profileTerms({
    targetIndustries: [...(profile.targetIndustries || []), ...(profile.buyerIndustries || []), ...model.idealCustomerTypes],
    targetTriggers: [...(profile.targetTriggers || []), ...model.buyingSignals],
    userMission: profile.offering,
  });
  const modelTerms = [...new Set([...model.idealCustomerTypes, ...model.buyingSignals].map((t) => t.toLowerCase()).filter((t) => t.length >= 3))];
  const scored: Array<{ index: number; score: number; reason: string }> = [];

  for (const candidate of candidates) {
    if (hardRejectReason(candidate)) continue;
    const text = `${candidate.title} ${candidate.snippet}`;
    const lower = text.toLowerCase();
    const type = classifyArticleType(candidate.title, candidate.snippet);
    const place = mentionsLockedPlace(text, lock);
    const topicHits = topic.filter((term) => lower.includes(term)).length;
    const modelHits = modelTerms.filter((term) => lower.includes(term)).length;
    const score =
      (type !== 'other' && type !== 'listicle_roundup' ? 2 : 0) +
      Math.min(modelHits, 4) * 3 +
      Math.min(topicHits, 4) * 2 +
      (place.city ? 3 : place.region ? 2 : 0);
    scored.push({
      index: candidate.index,
      score,
      reason: `Sorted for judge (score=${score}, modelHits=${modelHits}).`,
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

/** Candidates evaluated per Jev System One request. */
export const JEV_TRIAGE_CHUNK_SIZE = 10;

/** Jev probability thresholds. `local` is the hard geographic gate. */
export const JEV_TRIAGE_THRESHOLDS = { customer: 0.4, local: 0.4, noise: 0.6 };

function jevQuestionsFor(
  index: number,
  profile: TriageBuyerProfile,
  lock: LocationLock,
  model: CustomerModel
): Record<string, JevQuestion> {
  const ref = `the article with key "${index}" in state.articles`;
  const area = [lock.city, lock.region].filter(Boolean).join(' / ') || 'the target area';
  const offeringDesc = profile.offering || 'B2B services';
  const modelDesc = `ideal customers: ${model.idealCustomerTypes.join(', ')}; size: ${model.customerSize}; buying signals: ${model.buyingSignals.join(', ')}`;
  const questions: Record<string, JevQuestion> = {
    [`a${index}_customer`]: {
      type: 'noul',
      instructions: `Is the business in ${ref} a plausible customer for ${offeringDesc} in ${area}, per this customer model (${modelDesc})? Reject vendors of the same offering, media outlets, and organizations outside the customer model.`,
      criteria: {
        true: 'Names an identifiable operating business matching the customer model with a concrete reason to reach out, and is not a competitor/vendor of the offering or a media outlet.',
        false: 'No identifiable customer business, outside the customer model, a competitor/vendor of the same offering, or a media outlet.',
      },
    },
    [`a${index}_noise`]: {
      type: 'noul',
      instructions: `Is ${ref} a listicle, "top N" list, market wrap or wire roundup, automated stock-ticker movement blurb (e.g. "Why Stock X moved today"), earnings call transcript, opinion or editorial piece, policy commentary, sports, crime, or obituary? (Note: an official corporate press release announcing a contract, facility expansion, acquisition, or executive hire is NOT noise.)`,
    },
  };
  if (lock.enforced) {
    questions[`a${index}_local`] = {
      type: 'noul',
      instructions: `Is the company, office, hiring, expansion, or event in ${ref} connected to or located in ${area}?`,
      criteria: {
        true: `The headline, snippet, or publisher connects the company, branch, office, or story to ${area}.`,
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
  const customerModel =
    buyerProfile.customerModel ||
    buildFallbackCustomerModel({
      userMission: buyerProfile.offering,
      targetIndustries: buyerProfile.targetIndustries,
      buyerIndustries: buyerProfile.buyerIndustries,
      targetTriggers: buyerProfile.targetTriggers,
      location: buyerProfile.location,
      serviceArea: buyerProfile.serviceArea,
    });
  // Deterministic guard first: sports, listicles, tickers, and opinion never reach Jev.
  const eligible = candidates.filter((candidate) => !hardRejectReason(candidate));
  const seller = {
    offering: buyerProfile.offering || 'B2B commercial services',
    customerModel,
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
        Object.assign({}, ...chunk.map((c) => jevQuestionsFor(c.index, buyerProfile, lock, customerModel)))
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
      const customer = noulOf(answers[`a${candidate.index}_customer`]);
      const noise = noulOf(answers[`a${candidate.index}_noise`], 1);
      const local = lock.enforced ? noulOf(answers[`a${candidate.index}_local`]) : 1;
      const t = JEV_TRIAGE_THRESHOLDS;
      if (customer < t.customer || noise >= t.noise || local < t.local) continue;
      const where = lock.enforced ? `, in ${[lock.city, lock.region].filter(Boolean).join('/')} ${local.toFixed(2)}` : '';
      scored.push({
        index: candidate.index,
        score: customer * local * (1 - noise),
        reason: `Jev: customer ${customer.toFixed(2)}${where}.`,
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

  // If Jev scored fewer than cap winners (e.g. strict probability thresholds or partial outage),
  // fill remaining slots from the keyword/catalyst triage so the user ALWAYS gets qualified signals.
  if (selectedIndices.length < cap) {
    const backupCandidates = failedCandidates.length > 0 ? failedCandidates : eligible;
    const backup = keywordTriageCandidates(backupCandidates, buyerProfile, cap - selectedIndices.length);
    for (const index of backup.selectedIndices) {
      if (!selectedIndices.includes(index)) {
        selectedIndices.push(index);
        reasoning[index] = backup.reasoning[index];
      }
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
  "verbatimQuotes": [
    "2-3 exact sentences copied word-for-word from the article supporting the company, trigger event, and key figures"
  ],
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
${operatorValueProp ? `Sender Value Proposition / What we do: ${operatorValueProp}\nAlign the commercial angle, pitchSubject, and pitchBody to present this exact service naturally to the trigger event.` : ''}
- Opening line MUST reference the specific article/event and connect directly to the sender's services.
- If no real person first name is known, start with "Hi there,". Never use placeholder names like "Verified" or "Executive".
- Do NOT include any unsubscribe or opt-out line (these are 1:1 personal emails).
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
              verbatimQuotes: Array.isArray(parsed.verbatimQuotes)
                ? parsed.verbatimQuotes
                    .filter((q): q is string => typeof q === 'string' && q.trim().length > 10)
                    .map((q) => q.trim())
                    .slice(0, 3)
                : [],
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
              pitchBody: (
                parsed.pitchBody ||
                `Hi ${(verifiedName || 'there').split(' ')[0] || 'there'},\n\nI saw the recent article in ${publisher} regarding ${parsed.companyName}'s expansion plans. Given our work in commercial services, would there be an opportunity to connect and see if we can present our services for your upcoming milestones?\n\nBest,`
              )
                .replace(/\\r\\n/g, '\n')
                .replace(/\\n/g, '\n'),
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
  return generateHeuristicEnrichment(headline, articleMarkdown, publisher, operatorValueProp);
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

const GEO_PREFIX = /^(?:In\s+|From\s+)?([A-Za-z.'-]+(?:\s+[A-Za-z.'-]+)?)(?:'s|’s)\s+/i;
const WIRE_DATELINE_PREFIX =
  /^(?:[A-Z][A-Za-z.'\s-]{1,40},\s*(?:[A-Z]{2}|[A-Za-z.\s]{2,20})(?:,\s*[A-Za-z.\s0-9,]{2,25})?\s*(?:--|\/)\s*(?:\([^)]+\)|[A-Za-z\s]{2,30})\s*(?:--|\/)\s*)/;
const TICKER_TAG_RE = /\s*\((?:NYSE|NASDAQ|TSX|TSXV|OTC|CSE|NEO|AMEX|LON|ASX)\s*:\s*[A-Z0-9.-]+\)/gi;
const ACTION_VERBS = /\s+(?:grows|expands|opens|launches|acquires|purchases|buys|merges with|names|appoints|hires|taps|promotes|raises|secures|closes|lands|wins|breaks ground|relocates|reports|celebrates|awarded|gets|announces|signs|completes)\b/i;
const STOP_ENTITIES = new Set([
  'vancouver', 'toronto', 'calgary', 'edmonton', 'montreal', 'ottawa', 'victoria', 'canada',
  'british columbia', 'ontario', 'alberta', 'morning', 'industry', 'business', 'the', 'new', 'city', 'us', 'usa', 'enterprise'
]);

export function extractCompanyFromHeadline(headline: string): string {
  let cleaned = headline.trim().replace(WIRE_DATELINE_PREFIX, '').replace(TICKER_TAG_RE, '').trim();
  const geoMatch = cleaned.match(GEO_PREFIX);
  if (geoMatch && geoMatch[1] && STOP_ENTITIES.has(geoMatch[1].toLowerCase())) {
    cleaned = cleaned.slice(geoMatch[0].length).trim();
  }

  const verbMatch = cleaned.search(ACTION_VERBS);
  if (verbMatch > 0) {
    const candidate = cleaned.slice(0, verbMatch).replace(/^(?:the\s+)/i, '').trim();
    if (candidate && !STOP_ENTITIES.has(candidate.toLowerCase()) && candidate.length > 2) {
      return candidate;
    }
  }

  // Fallback: look for 1-3 capitalized words before any dash, colon, or comma
  const firstSegment = cleaned.split(/[-–—:|]/)[0].trim();
  const words = firstSegment.split(/\s+/);
  const proper: string[] = [];
  for (const w of words) {
    if (/^[A-Z][A-Za-z0-9&.'-]+$/.test(w) && !STOP_ENTITIES.has(w.toLowerCase())) {
      proper.push(w);
    } else if (proper.length > 0) {
      break;
    }
  }
  if (proper.length > 0 && proper.length <= 4) {
    return proper.join(' ');
  }

  return 'Local Enterprise';
}

export function generateHeuristicEnrichment(
  headline: string,
  text: string,
  publisher: string,
  operatorValueProp?: string
): EnrichedSignalData {
  const company = cleanCompanyName(extractCompanyFromHeadline(headline));
  const cleanDomain = '';

  // Detect signal type
  let signalType = 'Enterprise Expansion';
  const lower = headline.toLowerCase();
  if (lower.includes('series') || lower.includes('raises') || lower.includes('seed') || lower.includes('million') || lower.includes('$')) {
    signalType = 'Series A/B Funding';
  } else if (lower.includes('appoints') || lower.includes('hires') || lower.includes('ceo') || lower.includes('cro') || lower.includes('vp') || lower.includes('names new')) {
    signalType = 'Executive Leadership';
  } else if (lower.includes('acquires') || lower.includes('acquisition') || lower.includes('merges') || lower.includes('purchase')) {
    signalType = 'Merger & Acquisition';
  } else if (lower.includes('launch') || lower.includes('unveil') || lower.includes('announces')) {
    signalType = 'Product Launch';
  }

  const named = extractNamedPeople(`${headline}\n${text}`);
  const dmName = named[0]?.name || '';
  const dmRole = named[0]?.role || '';

  const firstName = dmName && !/^(verified|executive|decision|target|unknown)$/i.test(dmName.split(' ')[0])
    ? dmName.split(' ')[0]
    : 'there';
  const cleanHeadline = headline.replace(/["']/g, '').slice(0, 80).trim();
  const coldIntroHook = `I saw the recent news regarding ${company}'s milestone: "${cleanHeadline}".`;
  const focusOffering = (operatorValueProp || '').trim() || 'your upcoming operational priorities';
  const pitchSubject = `${company} — ${cleanHeadline.slice(0, 48)}`;
  const pitchBody = `Hi ${firstName},\n\nI saw the news about ${company} ("${cleanHeadline}") and wanted to reach out given our focus on ${focusOffering}.\n\nWould you be open to a brief conversation on how we can support ${company} as this unfolds?`;

  const rawSentences = text
    .replace(/^#.*$/gm, '')
    .replace(/\*\*Source URL\*\*:.*$/gm, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 320);

  return {
    companyName: company,
    companyDomain: cleanDomain,
    signalType,
    industryTags: [signalType, 'Commercial Business', 'Regional Growth'],
    summaryBullets: [
      `Milestone: ${cleanHeadline}.`,
      `Regional Scaling: ${company} is expanding operational capacity and footprint.`,
      `Commercial Opportunity: Operational growth creates vendor, facilities, and risk coverage requirements.`,
    ],
    articleSummary: `${company} announced "${cleanHeadline}". As operations scale, new commercial requirements and risk coverage opportunities emerge.`,
    verbatimQuotes: rawSentences.slice(0, 3),
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

export interface AdaptPitchContext {
  publisher?: string;
  offering?: string;
  userOrganization?: string;
  userName?: string;
  userServices?: string[];
  userMission?: string;
  valueProp?: string;
  userIntent?: string;
  city?: string;
  triggerSentence?: string;
  whyMatched?: string;
}

export function adaptPitchForContact(
  enriched: EnrichedSignalData,
  contact: { name: string; title: string; company: string; source: string },
  context: AdaptPitchContext
): { subject: string; body: string } {
  const rawFirst = (contact.name || '').trim().split(/\s+/)[0] || '';
  const firstName =
    rawFirst && !/^(verified|executive|decision|target|unknown|contact)$/i.test(rawFirst)
      ? rawFirst
      : 'there';
  const targetCompany = cleanCompanyName(contact.company || enriched.companyName || '') || 'your team';
  const senderOrg = (context.userOrganization || '').replace(/\s*-\s*TwinFlow/i, '').trim();
  const senderName = (context.userName && context.userName !== 'Operator' ? context.userName : '').trim();

  const offeringText =
    (context.userServices && context.userServices.length > 0
      ? context.userServices.slice(0, 2).join(' and ')
      : '') ||
    context.valueProp ||
    context.userMission ||
    context.offering ||
    '';

  const triggerText = (context.triggerSentence || '').trim();
  const articleEvent = triggerText
    ? `I noticed the recent report noting that "${triggerText.replace(/["]+/g, "'")}".`
    : (enriched.coldIntroHook || '').trim() ||
      `I saw the recent news about ${targetCompany} (${enriched.signalType.toLowerCase()}).`;

  const signatureLines = [senderName, senderOrg].filter(Boolean);
  const signature = signatureLines.length > 0 ? `\n\nBest regards,\n${signatureLines.join('\n')}` : '\n\nBest regards,';

  const subjectCore = offeringText
    ? `${offeringText.slice(0, 38)} for ${targetCompany}`
    : `${targetCompany} — ${enriched.signalType}`;

  let serviceSentence: string;
  if (context.whyMatched && context.whyMatched.trim().length > 15) {
    serviceSentence = context.whyMatched.trim();
  } else if (offeringText) {
    serviceSentence = `We specialize in ${offeringText}${context.city ? ` in ${context.city}` : ''}, and this timing looks closely aligned with what we help teams with.`;
  } else {
    serviceSentence = `I wanted to share a quick perspective on how teams handle this type of transition${context.city ? ` in ${context.city}` : ''}.`;
  }

  const body = `Hi ${firstName},\n\n${articleEvent}\n\n${serviceSentence}\n\nWould you be open to a brief 10-minute call this week?${signature}`;

  return { subject: subjectCore, body };
}

export interface ExtractedProspectItem {
  companyName: string;
  location?: string;
  industry?: string;
  domain?: string;
  triggerSummary: string;
  signalType: string;
  decisionMakerName?: string;
  decisionMakerRole?: string;
}

/**
 * Extracts ALL operating companies listed as prospects/recipients/subjects in an
 * article (handles both single-company stories and 40+ company backgrounders/lists).
 */
export async function extractProspectsFromArticle(
  headline: string,
  articleMarkdown: string,
  publisher: string,
  apiKey?: string
): Promise<ExtractedProspectItem[]> {
  const cleanKey = (apiKey || '').trim();
  if (cleanKey && cleanKey.startsWith('sk-') && !cleanKey.includes('your_')) {
    const models = ['gpt-4.1-mini', 'gpt-4o-mini'];
    for (const modelName of models) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        let res: Response;
        try {
          res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cleanKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelName,
              temperature: 0.1,
              max_tokens: 4500,
              response_format: { type: 'json_object' },
              messages: [
                {
                  role: 'system',
                  content: `Extract EVERY distinct operating company that is a prospect, recipient, winner, or subject in the article.
If the article lists 10, 20, or 44 companies, you MUST return ALL of them — never stop early. Do NOT include government agencies, publishers, or partners unless they are listed as recipients.
Use compact keys for speed:
{ "prospects": [ { "c": "Company Name", "l": "City, Prov/State or empty", "i": "Industry or empty", "s": "1 short sentence summary" } ] }`,
                },
                {
                  role: 'user',
                  content: `Headline: ${headline}\nPublisher: ${publisher}\n\nArticle:\n${(articleMarkdown || '').slice(0, 32000)}`,
                },
              ],
            }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        if (!res.ok) continue;
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const raw = json.choices?.[0]?.message?.content;
        if (!raw) continue;
        const parsed = JSON.parse(raw) as {
          prospects?: Array<{ c?: string; l?: string; i?: string; s?: string; companyName?: string; location?: string; industry?: string; triggerSummary?: string }>;
        };
        const deduped: ExtractedProspectItem[] = [];
        const seen = new Set<string>();
        for (const item of parsed.prospects || []) {
          const name = cleanCompanyName(String(item.c || item.companyName || '').trim());
          if (!name || name.length < 2) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push({
            companyName: name,
            location: (item.l || item.location || '').trim(),
            industry: (item.i || item.industry || '').trim(),
            domain: '',
            triggerSummary: String(item.s || item.triggerSummary || headline).trim(),
            signalType: 'Funding & Expansion',
          });
        }
        if (deduped.length > 0) {
          console.log(`[ExtractProspects] ${modelName} extracted ${deduped.length} prospects from "${headline.slice(0, 60)}"`);
          return deduped;
        }
      } catch (err) {
        console.warn(`[ExtractProspects] ${modelName} failed:`, err instanceof Error ? err.message : String(err));
      }
    }
  }

  // Heuristic fallback when OpenAI key is absent: detect multiple corporate entity lines if present
  const corpMatches = (articleMarkdown || '').match(/^[ \t]*(?:[-*•]\s*)?([A-Z][A-Za-z0-9&'.\- ]{1,60}\b(?:Inc\.?|Corp\.?|Ltd\.?|LLC|LLP|Technologies|Labs|Analytics|AI|Group))\b/gm) || [];
  const uniqueCorps: ExtractedProspectItem[] = [];
  const seen = new Set<string>();
  for (const m of corpMatches) {
    const clean = cleanCompanyName(m.replace(/^[-*•\s]+/, '').trim());
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    uniqueCorps.push({
      companyName: clean,
      triggerSummary: `${clean} featured in "${headline}".`,
      signalType: 'Manual Prospect',
    });
  }
  if (uniqueCorps.length > 1) {
    return uniqueCorps;
  }

  const single = generateHeuristicEnrichment(headline, articleMarkdown, publisher);
  return [
    {
      companyName: single.companyName,
      domain: usableCompanyDomain(single.companyDomain),
      triggerSummary: single.coldIntroHook,
      signalType: single.signalType,
      decisionMakerName: single.decisionMaker?.name || '',
      decisionMakerRole: single.decisionMaker?.role || '',
    },
  ];
}

