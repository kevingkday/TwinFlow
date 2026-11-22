import { crawlArticle } from './firecrawl';
import { deriveBuyerProfile } from './buyerProfile';
import { usableCompanyDomain } from './signalQuality';
import type { Bindings } from '../db';
import type { Signal } from '../db/schema';

export interface VerifiedFact {
  statement: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceDate: string;
  verbatimQuote: string;
}

export interface InferredOpportunity {
  area: string;
  rationale: string;
  confidence: 'high' | 'medium';
}

export interface VerificationLog {
  checkedFacts: number;
  keptFacts: number;
  rejectedFacts: number;
  rewrittenFacts: number;
  rewrittenOpportunities: number;
  pass2Mode: 'openai' | 'deterministic';
  notes: string[];
}

export interface GeneratedResearchBrief {
  briefTitle: string;
  verifiedFacts: VerifiedFact[];
  inferredOpportunities: InferredOpportunity[];
  investigationQuestions: string[];
  verificationLog: VerificationLog;
}

export interface SellerProfileInput {
  organization?: string | null;
  companyDescription?: string | null;
  valueProp?: string | null;
  userMission?: string | null;
  servicesOffered?: string[];
  productsOffered?: string[];
  targetIndustries?: string[];
  targetRoles?: string[];
  userIntent?: string | null;
}

export interface SourceDocument {
  label: string;
  url: string;
  date: string;
  text: string;
}

interface SourceExcerpt {
  quote: string;
  context?: string;
}

function hasUsableOpenAiKey(apiKey?: string): boolean {
  const clean = (apiKey || '').trim();
  return Boolean(clean && !clean.includes('your_') && clean.startsWith('sk-'));
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseExcerpts(raw: string | null | undefined): SourceExcerpt[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SourceExcerpt => Boolean(item && typeof item.quote === 'string' && item.quote.trim()))
      .map((item) => ({ quote: item.quote.trim(), context: item.context }));
  } catch {
    return [];
  }
}

function formatDateLabel(rawDate?: string | null): string {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  const parsed = Date.parse(rawDate);
  if (Number.isNaN(parsed)) return rawDate.slice(0, 10);
  return new Date(parsed).toISOString().slice(0, 10);
}

const SPECULATIVE_ACCUSATION_PATTERNS: Array<[RegExp, string]> = [
  [/\bhas no\b/gi, 'may benefit from reviewing'],
  [/\bhave no\b/gi, 'may benefit from reviewing'],
  [/\blacks?\b/gi, 'may benefit from reviewing'],
  [/\bis missing\b/gi, 'may benefit from reviewing'],
  [/\bare missing\b/gi, 'may benefit from reviewing'],
  [/\bdoesn't have\b/gi, 'may benefit from evaluating'],
  [/\bdoes not have\b/gi, 'may benefit from evaluating'],
  [/\bwithout any\b/gi, 'with potential exposure around'],
  [/\bfailed to\b/gi, 'may need to evaluate'],
  [/\bclearly unprepared\b/gi, 'may want to review readiness'],
];

export function sanitizeSpeculativeText(text: string): { text: string; changed: boolean } {
  let result = text;
  let changed = false;
  for (const [pattern, replacement] of SPECULATIVE_ACCUSATION_PATTERNS) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      changed = true;
    }
  }
  return { text: result, changed };
}

/**
 * Checks whether a quote (or a meaningful substring of it) appears in the combined source texts,
 * and ensures any numeric figures in the statement appear in the source text.
 */
export function isFactGroundedInSources(fact: VerifiedFact, sources: SourceDocument[]): boolean {
  if (!fact.statement?.trim() || !fact.verbatimQuote?.trim()) return false;
  const combinedSource = normalizeText(sources.map((s) => s.text).join('\n'));
  if (!combinedSource) return false;

  const normQuote = normalizeText(fact.verbatimQuote).replace(/^["'“”]+|["'“”]+$/g, '');
  if (normQuote.length < 12) return false;

  // Accept exact substring match or high-overlap 6+ word window
  let quoteMatched = combinedSource.includes(normQuote);
  if (!quoteMatched) {
    const words = normQuote.split(' ').filter((w) => w.length > 2);
    if (words.length >= 6) {
      const windowStr = words.slice(0, 6).join(' ');
      quoteMatched = combinedSource.includes(windowStr);
    }
  }
  if (!quoteMatched) return false;

  // Every multi-digit number or currency figure in the statement must appear in the source text
  const numbersInStatement = fact.statement.match(/\$?\d+(?:[.,]\d+)?%?/g) || [];
  for (const num of numbersInStatement) {
    const bare = num.replace(/[$,%]/g, '');
    if (bare.length >= 2 && !combinedSource.includes(bare.toLowerCase())) {
      return false;
    }
  }

  return true;
}

/**
 * Step A: Gather primary sources from stored signal snapshot/excerpts (or re-scrape if missing)
 * and target company website if companyDomain is available.
 */
export async function gatherPrimarySources(params: {
  signal?: Partial<Signal> | null;
  organizationName: string;
  companyDomain?: string | null;
  firecrawlApiKey?: string;
}): Promise<SourceDocument[]> {
  const { signal, organizationName, companyDomain, firecrawlApiKey } = params;
  const sources: SourceDocument[] = [];

  // 1. Signal article source
  if (signal) {
    let snapshot = (signal.sourceSnapshot || '').trim();
    const excerpts = parseExcerpts(signal.sourceExcerpts);

    if (!snapshot && signal.sourceUrl && /^https?:\/\//i.test(signal.sourceUrl)) {
      const crawled = await crawlArticle(
        signal.sourceUrl,
        firecrawlApiKey,
        signal.articleSummary || signal.title || ''
      );
      if (crawled.success && crawled.markdown) {
        snapshot = crawled.markdown.trim().slice(0, 6000);
      } else if (!snapshot && signal.articleSummary) {
        snapshot = `${signal.title || ''}\n\n${signal.articleSummary}`.trim();
      }
    }

    const excerptBlock = excerpts.length > 0
      ? `\n\nSaved Verbatim Excerpts:\n${excerpts.map((e) => `- "${e.quote}"`).join('\n')}`
      : '';
    const combinedArticleText = `${snapshot}${excerptBlock}`.trim() ||
      `${signal.title || organizationName}\n${signal.articleSummary || ''}`.trim();

    if (combinedArticleText) {
      let sourceLabel = 'News Signal';
      try {
        if (signal.sourceUrl && /^https?:\/\//i.test(signal.sourceUrl)) {
          sourceLabel = new URL(signal.sourceUrl).hostname.replace(/^www\./, '');
        }
      } catch {
        sourceLabel = 'News Signal';
      }

      sources.push({
        label: sourceLabel,
        url: signal.sourceUrl || '',
        date: formatDateLabel(signal.publishedAt),
        text: combinedArticleText.slice(0, 7000),
      });
    }
  }

  // 2. Target company website (graceful fallback if unreachable)
  const cleanDomain = usableCompanyDomain(companyDomain || '');
  if (cleanDomain) {
    const websiteUrl = `https://${cleanDomain}`;
    try {
      const siteCrawl = await crawlArticle(websiteUrl, firecrawlApiKey, '');
      if (siteCrawl.success && siteCrawl.markdown && siteCrawl.markdown.trim().length > 80) {
        sources.push({
          label: `${organizationName} Website (${cleanDomain})`,
          url: websiteUrl,
          date: new Date().toISOString().slice(0, 10),
          text: siteCrawl.markdown.trim().slice(0, 5000),
        });
      }
    } catch (err) {
      console.warn(`[BriefGenerator] Company website scrape skipped for ${websiteUrl}:`, err);
    }
  }

  return sources;
}

/**
 * Step C: Independent Pass 2 Verification Gate.
 * Audits Pass 1 output strictly against the raw scraped source texts.
 */
export async function runVerificationGate(params: {
  pass1Brief: Omit<GeneratedResearchBrief, 'verificationLog'>;
  sources: SourceDocument[];
  openAiApiKey?: string;
}): Promise<GeneratedResearchBrief> {
  const { pass1Brief, sources, openAiApiKey } = params;
  const notes: string[] = [];
  let checkedFacts = pass1Brief.verifiedFacts.length;
  let rejectedFacts = 0;
  let rewrittenFacts = 0;
  let rewrittenOpportunities = 0;
  let pass2Mode: 'openai' | 'deterministic' = 'deterministic';

  let candidateFacts = [...pass1Brief.verifiedFacts];
  let candidateOpportunities = [...pass1Brief.inferredOpportunities];

  // Run Pass 2 OpenAI independent audit when key is available and we have sources
  if (hasUsableOpenAiKey(openAiApiKey) && sources.length > 0) {
    try {
      const auditSystemPrompt = `You are an independent, strict fact-checking auditor.
You receive ONLY:
1. Raw primary source texts
2. A draft Research Brief (verifiedFacts + inferredOpportunities)

AUDIT RULES (STRICTLY ENFORCED):
1. For each item in verifiedFacts:
   - Verify that EVERY number, date, location, entity name, and claim in "statement" is EXPLICITLY supported by the raw source texts and its "verbatimQuote" appears in the source texts.
   - If a fact is unsupported, exaggerated, or fabricated, mark "keep": false and explain why in "reason".
   - If a fact is mostly supported but needs tightening to match the source text exactly, set "keep": true and provide a corrected "rewrittenStatement".
2. For each item in inferredOpportunities:
   - Strip any speculative accusations (e.g., NEVER allow "Company has no X", "Company lacks Y", "Company is missing Z").
   - Rewrite any accusatory phrasing into constructive framing such as "Company may benefit from reviewing X" or "Potential exposure worth evaluating around Y".

Respond with valid JSON:
{
  "factAudits": [
    { "index": 0, "keep": true, "rewrittenStatement": "optional corrected statement or null", "reason": "short audit note" }
  ],
  "opportunityAudits": [
    { "index": 0, "rewrittenRationale": "optional softened rationale or null", "rewrittenArea": "optional softened area or null" }
  ]
}`;

      const sourcesBlock = sources
        .map((s, idx) => `[SOURCE ${idx + 1}] ${s.label} (${s.url}, ${s.date}):\n${s.text.slice(0, 4500)}`)
        .join('\n\n---\n\n');

      const auditUserPrompt = `RAW SOURCE TEXTS:
${sourcesBlock}

DRAFT PASS 1 OUTPUT:
${JSON.stringify({
  verifiedFacts: candidateFacts,
  inferredOpportunities: candidateOpportunities,
})}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey!.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: auditSystemPrompt },
            { role: 'user', content: auditUserPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as {
            factAudits?: Array<{
              index: number;
              keep: boolean;
              rewrittenStatement?: string | null;
              reason?: string;
            }>;
            opportunityAudits?: Array<{
              index: number;
              rewrittenRationale?: string | null;
              rewrittenArea?: string | null;
            }>;
          };

          pass2Mode = 'openai';

          if (Array.isArray(parsed.factAudits)) {
            const auditMap = new Map(parsed.factAudits.map((a) => [a.index, a]));
            const auditedFacts: VerifiedFact[] = [];
            candidateFacts.forEach((fact, idx) => {
              const audit = auditMap.get(idx);
              if (audit && audit.keep === false) {
                rejectedFacts += 1;
                notes.push(`Pass 2 rejected fact #${idx + 1}: ${audit.reason || 'Unsupported by source text'}`);
                return;
              }
              if (audit?.rewrittenStatement && audit.rewrittenStatement.trim() !== fact.statement.trim()) {
                rewrittenFacts += 1;
                notes.push(`Pass 2 tightened fact #${idx + 1}: ${audit.reason || 'Aligned to source text'}`);
                auditedFacts.push({ ...fact, statement: audit.rewrittenStatement.trim() });
              } else {
                auditedFacts.push(fact);
              }
            });
            candidateFacts = auditedFacts;
          }

          if (Array.isArray(parsed.opportunityAudits)) {
            const oppMap = new Map(parsed.opportunityAudits.map((a) => [a.index, a]));
            candidateOpportunities = candidateOpportunities.map((opp, idx) => {
              const audit = oppMap.get(idx);
              if (!audit) return opp;
              let updated = { ...opp };
              let changed = false;
              if (audit.rewrittenArea && audit.rewrittenArea.trim() !== opp.area.trim()) {
                updated.area = audit.rewrittenArea.trim();
                changed = true;
              }
              if (audit.rewrittenRationale && audit.rewrittenRationale.trim() !== opp.rationale.trim()) {
                updated.rationale = audit.rewrittenRationale.trim();
                changed = true;
              }
              if (changed) rewrittenOpportunities += 1;
              return updated;
            });
          }
        }
      }
    } catch (err) {
      console.warn('[BriefGenerator] Pass 2 OpenAI audit failed, falling back to deterministic gate:', err);
    }
  }

  // Deterministic Verification Gate (always runs as a final safety net)
  const allowedUrls = new Set(sources.map((s) => s.url).filter(Boolean));
  const finalFacts: VerifiedFact[] = [];
  for (const fact of candidateFacts) {
    if (sources.length > 0 && !isFactGroundedInSources(fact, sources)) {
      rejectedFacts += 1;
      notes.push(`Deterministic gate rejected ungrounded claim: "${fact.statement.slice(0, 80)}"`);
      continue;
    }
    const safeUrl =
      fact.sourceUrl && (allowedUrls.size === 0 || allowedUrls.has(fact.sourceUrl))
        ? fact.sourceUrl
        : sources[0]?.url || '';
    finalFacts.push({
      ...fact,
      sourceUrl: safeUrl,
    });
  }

  const finalOpportunities: InferredOpportunity[] = candidateOpportunities.map((opp) => {
    const areaCheck = sanitizeSpeculativeText(opp.area);
    const rationaleCheck = sanitizeSpeculativeText(opp.rationale);
    if (areaCheck.changed || rationaleCheck.changed) {
      rewrittenOpportunities += 1;
      notes.push(`Sanitized speculative phrasing in opportunity "${areaCheck.text}"`);
    }
    return {
      area: areaCheck.text,
      rationale: rationaleCheck.text,
      confidence: opp.confidence === 'high' ? 'high' : 'medium',
    };
  });

  return {
    briefTitle: pass1Brief.briefTitle,
    verifiedFacts: finalFacts,
    inferredOpportunities: finalOpportunities,
    investigationQuestions: pass1Brief.investigationQuestions.slice(0, 3),
    verificationLog: {
      checkedFacts,
      keptFacts: finalFacts.length,
      rejectedFacts,
      rewrittenFacts,
      rewrittenOpportunities,
      pass2Mode,
      notes,
    },
  };
}

function buildHeuristicPass1Brief(params: {
  organizationName: string;
  signal?: Partial<Signal> | null;
  sources: SourceDocument[];
  sellerProfile: SellerProfileInput;
}): Omit<GeneratedResearchBrief, 'verificationLog'> {
  const { organizationName, signal, sources, sellerProfile } = params;
  const primarySource = sources[0];
  const excerpts = parseExcerpts(signal?.sourceExcerpts);

  const verifiedFacts: VerifiedFact[] = [];
  if (primarySource) {
    if (excerpts.length > 0) {
      for (const ex of excerpts.slice(0, 3)) {
        verifiedFacts.push({
          statement: ex.quote,
          sourceUrl: primarySource.url,
          sourceLabel: primarySource.label,
          sourceDate: primarySource.date,
          verbatimQuote: ex.quote,
        });
      }
    } else if (primarySource.text) {
      const sentences = primarySource.text
        .replace(/^#.*$/gm, '')
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 25 && s.length <= 260);
      for (const sentence of sentences.slice(0, 2)) {
        verifiedFacts.push({
          statement: sentence,
          sourceUrl: primarySource.url,
          sourceLabel: primarySource.label,
          sourceDate: primarySource.date,
          verbatimQuote: sentence,
        });
      }
    }
  }

  const offerings = [
    ...(sellerProfile.servicesOffered || []),
    ...(sellerProfile.productsOffered || []),
  ]
    .filter(Boolean)
    .slice(0, 2);
  const offeringText = offerings.length > 0 ? offerings.join(' and ') : sellerProfile.valueProp || 'commercial advisory';

  const inferredOpportunities: InferredOpportunity[] = [
    {
      area: `${offeringText} Alignment`,
      rationale: `${organizationName} may benefit from reviewing how its ${signal?.signalType || 'recent milestone'} impacts ${offeringText.toLowerCase()} requirements.`,
      confidence: 'high',
    },
    {
      area: 'Operational Scaling & Vendor Readiness',
      rationale: `Following recent organizational activity, ${organizationName} may want to evaluate whether existing partners and coverage scale with upcoming plans.`,
      confidence: 'medium',
    },
  ];

  const investigationQuestions = [
    `How is ${organizationName} prioritizing ${offeringText.toLowerCase()} as part of this ${signal?.signalType || 'recent initiative'}?`,
    `What operational or timeline constraints are top of mind for your team over the next two quarters?`,
    `Who oversees vendor evaluation and risk or service reviews as these plans roll out?`,
  ];

  return {
    briefTitle: `${organizationName} — Executive Research Brief`,
    verifiedFacts,
    inferredOpportunities,
    investigationQuestions,
  };
}

/**
 * Generates an evidence-verified Research Brief using:
 * Step A: Primary source gathering (stored snapshot/excerpts or Firecrawl + company website)
 * Step B: Pass 1 synthesis tailored to sellerProfile
 * Step C: Pass 2 independent Verification Gate
 */
export async function generateVerifiedResearchBrief(params: {
  signal?: Partial<Signal> | null;
  organizationName: string;
  companyDomain?: string | null;
  sellerProfile: SellerProfileInput;
  env: Pick<Bindings, 'OPENAI_API_KEY' | 'FIRECRAWL_API_KEY'>;
}): Promise<GeneratedResearchBrief> {
  const { signal, organizationName, companyDomain, sellerProfile, env } = params;

  // Step A: Primary Source Gathering
  const sources = await gatherPrimarySources({
    signal,
    organizationName,
    companyDomain,
    firecrawlApiKey: env.FIRECRAWL_API_KEY,
  });

  const buyerProfile = deriveBuyerProfile({
    userMission: sellerProfile.userMission || undefined,
    valueProp: sellerProfile.valueProp || undefined,
    companyDescription: sellerProfile.companyDescription || undefined,
    targetIndustries: sellerProfile.targetIndustries,
    targetRoles: sellerProfile.targetRoles,
    userIntent: sellerProfile.userIntent || undefined,
  });

  // Step B: Pass 1 - Evidence & Opportunity Synthesis
  let pass1Brief: Omit<GeneratedResearchBrief, 'verificationLog'> | null = null;

  if (hasUsableOpenAiKey(env.OPENAI_API_KEY) && sources.length > 0) {
    try {
      const systemPrompt = `You are a senior institutional research analyst preparing a 1-page Research Brief (Teardown) for a B2B seller.

STRICT EVIDENCE RULES:
1. "verifiedFacts": Extract 2-5 factual statements ONLY if directly supported by the provided primary sources.
   - Each fact MUST include a "verbatimQuote" copied word-for-word from the source text, plus the exact "sourceUrl", "sourceLabel", and "sourceDate" from the source header.
   - Never invent numbers, dates, locations, or claims.
2. "inferredOpportunities": Generate 2-3 plausible areas where the seller's offering could help based on the catalyst.
   - Frame strictly as opportunities or exposures to review (e.g., "May benefit from reviewing...", "Potential exposure around...").
   - NEVER assert internal company gaps as fact (e.g., NEVER write "Company has no X" or "Company lacks Y").
3. "investigationQuestions": Generate exactly 3 sharp, non-generic discovery questions for a decision-maker call.

Respond with valid JSON:
{
  "briefTitle": "${organizationName} — Research Brief",
  "verifiedFacts": [
    {
      "statement": "Concise factual statement",
      "sourceUrl": "https://...",
      "sourceLabel": "Source Name",
      "sourceDate": "YYYY-MM-DD",
      "verbatimQuote": "Exact sentence copied word-for-word from source"
    }
  ],
  "inferredOpportunities": [
    {
      "area": "Opportunity Area Title",
      "rationale": "Analytical assessment connecting the verified catalyst to the seller's offering",
      "confidence": "high"
    }
  ],
  "investigationQuestions": [
    "Question 1?",
    "Question 2?",
    "Question 3?"
  ]
}`;

      const sellerContext = [
        sellerProfile.organization ? `Seller Organization: ${sellerProfile.organization}` : '',
        sellerProfile.companyDescription ? `Company Description: ${sellerProfile.companyDescription}` : '',
        sellerProfile.valueProp ? `Value Proposition: ${sellerProfile.valueProp}` : '',
        sellerProfile.userMission ? `Mission: ${sellerProfile.userMission}` : '',
        sellerProfile.servicesOffered?.length ? `Services Offered: ${sellerProfile.servicesOffered.join(', ')}` : '',
        sellerProfile.productsOffered?.length ? `Products Offered: ${sellerProfile.productsOffered.join(', ')}` : '',
        `Target Buyer Profile: industries=[${buyerProfile.buyerIndustries.join(', ')}], roles=[${buyerProfile.buyerRoles.join(', ')}]`,
      ]
        .filter(Boolean)
        .join('\n');

      const sourcesBlock = sources
        .map((s, idx) => `[SOURCE ${idx + 1}] label="${s.label}" url="${s.url}" date="${s.date}"\n${s.text}`)
        .join('\n\n---\n\n');

      const userPrompt = `TARGET ORGANIZATION: ${organizationName}
${companyDomain ? `DOMAIN: ${companyDomain}` : ''}

SELLER PROFILE:
${sellerContext}

PRIMARY SOURCES:
${sourcesBlock}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY!.trim()}`,
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
          const parsed = JSON.parse(content) as Partial<Omit<GeneratedResearchBrief, 'verificationLog'>>;
          if (
            Array.isArray(parsed.verifiedFacts) &&
            Array.isArray(parsed.inferredOpportunities) &&
            Array.isArray(parsed.investigationQuestions)
          ) {
            pass1Brief = {
              briefTitle: parsed.briefTitle || `${organizationName} — Research Brief`,
              verifiedFacts: parsed.verifiedFacts.filter(
                (f): f is VerifiedFact => Boolean(f && f.statement && f.verbatimQuote)
              ),
              inferredOpportunities: parsed.inferredOpportunities
                .filter((o): o is InferredOpportunity => Boolean(o && o.area && o.rationale))
                .slice(0, 3)
                .map((o) => ({
                  area: o.area,
                  rationale: o.rationale,
                  confidence: o.confidence === 'high' ? 'high' : 'medium',
                })),
              investigationQuestions: parsed.investigationQuestions
                .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
                .slice(0, 3),
            };
          }
        }
      }
    } catch (err) {
      console.warn('[BriefGenerator] Pass 1 OpenAI synthesis failed, using heuristic fallback:', err);
    }
  }

  if (!pass1Brief) {
    pass1Brief = buildHeuristicPass1Brief({
      organizationName,
      signal,
      sources,
      sellerProfile,
    });
  }

  // Step C: Pass 2 - Independent Verification Gate
  return runVerificationGate({
    pass1Brief,
    sources,
    openAiApiKey: env.OPENAI_API_KEY,
  });
}
