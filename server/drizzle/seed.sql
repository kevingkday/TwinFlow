-- TwinFlow Local Seed Data
-- Inserts a default operator user and 3 high-impact business signals with linked contacts and outreach drafts.

INSERT OR REPLACE INTO `users` (`id`, `email`, `ghl_subaccount_id`, `credit_balance`, `streak_count`, `total_points`, `created_at`, `updated_at`)
VALUES (
  'usr_default',
  'operator@twinflow.ai',
  'ghl_sub_live_9921',
  500,
  3,
  150,
  '2026-10-25T08:00:00Z',
  '2026-10-25T08:00:00Z'
);

-- Signal 1
INSERT OR REPLACE INTO `signals` (`id`, `user_id`, `title`, `source_url`, `published_at`, `summary_bullets`, `company_name`, `signal_type`, `status`, `created_at`, `updated_at`)
VALUES (
  'sig_001',
  'usr_default',
  'Aethon Dynamics Closes $48M Series B to Modernize Defense Logistics Robotics',
  'https://techcrunch.com/2026/aethon-dynamics-series-b',
  '2026-10-25T08:30:00Z',
  '["Secured $48M led by Founders Fund to scale autonomous depot transport systems across NATO-compliant hubs.","Expanding engineering and operations team by 75+ members across Washington DC and Berlin.","Urgent need for automated vendor onboarding to eliminate a 45-day clearance bottleneck."]',
  'Aethon Dynamics',
  'Series B Funding',
  'queued',
  '2026-10-25T08:30:00Z',
  '2026-10-25T08:30:00Z'
);

INSERT OR REPLACE INTO `contacts` (`id`, `signal_id`, `name`, `title`, `email`, `linkedin_url`, `created_at`, `updated_at`)
VALUES (
  'ct_001',
  'sig_001',
  'Elena Vance',
  'VP of Supply Chain & Global Operations',
  'elena.vance@aethondynamics.com',
  'https://linkedin.com/in/elena-vance-ops',
  '2026-10-25T08:30:00Z',
  '2026-10-25T08:30:00Z'
);

INSERT OR REPLACE INTO `outreach_drafts` (`id`, `signal_id`, `contact_id`, `subject`, `body`, `status`, `created_at`, `updated_at`)
VALUES (
  'dr_001',
  'sig_001',
  'ct_001',
  'Scaling Aethon''s vendor clearance velocity following the $48M Series B',
  'Hi Elena,\n\nSaw TechCrunch''s report on Aethon''s $48M Series B — huge milestone for autonomous defense logistics!\n\nAs you ramp up operations across 75+ new hires, manual vendor compliance is typically where depot rollout timelines slip. TwinFlow automates supplier credential verification in real-time, reducing onboarding latency from weeks to hours.\n\nOpen to a 3-minute video walkthrough showing how similar robotics teams handled this?',
  'draft',
  '2026-10-25T08:30:00Z',
  '2026-10-25T08:30:00Z'
);

-- Signal 2
INSERT OR REPLACE INTO `signals` (`id`, `user_id`, `title`, `source_url`, `published_at`, `summary_bullets`, `company_name`, `signal_type`, `status`, `created_at`, `updated_at`)
VALUES (
  'sig_002',
  'usr_default',
  'FinMatrix Hires Former Stripe Enterprise VP Marcus Vance as Chief Revenue Officer',
  'https://bloomberg.com/news/finmatrix-appoints-cro',
  '2026-10-25T09:15:00Z',
  '["Marcus Vance appointed CRO following 7 years leading Stripe enterprise multi-currency expansion.","Mandated to aggressively penetrate Fortune 500 treasury departments with instant reconciliation APIs.","Immediate budget allocated for account intelligence tools to accelerate sales team pipeline velocity."]',
  'FinMatrix',
  'Executive Leadership',
  'queued',
  '2026-10-25T09:15:00Z',
  '2026-10-25T09:15:00Z'
);

INSERT OR REPLACE INTO `contacts` (`id`, `signal_id`, `name`, `title`, `email`, `linkedin_url`, `created_at`, `updated_at`)
VALUES (
  'ct_002',
  'sig_002',
  'Marcus Vance',
  'Chief Revenue Officer',
  'm.vance@finmatrix.io',
  'https://linkedin.com/in/marcus-vance-fintech',
  '2026-10-25T09:15:00Z',
  '2026-10-25T09:15:00Z'
);

INSERT OR REPLACE INTO `outreach_drafts` (`id`, `signal_id`, `contact_id`, `subject`, `body`, `status`, `created_at`, `updated_at`)
VALUES (
  'dr_002',
  'sig_002',
  'ct_002',
  'Congrats on the CRO role at FinMatrix + real-time outbound triggers',
  'Hi Marcus,\n\nCongratulations on joining FinMatrix as CRO! Bringing Stripe''s playbook to multi-currency reconciliation is a killer move.\n\nWhen entering a new enterprise GTM cycle, equipping reps with real-time intent triggers before public filings surface makes all the difference. TwinFlow turns market signals into pre-approved, high-converting outreach in seconds.\n\nWould you be open to previewing a curated queue calibrated for FinMatrix''s target treasury accounts?',
  'draft',
  '2026-10-25T09:15:00Z',
  '2026-10-25T09:15:00Z'
);

-- Signal 3
INSERT OR REPLACE INTO `signals` (`id`, `user_id`, `title`, `source_url`, `published_at`, `summary_bullets`, `company_name`, `signal_type`, `status`, `created_at`, `updated_at`)
VALUES (
  'sig_003',
  'usr_default',
  'Nexus BioSystems Expands Clinical Trial Platform to 40 New Research Hospitals',
  'https://venturebeat.com/nexus-biosystems-expansion',
  '2026-10-25T10:00:00Z',
  '["Signed landmark multi-site trial agreements across 40 academic medical research networks.","Deploying federated data collection infrastructure requiring HIPAA and GDPR audited partner tools.","Actively sourcing certified integration vendors to meet Q1 deployment milestones."]',
  'Nexus BioSystems',
  'Enterprise Expansion',
  'queued',
  '2026-10-25T10:00:00Z',
  '2026-10-25T10:00:00Z'
);

INSERT OR REPLACE INTO `contacts` (`id`, `signal_id`, `name`, `title`, `email`, `linkedin_url`, `created_at`, `updated_at`)
VALUES (
  'ct_003',
  'sig_003',
  'Dr. Sarah Lin',
  'Head of Clinical Partnerships',
  'sarah.lin@nexusbio.health',
  'https://linkedin.com/in/sarah-lin-bio',
  '2026-10-25T10:00:00Z',
  '2026-10-25T10:00:00Z'
);

INSERT OR REPLACE INTO `outreach_drafts` (`id`, `signal_id`, `contact_id`, `subject`, `body`, `status`, `created_at`, `updated_at`)
VALUES (
  'dr_003',
  'sig_003',
  'ct_003',
  'Compliance orchestration for Nexus''s 40-hospital clinical trial expansion',
  'Dr. Lin,\n\nCongratulations on the 40-hospital trial network expansion announced this morning — massive validation for Nexus BioSystems.\n\nWith that scale of deployment, vetting integration partners without slowing down clinical onboarding is a common bottleneck. TwinFlow gives partnership heads a gamified queue to review, verify, and approve compliant integration pitches in one tap.\n\nCould I send over our 2-page brief on how healthcare networks automate this partner triage?',
  'draft',
  '2026-10-25T10:00:00Z',
  '2026-10-25T10:00:00Z'
);
