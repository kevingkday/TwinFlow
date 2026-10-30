import type { LeadCardData } from '../types/lead';

export const INITIAL_LEADS: LeadCardData[] = [
  {
    id: 'sig-001',
    headline: 'HyperScale AI Closes $42M Series B to Accelerate Enterprise Synthetic Data Engine',
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
    decisionMaker: {
      id: 'dm-001',
      name: 'Elena Rostova',
      title: 'VP of Growth & Revenue Operations',
      company: 'HyperScale AI',
      email: 'elena.rostova@hyperscale.ai',
      linkedinUrl: 'https://linkedin.com/in/elena-rostova-growth',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
    },
    emailDraft: {
      subject: 'Scaling HyperScale\'s GTM outbound after the $42M Series B',
      body: `Hi Elena,\n\nSaw TechCrunch's report on your $42M Series B — huge milestone for HyperScale AI!\n\nAs you ramp up your commercial team to 45 reps, automated data pipeline enrichment is typically where SDR velocity gets bogged down. TwinFlow hooks right into your news signals and auto-generates verified prospect pitches before your competitors even spot the press release.\n\nWould you be open to seeing a 3-minute interactive teardown of how 3 peers in enterprise synthetic data are using this today?`,
      cta: 'Book 15-min workflow review',
      estimatedReadTime: '35 sec read'
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
    decisionMaker: {
      id: 'dm-002',
      name: 'Marcus Vance',
      title: 'Chief Commercial Officer',
      company: 'FinMatrix',
      email: 'm.vance@finmatrix.io',
      linkedinUrl: 'https://linkedin.com/in/marcus-vance-fintech',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    },
    emailDraft: {
      subject: 'Congrats on the CCO role at FinMatrix + trigger-based sales orchestration',
      body: `Hi Marcus,\n\nCongratulations on stepping in as Chief Commercial Officer at FinMatrix! Bringing that Stripe pedigree to cross-border logistics infrastructure is a massive move.\n\nWhenever new commercial leadership enters, tightening the signal-to-outreach feedback loop is job #1. TwinFlow automatically converts merchant regulatory announcements into ready-to-approve hyper-personalized pitch decks.\n\nOpen to taking a quick look at a live feed calibrated for FinMatrix's target accounts?`,
      cta: 'Explore FinMatrix Live Feed',
      estimatedReadTime: '40 sec read'
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
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    },
    emailDraft: {
      subject: 'Partner ecosystem orchestration for Nexus\'s 14 new distribution hubs',
      body: `Hi Devin,\n\nSaw the announcement regarding Nexus Robotics\'s multi-million dollar freight rollout across the Midwest — stellar momentum.\n\nWith 14 distribution hubs onboarding simultaneously, your integration partner pipeline will need automated triage to separate top-tier carriers from noise. TwinFlow gives your partnership directors a gamified mobile queue to review and approve tailored integrations in seconds.\n\nCould I send over a quick 2-page playbook on how freight tech leaders handle this?`,
      cta: 'Request 2-page Carrier Playbook',
      estimatedReadTime: '30 sec read'
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
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
    },
    emailDraft: {
      subject: 'Protecting CognitiveBio\'s molecular IP during compute cluster scaling',
      body: `Dr. Lin,\n\nCongratulations on the $28M round announced with ARCH and DCVC — thrilling step forward for computational peptide discovery.\n\nAs you stand up the Boston research facility, sharing preliminary generative models with external lab partners usually creates massive data-governance friction. We built TwinFlow\'s secure enclave pitching specifically for high-stakes biotech and IP transfer agreements.\n\nWould you have 10 minutes next Tuesday to review how we isolate proprietary molecular weights?`,
      cta: 'View Security Whitepaper',
      estimatedReadTime: '35 sec read'
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
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
    },
    emailDraft: {
      subject: 'Outreach strategy for regional bank CISOs following CloudVault\'s FedRAMP status',
      body: `Hi Julian,\n\nExciting news on the CloudVault GA launch and FedRAMP Ready certification today!\n\nPitching regional bank security leaders on Kubernetes migration is notoriously high-friction without razor-sharp relevance. TwinFlow scans FDIC filings and executive interviews, generating compliance-first pitch angles tailored to each bank\'s existing audits.\n\nWould it be helpful to see a sample queue targeting 5 New England regional banking CISOs?`,
      cta: 'Preview Bank CISO Queue',
      estimatedReadTime: '30 sec read'
    },
    rawSignalSummary: 'GA product launch with compliance milestone: immediate green light to prospect regulated financial enterprises.',
    tags: ['Kubernetes', 'Cybersecurity', 'FedRAMP', 'Fintech Infrastructure']
  }
];
