import { publishedAtFromHoursAgo } from '../services/publishedAt';

export interface DemoSignalItem {
  id: string;
  parentSignalId?: string | null;
  title: string;
  sourceUrl: string;
  publishedAt: string;
  summaryBullets: string[];
  articleSummary?: string | null;
  companyName: string;
  signalType: string;
  industryTags?: string[];
  status: 'queued' | 'approved' | 'dismissed';
  contacts: Array<{
    id: string;
    name: string;
    title: string;
    company: string;
    email?: string | null;
    linkedinUrl?: string | null;
    avatarUrl?: string | null;
    isEnriched?: boolean;
  }>;
  contact: {
    id: string;
    name: string;
    title: string;
    company: string;
    email?: string | null;
    linkedinUrl?: string | null;
    avatarUrl?: string | null;
    isEnriched?: boolean;
  } | null;
  outreachDraft: {
    id: string;
    subject: string;
    body: string;
    status: 'draft' | 'sent';
  } | null;
}

export const DEMO_SIGNALS: DemoSignalItem[] = [
  {
    id: 'demo-sig-001',
    title: 'Apex Commercial Partners Breaks Ground on $65M Logistics Distribution Facility in Dallas',
    sourceUrl: 'Example: Commercial Property Executive (not a live link)',
    publishedAt: '',
    summaryBullets: [
      'Apex Commercial broke ground on a new 450,000 sq ft regional logistics distribution center in Dallas.',
      'Active capital expenditure allocated across engineering, infrastructure, equipment, and facility technology.',
      'Immediate commercial window to present offerings before primary vendor agreements are locked.',
    ],
    articleSummary:
      'Apex Commercial Partners has initiated construction on a $65M high-throughput logistics distribution center in Dallas, TX. The facility represents major regional expansion and active vendor procurement across engineering, logistics systems, and commercial operations.',
    companyName: 'Apex Commercial',
    signalType: 'Commercial Expansion',
    industryTags: ['Commercial Real Estate', 'Industrial Logistics', 'Facility Expansion', 'Dallas-Fort Worth'],
    status: 'queued',
    contact: {
      id: 'demo-dm-001',
      name: 'Dr. Clara Lin',
      title: 'VP of Commercial Strategy & Development',
      company: 'Apex Commercial',
      email: 'c.lin@apexcommercial.com',
      linkedinUrl: 'https://linkedin.com/in/clara-lin-commercial',
      avatarUrl: null,
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
        avatarUrl: null,
        isEnriched: true,
      },
      {
        id: 'demo-dm-001-b',
        name: 'David Reynolds',
        title: 'Director of Facility Operations',
        company: 'Apex Commercial',
        email: 'd.reynolds@apexcommercial.com',
        linkedinUrl: 'https://linkedin.com/in/david-reynolds-ops',
        avatarUrl: null,
        isEnriched: true,
      },
    ],
    outreachDraft: {
      id: 'demo-draft-001',
      subject: 'quick question re: Apex Commercial',
      body: `Hi Dr. Lin,\n\nI saw the recent article in Commercial Property Executive regarding Apex Commercial breaking ground on the new Dallas logistics distribution center. Given what we do in commercial services, would there be an opportunity to connect and see if we can present our offerings for your upcoming plans?\n\nBest,\nAlex Morgan`,
      status: 'draft',
    },
  },
  {
    id: 'demo-sig-002',
    title: 'HyperScale Technologies Closes $42M Series B to Accelerate Commercial Expansion',
    sourceUrl: 'Example: TechCrunch (not a live link)',
    publishedAt: '',
    summaryBullets: [
      'Closed $42M Series B funding led by premier institutional investors to expand regional enterprise accounts.',
      'Ramping commercial headcount rapidly with dedicated budget for software, services, and operational tools.',
      'Fast-growing operational scale creates immediate demand for external partners and commercial solutions.',
    ],
    articleSummary:
      'HyperScale Technologies announced a $42M Series B round to expand enterprise market share across North America. Capital is allocated toward tripling regional commercial capacity and establishing partner vendor infrastructure.',
    companyName: 'HyperScale Technologies',
    signalType: 'Series A/B Funding',
    industryTags: ['Enterprise B2B', 'Series B', 'High Growth', 'Commercial Expansion'],
    status: 'queued',
    contact: {
      id: 'demo-dm-002',
      name: 'Elena Rostova',
      title: 'VP of Growth & Operations',
      company: 'HyperScale Technologies',
      email: 'elena.rostova@hyperscaletech.com',
      linkedinUrl: 'https://linkedin.com/in/elena-rostova-growth',
      avatarUrl: null,
      isEnriched: true,
    },
    contacts: [
      {
        id: 'demo-dm-002',
        name: 'Elena Rostova',
        title: 'VP of Growth & Operations',
        company: 'HyperScale Technologies',
        email: 'elena.rostova@hyperscaletech.com',
        linkedinUrl: 'https://linkedin.com/in/elena-rostova-growth',
        avatarUrl: null,
        isEnriched: true,
      },
      {
        id: 'demo-dm-002-b',
        name: 'Alexei Ivanov',
        title: 'Chief Executive Officer',
        company: 'HyperScale Technologies',
        email: 'alexei@hyperscaletech.com',
        linkedinUrl: 'https://linkedin.com/in/alexei-ivanov',
        avatarUrl: null,
        isEnriched: true,
      },
    ],
    outreachDraft: {
      id: 'demo-draft-002',
      subject: 'quick question re: HyperScale',
      body: `Hi Elena,\n\nI saw the recent article in TechCrunch regarding HyperScale's $42M Series B expansion announcement. Given our work in commercial solutions, would there be an opportunity to connect and see if we can present our services for your upcoming milestones?\n\nBest,\nAlex Morgan`,
      status: 'draft',
    },
  },
  {
    id: 'demo-sig-003',
    title: 'FinMatrix Appoints Former Stripe Executive Marcus Vance as Chief Commercial Officer',
    sourceUrl: 'Example: Bloomberg (not a live link)',
    publishedAt: '',
    summaryBullets: [
      'Marcus Vance joins FinMatrix as CCO following executive leadership roles at Stripe.',
      'Mandated to review partner integrations and build out commercial GTM operations.',
      'Executive leadership transitions represent peak receptivity for establishing new vendor relationships.',
    ],
    articleSummary:
      'FinMatrix has recruited former Stripe enterprise executive Marcus Vance as Chief Commercial Officer. Vance will oversee nationwide commercial partner growth, technology modernization, and strategic enterprise vendor procurement.',
    companyName: 'FinMatrix',
    signalType: 'Executive Leadership',
    industryTags: ['Executive Appointment', 'Fintech', 'Commercial Strategy', 'C-Suite Trigger'],
    status: 'queued',
    contact: {
      id: 'demo-dm-003',
      name: 'Marcus Vance',
      title: 'Chief Commercial Officer',
      company: 'FinMatrix',
      email: 'm.vance@finmatrix.io',
      linkedinUrl: 'https://linkedin.com/in/marcus-vance-fintech',
      avatarUrl: null,
      isEnriched: true,
    },
    contacts: [
      {
        id: 'demo-dm-003',
        name: 'Marcus Vance',
        title: 'Chief Commercial Officer',
        company: 'FinMatrix',
        email: 'm.vance@finmatrix.io',
        linkedinUrl: 'https://linkedin.com/in/marcus-vance-fintech',
        avatarUrl: null,
        isEnriched: true,
      },
      {
        id: 'demo-dm-003-b',
        name: 'Nadia Patel',
        title: 'Chief Executive Officer',
        company: 'FinMatrix',
        email: 'n.patel@finmatrix.io',
        linkedinUrl: 'https://linkedin.com/in/nadia-patel',
        avatarUrl: null,
        isEnriched: true,
      },
    ],
    outreachDraft: {
      id: 'demo-draft-003',
      subject: 'quick question re: FinMatrix',
      body: `Hi Marcus,\n\nI saw the recent report in Bloomberg regarding your appointment as Chief Commercial Officer at FinMatrix. Given our work in commercial services, would there be an opportunity to connect and see if we can present our offerings for your upcoming initiatives?\n\nBest,\nAlex Morgan`,
      status: 'draft',
    },
  },
  {
    id: 'demo-sig-004',
    title: 'Nexus Robotics Inks $18M Supply Chain Deal Across 14 Regional Distribution Hubs',
    sourceUrl: 'Example: VentureBeat (not a live link)',
    publishedAt: '',
    summaryBullets: [
      'Awarded major multi-site deployment covering 14 high-throughput logistics distribution hubs.',
      'Active expansion requiring partner vendor coordination, systems integration, and field support.',
      'Rapid deployment schedule creates open bidding for specialized commercial service providers.',
    ],
    articleSummary:
      'Nexus Robotics has closed an $18M contract deploying warehouse automation across 14 logistics facilities. The contract triggers substantial sub-vendor onboarding and commercial integration demands.',
    companyName: 'Nexus Robotics',
    signalType: 'Major Contract Awarded',
    industryTags: ['Supply Chain', 'Automation', 'Logistics Infrastructure', 'Commercial Rollout'],
    status: 'queued',
    contact: {
      id: 'demo-dm-004',
      name: 'Devin Thorne',
      title: 'Head of Technology Partnerships',
      company: 'Nexus Robotics',
      email: 'devin@nexusrobotics.ai',
      linkedinUrl: 'https://linkedin.com/in/devin-thorne-robotics',
      avatarUrl: null,
      isEnriched: true,
    },
    contacts: [
      {
        id: 'demo-dm-004',
        name: 'Devin Thorne',
        title: 'Head of Technology Partnerships',
        company: 'Nexus Robotics',
        email: 'devin@nexusrobotics.ai',
        linkedinUrl: 'https://linkedin.com/in/devin-thorne-robotics',
        avatarUrl: null,
        isEnriched: true,
      },
      {
        id: 'demo-dm-004-b',
        name: 'Sarah Jenkins',
        title: 'VP of Field Operations',
        company: 'Nexus Robotics',
        email: 's.jenkins@nexusrobotics.ai',
        linkedinUrl: 'https://linkedin.com/in/sarah-jenkins',
        avatarUrl: null,
        isEnriched: true,
      },
    ],
    outreachDraft: {
      id: 'demo-draft-004',
      subject: 'quick question re: Nexus Robotics',
      body: `Hi Devin,\n\nI saw the recent article in VentureBeat regarding Nexus Robotics's freight deployment across 14 distribution hubs. Given our work in commercial vendor solutions, would there be an opportunity to connect and see if we can present our services for your upcoming plans?\n\nBest,\nAlex Morgan`,
      status: 'draft',
    },
  },
  {
    id: 'demo-sig-005',
    title: 'CloudVault Systems Unveils Enterprise Security Architecture for Multi-Region Institutions',
    sourceUrl: 'Example: SiliconANGLE (not a live link)',
    publishedAt: '',
    summaryBullets: [
      'Announced general availability of enterprise zero-trust infrastructure for regulated organizations.',
      'Achieved key enterprise compliance certifications ahead of annual RFP and vendor selection cycles.',
      'Mobilizing regional channel partners and commercial service teams to expand footprint.',
    ],
    articleSummary:
      'CloudVault Systems launched its flagship enterprise security platform for regulated multi-region institutions. The rollout is accompanied by an aggressive commercial expansion targeting top regional enterprises.',
    companyName: 'CloudVault Systems',
    signalType: 'Product Launch',
    industryTags: ['Enterprise Infrastructure', 'Cybersecurity', 'Compliance', 'Product Launch'],
    status: 'queued',
    contact: {
      id: 'demo-dm-005',
      name: 'Julian Sterling',
      title: 'VP of Product Marketing & Strategy',
      company: 'CloudVault Systems',
      email: 'j.sterling@cloudvault.tech',
      linkedinUrl: 'https://linkedin.com/in/julian-sterling-k8s',
      avatarUrl: null,
      isEnriched: true,
    },
    contacts: [
      {
        id: 'demo-dm-005',
        name: 'Julian Sterling',
        title: 'VP of Product Marketing & Strategy',
        company: 'CloudVault Systems',
        email: 'j.sterling@cloudvault.tech',
        linkedinUrl: 'https://linkedin.com/in/julian-sterling-k8s',
        avatarUrl: null,
        isEnriched: true,
      },
      {
        id: 'demo-dm-005-b',
        name: 'Maya Lin',
        title: 'Director of Strategic Alliances',
        company: 'CloudVault Systems',
        email: 'm.lin@cloudvault.tech',
        linkedinUrl: 'https://linkedin.com/in/maya-lin',
        avatarUrl: null,
        isEnriched: true,
      },
    ],
    outreachDraft: {
      id: 'demo-draft-005',
      subject: 'quick question re: CloudVault',
      body: `Hi Julian,\n\nI saw the recent article in SiliconANGLE regarding CloudVault's enterprise security architecture release. Given our work in commercial solutions, would there be an opportunity to connect and see if we can present our services for your upcoming initiatives?\n\nBest,\nAlex Morgan`,
      status: 'draft',
    },
  },
];

const DEMO_PUBLISHED_HOURS_AGO = [2, 4, 6, 8, 12];

/**
 * Guest deck payload. Publication times are computed on each request so a
 * module-init clock at the Unix epoch cannot freeze every card on 1969-12-31.
 * Article fields are plain-text examples, not links.
 */
export function publicDemoSignals(): DemoSignalItem[] {
  return DEMO_SIGNALS.filter((signal) => signal.id.startsWith('demo-')).map((signal, index) => ({
    ...signal,
    contact: signal.contact ? { ...signal.contact } : null,
    contacts: signal.contacts.map((contact) => ({ ...contact })),
    outreachDraft: signal.outreachDraft ? { ...signal.outreachDraft } : null,
    publishedAt: publishedAtFromHoursAgo(DEMO_PUBLISHED_HOURS_AGO[index] ?? 2),
  }));
}

