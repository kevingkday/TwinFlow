import type { LeadCardData } from '../types/lead';

export const INITIAL_LEADS: LeadCardData[] = [
  {
    id: 'demo-sig-001',
    headline: 'Apex Commercial Partners Breaks Ground on $65M Logistics Distribution Facility in Dallas',
    source: 'Commercial Property Executive',
    sourceUrl: 'https://cpexecutive.com/apex-commercial-dallas-logistics',
    publishedAgo: '2h ago',
    category: 'Commercial Expansion',
    fitScore: 96,
    summaryBullets: [
      'Apex Commercial broke ground on a new 450,000 sq ft regional logistics distribution center in Dallas.',
      'Active capital expenditure allocated across engineering, infrastructure, equipment, and facility technology.',
      'Immediate commercial window to present offerings before primary vendor agreements are locked.',
    ],
    articleSummary:
      'Apex Commercial Partners has initiated construction on a $65M high-throughput logistics distribution center in Dallas, TX. The facility represents major regional expansion and active vendor procurement across engineering, logistics systems, and commercial operations.',
    decisionMaker: {
      id: 'demo-dm-001',
      name: 'Dr. Clara Lin',
      title: 'VP of Commercial Strategy & Development',
      company: 'Apex Commercial',
      email: 'c.lin@apexcommercial.com',
      linkedinUrl: 'https://linkedin.com/in/clara-lin-commercial',
      isEnriched: true,
    },
    contacts: [
      {
        id: 'demo-dm-001',
        name: 'Dr. Clara Lin',
        title: 'VP of Commercial Strategy & Development',
        company: 'Apex Commercial',
        email: 'c.lin@apexcommercial.com',
        linkedinUrl: 'https://linkedin.com/in/clara-lin-commercial',
        isEnriched: true,
      },
      {
        id: 'demo-dm-001-b',
        name: 'David Reynolds',
        title: 'Director of Facility Operations',
        company: 'Apex Commercial',
        email: 'd.reynolds@apexcommercial.com',
        linkedinUrl: 'https://linkedin.com/in/david-reynolds-ops',
        isEnriched: true,
      },
    ],
    emailDraft: {
      subject: 'quick question re: Apex Commercial',
      body: `Hi Dr. Lin,\n\nI saw the recent article in Commercial Property Executive regarding Apex Commercial breaking ground on the new Dallas logistics distribution center. Given what we do in commercial services, would there be an opportunity to connect and see if we can present our offerings for your upcoming plans?\n\nBest,\nAlex Morgan`,
      cta: 'Connect re: offerings',
      estimatedReadTime: '15 sec read',
    },
    rawSignalSummary: 'Apex Commercial broke ground on a $65M regional logistics facility in Dallas, opening vendor opportunities.',
    tags: ['Commercial Real Estate', 'Industrial Logistics', 'Facility Expansion', 'Dallas-Fort Worth'],
  },
  {
    id: 'sig-001',
    headline: 'HyperScale AI Closes $42M Series B to Accelerate Enterprise Commercial Expansion',
    source: 'TechCrunch',
    sourceUrl: 'https://techcrunch.com/2026/hyperscale-ai-series-b',
    publishedAgo: '2h ago',
    category: 'Series A/B Funding',
    fitScore: 98,
    summaryBullets: [
      'Secured $42M led by Lightspeed & Andreessen Horowitz to scale their automated model fine-tuning stack.',
      'Expanding commercial GTM team from 15 to 45 over the next two quarters across North America and EMEA.',
      'Current outbound outreach tech stack is struggling with lead verification latency across regulated enterprise clients.'
    ],
    articleSummary: 'HyperScale AI has raised $42M in Series B funding led by Lightspeed and a16z to expand synthetic data fine-tuning capabilities. The capital will fund a tripling of its commercial GTM team from 15 to 45 across North America and EMEA over the next two quarters.',
    decisionMaker: {
      id: 'dm-001',
      name: 'Elena Rostova',
      title: 'VP of Growth & Revenue Operations',
      company: 'HyperScale AI',
      email: 'elena.rostova@hyperscale.ai',
      linkedinUrl: 'https://linkedin.com/in/elena-rostova-growth',
      isEnriched: true,
    },
    contacts: [
      {
        id: 'dm-001',
        name: 'Elena Rostova',
        title: 'VP of Growth & Revenue Operations',
        company: 'HyperScale AI',
        email: 'elena.rostova@hyperscale.ai',
        linkedinUrl: 'https://linkedin.com/in/elena-rostova-growth',
        isEnriched: true,
      },
      {
        id: 'dm-001-b',
        name: 'Alexei Ivanov',
        title: 'Co-Founder & Chief Executive Officer',
        company: 'HyperScale AI',
        email: undefined,
        linkedinUrl: 'https://linkedin.com/in/alexei-ivanov-hyperscale',
        isEnriched: false,
      },
      {
        id: 'dm-001-c',
        name: 'Sarah Chen',
        title: 'Head of Enterprise Sales & GTM',
        company: 'HyperScale AI',
        email: undefined,
        linkedinUrl: undefined,
        isEnriched: false,
      },
    ],
    emailDraft: {
      subject: 'quick question re: HyperScale AI',
      body: `Hi Elena,\n\nI saw the recent article in TechCrunch regarding HyperScale AI's $42M Series B announcement. Given our work in commercial services, would there be an opportunity to connect and see if we can present our offerings for your upcoming plans?\n\nBest,`,
      cta: 'Connect re: offerings',
      estimatedReadTime: '15 sec read'
    },
    rawSignalSummary: 'HyperScale AI announced $42M in fresh Series B capital with plans to triple sales engineering and revenue operations within 180 days.',
    tags: ['Synthetic Data', 'High Hiring Velocity', 'Series B', 'Enterprise B2B']
  },
  {
    id: 'sig-002',
    headline: 'FinMatrix Appoints Former Stripe Exec Marcus Vance as Chief Commercial Officer',
    source: 'Bloomberg Technology',
    sourceUrl: 'https://bloomberg.com/news/finmatrix-appoints-cco',
    publishedAgo: '4h ago',
    category: 'Executive Leadership',
    fitScore: 94,
    summaryBullets: [
      'Marcus Vance joins FinMatrix as CCO following 6 years leading Stripe\'s multi-currency enterprise revenue expansion.',
      'Mandated to launch instant reconciliation APIs for cross-border logistics and merchant merchant-of-record services.',
      'Active budget allocated for real-time trigger-based outbound pipeline tools to modernize legacy sales cycles.'
    ],
    articleSummary: 'FinMatrix has recruited former Stripe enterprise executive Marcus Vance as Chief Commercial Officer to spearhead cross-border logistics reconciliation APIs and drive enterprise fintech sales modernization.',
    decisionMaker: {
      id: 'dm-002',
      name: 'Marcus Vance',
      title: 'Chief Commercial Officer',
      company: 'FinMatrix',
      email: 'm.vance@finmatrix.io',
      linkedinUrl: 'https://linkedin.com/in/marcus-vance-fintech',
      isEnriched: true,
    },
    contacts: [
      {
        id: 'dm-002',
        name: 'Marcus Vance',
        title: 'Chief Commercial Officer',
        company: 'FinMatrix',
        email: 'm.vance@finmatrix.io',
        linkedinUrl: 'https://linkedin.com/in/marcus-vance-fintech',
        isEnriched: true,
      },
      {
        id: 'dm-002-b',
        name: 'Nadia Patel',
        title: 'Chief Executive Officer & Founder',
        company: 'FinMatrix',
        email: undefined,
        linkedinUrl: 'https://linkedin.com/in/nadia-patel-finmatrix',
        isEnriched: false,
      },
      {
        id: 'dm-002-c',
        name: 'David Zhao',
        title: 'VP of Product Infrastructure',
        company: 'FinMatrix',
        email: undefined,
        linkedinUrl: undefined,
        isEnriched: false,
      },
    ],
    emailDraft: {
      subject: 'quick question re: FinMatrix',
      body: `Hi Marcus,\n\nI saw the recent report in Bloomberg regarding your appointment as Chief Commercial Officer at FinMatrix. Given our work in commercial services, would there be an opportunity to connect and see if we can present our services for your upcoming initiatives?\n\nBest,`,
      cta: 'Connect re: offerings',
      estimatedReadTime: '15 sec read'
    },
    rawSignalSummary: 'Executive transition trigger: New CCO appointed with dedicated mandate to rebuild commercial pipeline orchestration within Q1-Q2.',
    tags: ['Fintech', 'C-Suite Trigger', 'Cross-Border Payments', 'High Budget']
  },
  {
    id: 'sig-003',
    headline: 'Nexus Robotics Inks $18M Supply Chain Deal with 3 Global Freight Carriers',
    source: 'VentureBeat',
    sourceUrl: 'https://venturebeat.com/nexus-robotics-freight-deal',
    publishedAgo: '6h ago',
    category: 'Enterprise Expansion',
    fitScore: 91,
    summaryBullets: [
      'Deployed autonomous warehouse sorting fleets across 14 logistics distribution hubs in the Midwest.',
      'Initiating pilot expansions for air cargo handling, requiring automated carrier integration workflows.',
      'Looking for vendor partners who can support high-throughput, ISO-27001 compliant integrations.'
    ],
    decisionMaker: {
      id: 'dm-003',
      name: 'Devin Thorne',
      title: 'Head of Global Technology Partnerships',
      company: 'Nexus Robotics',
      email: 'devin@nexusrobotics.ai',
      linkedinUrl: 'https://linkedin.com/in/devin-thorne-robotics',
    },
    emailDraft: {
      subject: 'quick question re: Nexus Robotics',
      body: `Hi Devin,\n\nI saw the recent article in VentureBeat regarding Nexus Robotics's freight deployment across 14 distribution hubs. Given our work in commercial vendor solutions, would there be an opportunity to connect and see if we can present our services for your upcoming plans?\n\nBest,`,
      cta: 'Connect re: offerings',
      estimatedReadTime: '15 sec read'
    },
    rawSignalSummary: 'Contract award & warehouse expansion: high volume supply chain deployment creates immediate integration partner demands.',
    tags: ['Robotics', 'Supply Chain', 'Partnerships', 'Enterprise Expansion']
  },
  {
    id: 'sig-004',
    headline: 'CognitiveBio Raises $28M to Pioneer LLM-Driven Peptide Synthesis & Drug Discovery',
    source: 'BioTech Insider',
    sourceUrl: 'https://biotechinsider.com/cognitivebio-series-a',
    publishedAgo: '8h ago',
    category: 'AI Infrastructure',
    fitScore: 89,
    summaryBullets: [
      'Backed by ARCH Venture Partners and DCVC to build proprietary generative models for molecular biology.',
      'Establishing new research & laboratory compute center in Boston biotech corridor.',
      'Actively vetting enterprise security tooling for pharma IP collaboration agreements.'
    ],
    decisionMaker: {
      id: 'dm-004',
      name: 'Dr. Sarah Lin',
      title: 'Chief Scientific Officer & Co-Founder',
      company: 'CognitiveBio',
      email: 's.lin@cognitivebio.health',
      linkedinUrl: 'https://linkedin.com/in/dr-sarah-lin-bio',
    },
    emailDraft: {
      subject: 'quick question re: CognitiveBio',
      body: `Hi Sarah,\n\nI saw the recent article in BioTech Insider regarding CognitiveBio's $28M funding round. Given our work in commercial services, would there be an opportunity to connect and see if we can present our offerings for your upcoming milestones?\n\nBest,`,
      cta: 'Connect re: offerings',
      estimatedReadTime: '15 sec read'
    },
    rawSignalSummary: 'Biotech seed/Series A breakout: substantial lab compute investment with strict IP governance requirements.',
    tags: ['BioTech', 'Drug Discovery', 'IP Security', 'Deep Tech']
  },
  {
    id: 'sig-005',
    headline: 'CloudVault Unveils Zero-Trust Kubernetes Mesh for Multi-Cloud Financial Institutions',
    source: 'SiliconANGLE',
    sourceUrl: 'https://siliconangle.com/cloudvault-kubernetes-mesh',
    publishedAgo: '12h ago',
    category: 'Product Launch',
    fitScore: 95,
    summaryBullets: [
      'Released general availability of their audited zero-trust sidecar proxy for regulated workloads.',
      'Achieved SOC 2 Type II and FedRAMP Ready status ahead of federal banking vendor RFP cycle.',
      'Targeting top 50 regional US banks undergoing cloud migration away from legacy mainframes.'
    ],
    decisionMaker: {
      id: 'dm-005',
      name: 'Julian Sterling',
      title: 'VP of Product Marketing & Strategy',
      company: 'CloudVault Technologies',
      email: 'j.sterling@cloudvault.tech',
      linkedinUrl: 'https://linkedin.com/in/julian-sterling-k8s',
    },
    emailDraft: {
      subject: 'quick question re: CloudVault',
      body: `Hi Julian,\n\nI saw the recent article in SiliconANGLE regarding CloudVault's zero-trust Kubernetes release. Given our work in commercial solutions, would there be an opportunity to connect and see if we can present our services for your upcoming initiatives?\n\nBest,`,
      cta: 'Connect re: offerings',
      estimatedReadTime: '15 sec read'
    },
    rawSignalSummary: 'GA product launch with compliance milestone: immediate green light to prospect regulated financial enterprises.',
    tags: ['Kubernetes', 'Cybersecurity', 'FedRAMP', 'Fintech Infrastructure']
  }
];
