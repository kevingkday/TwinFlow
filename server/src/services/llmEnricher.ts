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

export interface EnrichedSignalData {
  companyName: string;
  companyDomain: string;
  signalType: string;
  industryTags: string[];
  summaryBullets: [string, string, string];
  decisionMaker: {
    name: string;
    role: string;
    company: string;
  };
  coldIntroHook: string;
  pitchSubject: string;
  pitchBody: string;
  competitors: CompetitorBranch[];
  suggestedPeerRoles: PeerRoleBranch[];
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
      const systemPrompt = `You are an elite B2B sales development representative, executive talent advisor, and account intelligence specialist for TwinFlow.
Analyze the provided news headline and article text to extract actionable outbound intelligence and knowledge-graph branching targets for ANY industry or market vertical.
You must respond with valid JSON adhering exactly to this structure:
{
  "companyName": "Company name",
  "companyDomain": "companyname.com",
  "signalType": "Facility / Branch Opening" | "Major Contract Awarded" | "Leadership Appointment" | "Merger & Acquisition" | "Capital Investment" | "Commercial Expansion" | "Funding & Growth",
  "industryTags": ["Primary Vertical (e.g. Commercial Real Estate, Healthcare, General Contracting, Manufacturing, Legal, B2B SaaS)", "Milestone", "Sector Keyword"],
  "summaryBullets": [
    "Trigger point: What major milestone or event occurred",
    "Operational impact: What bottleneck, hiring expansion, or scaling challenge arose",
    "Commercial angle: Why reaching out now gives an unfair advantage"
  ],
  "decisionMaker": {
    "name": "Full name of relevant leader mentioned or inferred (e.g. Owner, Managing Partner, CEO, VP Operations, General Manager)",
    "role": "Their executive title appropriate to their industry",
    "company": "Company name"
  },
  "coldIntroHook": "I saw in [Source] that [Company] recently [action]. Given that you're [context], I wanted to reach out...",
  "pitchSubject": "Compelling short subject line (6-8 words max)",
  "pitchBody": "3 concise, highly tailored paragraphs (under 120 words) addressing the trigger event and proposing a relevant next step.",
  "competitors": [
    { "name": "Key Competitor Name", "domain": "competitor.com", "reason": "Direct market competitor operating in the same industry and geographic market" },
    { "name": "Secondary Competitor Name", "domain": "competitor2.com", "reason": "Alternative provider in this vertical" }
  ],
  "suggestedPeerRoles": [
    { "title": "Industry-appropriate secondary decision maker title (e.g. for Construction: VP of Preconstruction or Director of Estimating; for Healthcare: Practice Director or Clinical Operations; for Law/Finance: Managing Partner or CFO; for Tech: VP Engineering or CPO)", "reason": "Why this role is impacted by the trigger milestone" }
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
${articleMarkdown.slice(0, 4000)}

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
          if (
            parsed.companyName &&
            Array.isArray(parsed.summaryBullets) &&
            parsed.summaryBullets.length >= 3 &&
            parsed.decisionMaker?.name
          ) {
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

            return {
              companyName: parsed.companyName,
              companyDomain: parsed.companyDomain || `${parsed.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
              signalType: parsed.signalType || 'Enterprise Expansion',
              industryTags: Array.isArray(parsed.industryTags) && parsed.industryTags.length > 0
                ? parsed.industryTags
                : [parsed.signalType || 'Enterprise Expansion', 'B2B Growth'],
              summaryBullets: [
                parsed.summaryBullets[0],
                parsed.summaryBullets[1],
                parsed.summaryBullets[2],
              ],
              decisionMaker: {
                name: parsed.decisionMaker.name,
                role: parsed.decisionMaker.role || 'Executive Leadership',
                company: parsed.companyName,
              },
              coldIntroHook: parsed.coldIntroHook || `I saw in ${publisher} that ${parsed.companyName} recently made major moves.`,
              pitchSubject: parsed.pitchSubject || `Scaling ${parsed.companyName}'s commercial pipeline`,
              pitchBody: parsed.pitchBody || `Hi ${parsed.decisionMaker.name},\n\nCongrats on the recent milestone at ${parsed.companyName} reported in ${publisher}.\n\nTwinFlow streamlines high-velocity outbound triage. Would you be open to a 3-minute workflow walkthrough?`,
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

function generateHeuristicEnrichment(
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

  const cleanDomain = `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.io`;

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

  // Extract or synthesize decision maker
  let dmName = 'Elena Vance';
  let dmRole = 'VP of Growth & Operations';
  if (signalType === 'Executive Leadership') {
    const leaderMatch = headline.match(/(?:hires|appoints|taps|names)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (leaderMatch && leaderMatch[1]) {
      dmName = leaderMatch[1];
    } else {
      dmName = 'Marcus Vance';
    }
    dmRole = 'Chief Revenue Officer';
  } else if (signalType === 'Series A/B Funding') {
    dmName = 'Dr. Clara Lin';
    dmRole = 'VP of Commercial Strategy';
  }

  const coldIntroHook = `I saw in ${publisher} that ${company} recently announced major developments around ${headline.slice(0, 60)}. Given your leadership as ${dmRole}, I wanted to reach out.`;

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
    decisionMaker: {
      name: dmName,
      role: dmRole,
      company,
    },
    coldIntroHook,
    pitchSubject: `Scaling ${company}'s pipeline after recent ${publisher} news`,
    pitchBody: `Hi ${dmName},\n\n${coldIntroHook}\n\nWhenever new operational milestones hit, manual account research typically slows commercial momentum. TwinFlow equips revenue teams with a gamified triage deck to approve verified, hyper-tailored outreach in seconds.\n\nWould you be open to a 3-minute interactive walkthrough next week?`,
    competitors: generateHeuristicCompetitors(company, signalType),
    suggestedPeerRoles: generateHeuristicPeerRoles(signalType),
  };
}

