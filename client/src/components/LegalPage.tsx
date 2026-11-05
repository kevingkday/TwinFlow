import React from 'react';

type LegalKind = 'privacy' | 'terms';

const UPDATED = 'November 5, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-slate-900 font-display">{title}</h2>
      <div className="space-y-2 text-sm text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}

export const LegalPage: React.FC<{ page: LegalKind }> = ({ page }) => {
  const isPrivacy = page === 'privacy';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <a href="/" className="font-bold font-display text-slate-900">
            Twin<span className="text-blue-600">Flow</span>
          </a>
          <nav className="flex items-center gap-4 text-xs text-slate-500">
            <a href="/" className="hover:text-slate-900">Home</a>
            <a href="/privacy" className={isPrivacy ? 'text-blue-700 font-semibold' : 'hover:text-slate-900'}>
              Privacy
            </a>
            <a href="/terms" className={!isPrivacy ? 'text-blue-700 font-semibold' : 'hover:text-slate-900'}>
              Terms
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Template pending legal review.</strong> This page is a starting draft for TwinFlow. It is not legal advice, it has not been reviewed by counsel, and it should not be treated as the final policy until a lawyer approves it.
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">
            Market Signal Intelligence
          </p>
          <h1 className="text-3xl font-extrabold font-display text-slate-900">
            {isPrivacy ? 'Privacy Policy' : 'Terms of Use'}
          </h1>
          <p className="text-xs text-slate-500 mt-2">Last updated {UPDATED} · Template</p>
        </div>

        {isPrivacy ? <PrivacyBody /> : <TermsBody />}
      </main>
    </div>
  );
};

function PrivacyBody() {
  return (
    <div className="space-y-6">
      <Section title="Who we are">
        <p>
          TwinFlow (“we”) provides market signal intelligence: a workspace that surfaces company news, drafts outreach, and can sync records into a customer’s CRM. This draft describes how the product handles information. Replace the operator name, address, and contact email before publication.
        </p>
      </Section>

      <Section title="Account data">
        <p>
          When you create an account we store your name, email address, password hash or Google sign-in identifier, organization details you choose to enter, and a session token. We use this to authenticate you and to keep your campaigns, credits, and CRM settings separate from other customers.
        </p>
      </Section>

      <Section title="News scraping">
        <p>
          To build a signal deck, TwinFlow queries news and web sources (including search APIs and page-fetch tools) for publicly available headlines, snippets, publication dates, and article text. That content is processed to summarize a company event and suggest who to contact. We do not present scraped articles as TwinFlow’s own reporting. Source pages remain the publisher’s property. The public demo deck uses fictional examples and does not fetch live articles.
        </p>
      </Section>

      <Section title="Apollo enrichment">
        <p>
          When enrichment runs, TwinFlow may send a person’s name, title, and company domain to Apollo to look up business contact details such as a work email, LinkedIn URL, and profile photo. Those fields are stored with the signal so you can review them. Apollo is a separate processor with its own terms. You are responsible for having a lawful basis to look up and contact those people.
        </p>
      </Section>

      <Section title="GoHighLevel sync">
        <p>
          If you connect GoHighLevel, TwinFlow stores the location id and private integration token you provide and uses them to create or update contacts, notes, opportunities, business profile fields, and social posts in your sub-account. The token is used only to perform the sync you request. Disconnecting or replacing the token stops new syncs. GoHighLevel is a separate service, and its privacy policy applies to data held in that account.
        </p>
      </Section>

      <Section title="Stripe">
        <p>
          Paid plans, when enabled, are processed by Stripe. TwinFlow does not store full card numbers. Stripe may receive your name, email, billing details, and the purchase amount. We may receive a payment status, amount, and limited card metadata (such as brand and last four digits) so we can record that a purchase occurred. Credit balances are changed only by the TwinFlow server, not by values typed in the browser. See Stripe’s privacy policy for how they handle payment data.
        </p>
      </Section>

      <Section title="How long we keep data, and your choices">
        <p>
          Account and pipeline records are kept while your workspace is active. You may ask us to delete an account, which removes the user row and cascaded records we control. Copies already pushed to GoHighLevel, Apollo, or your email client stay in those systems until you delete them there. Browser storage holds the session token on this device.
        </p>
      </Section>

      <Section title="Cookies and analytics">
        <p>
          The site loads Google Analytics (tag G-6RPE3E1CM3) and Google sign-in scripts. Those providers may set their own cookies. The app session is stored in local storage and sent as a bearer token.
        </p>
      </Section>
    </div>
  );
}

function TermsBody() {
  return (
    <div className="space-y-6">
      <Section title="The service">
        <p>
          TwinFlow is a market signal intelligence workspace. It shows company events, suggested contacts, and outreach drafts, and it can send approved records to a CRM you connect. Drafts are suggestions. You decide whether to send them, and you are the sender.
        </p>
      </Section>

      <Section title="News scraping">
        <p>
          Signals are derived from third-party news and web pages. Coverage can be incomplete, delayed, or wrong. You must check a trigger before you rely on it. Do not republish scraped article text as your own content.
        </p>
      </Section>

      <Section title="Apollo enrichment">
        <p>
          Contact enrichment depends on Apollo and on the name and company we send them. A returned email or LinkedIn URL can be outdated or mismatched. You must confirm a contact before you email or message them, and you must comply with Apollo’s terms for the data you receive.
        </p>
      </Section>

      <Section title="GoHighLevel sync">
        <p>
          Connecting GoHighLevel authorizes TwinFlow to write contacts, notes, and related fields into the location whose token you saved. You are responsible for that token, for the people who can use your TwinFlow login, and for the records that land in your CRM. TwinFlow does not control your GoHighLevel account after the data is written.
        </p>
      </Section>

      <Section title="Stripe and credits">
        <p>
          Plan prices shown in the product are the prices you agree to pay if you start a paid subscription. Payments are handled by Stripe. Credits are spent only when the server completes an action that debits them (such as approving a lead). A client request cannot set its own credit balance. Unused credits, refunds, and taxes need a final policy from counsel before this template is published.
        </p>
      </Section>

      <Section title="Your responsibility for CASL and CAN-SPAM">
        <p>
          You are solely responsible for the messages you send. TwinFlow does not send email on your behalf and does not check that a recipient consented. If you email or message someone, you must comply with Canada’s anti-spam law (CASL), the U.S. CAN-SPAM Act, and any other law that applies to you. That includes, where required: identifying yourself, using a truthful subject line, providing a physical mailing address, honoring unsubscribe requests, and having the consent CASL requires (express consent, or a listed implied-consent situation) before you send a commercial electronic message. A drafted pitch inside TwinFlow is not permission to send it.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Do not use TwinFlow to scrape or contact people in a way that breaks the law, to upload credentials you do not control, or to interfere with the service. We may suspend a workspace that abuses news, enrichment, or CRM integrations.
        </p>
      </Section>

      <Section title="Disclaimer">
        <p>
          The service is provided as-is in this template. A published version should state the warranty disclaimer, liability cap, and governing law your counsel chooses. Until this page is reviewed, do not treat it as the contract between TwinFlow and its customers.
        </p>
      </Section>
    </div>
  );
}
