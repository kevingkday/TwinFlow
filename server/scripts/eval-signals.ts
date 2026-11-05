/**
 * Repeatable news-signal eval.
 *
 * Uses planNewsQueryWithAI (the same planner as onboarding and campaigns).
 * Search uses SerpAPI when SERP_API_KEY is set. Otherwise it reads the public
 * Google News RSS feed for those queries. Firecrawl runs only when
 * FIRECRAWL_API_KEY is set, and only for the first article of each persona.
 * Apollo runs only when APOLLO_API_KEY is set, and only for one extracted
 * name per persona. This script never sends email.
 *
 *   npm run eval:signals --prefix server
 *
 * The "before" column freezes the previous generic expansion query and the
 * old habit of treating an invented name as a contact. The "after" column
 * uses the current planner, drops listicles, and counts a person only when
 * the article prints a full name.
 */
import { planNewsQueryWithAI, type QueryPlannerInput } from '../src/services/aiQueryPlanner';
import { fetchSerpNews, type SerpArticle } from '../src/services/serpNews';
import { crawlArticle } from '../src/services/firecrawl';
import { findApolloContact } from '../src/services/apollo';
import {
  classifyArticleType,
  extractNamedPeople,
  findReachableEmail,
  isLowYieldArticle,
  isRecentPublished,
  isRelevantToProfile,
  type ArticleType,
} from '../src/services/signalQuality';

interface Persona extends QueryPlannerInput {
  id: string;
  label: string;
}

const PERSONAS: Persona[] = [
  {
    id: 'ocean-falls',
    label: 'BC cyber/AI insurance broker (Ocean Falls Insurance)',
    location: 'Vancouver, British Columbia, Canada',
    userIntent: 'sales_client_acquisition',
    userMission: 'Place cyber insurance and AI liability coverage for British Columbia technology companies',
    targetIndustries: ['cyber', 'insurance'],
    targetTriggers: ['Leadership Appointment', 'Funding'],
    valueProp: 'Cyber and AI insurance brokerage for technology firms',
    companyDescription: 'Ocean Falls Insurance is a Vancouver brokerage for cyber and AI risk',
  },
  {
    id: 'alberta-contractor',
    label: 'Alberta commercial contractor',
    location: 'Calgary, Alberta, Canada',
    userIntent: 'subcontractor_partners',
    userMission: 'Bid commercial construction and industrial projects for Alberta owners and developers',
    targetIndustries: ['construction', 'industrial'],
    targetTriggers: ['Contract Award', 'Groundbreaking'],
    valueProp: 'Commercial and industrial construction',
  },
  {
    id: 'saas-agency',
    label: 'B2B SaaS marketing agency',
    location: 'Toronto, Ontario, Canada',
    userIntent: 'sales_client_acquisition',
    userMission: 'Win demand-generation retainers when software companies hire a marketing leader or raise funding',
    targetIndustries: ['software', 'saas'],
    targetTriggers: ['Leadership Appointment', 'Funding'],
    valueProp: 'B2B SaaS demand generation',
  },
  {
    id: 'captive',
    label: 'Canadian captive insurance consultant',
    location: 'Toronto, Ontario, Canada',
    userIntent: 'sales_client_acquisition',
    userMission: 'Advise finance leaders forming or expanding a captive insurance company in Canada',
    targetIndustries: ['insurance', 'captive'],
    targetTriggers: ['Leadership Appointment', 'Expansion'],
    valueProp: 'Captive insurance feasibility and formation',
  },
  {
    id: 'ontario-msp',
    label: 'Managed IT/MSP in Ontario',
    location: 'Ontario, Canada',
    userIntent: 'sales_client_acquisition',
    userMission: 'Sell managed IT and cybersecurity services when Ontario companies open an office or appoint a technology leader',
    targetIndustries: ['cybersecurity', 'managed'],
    targetTriggers: ['Leadership Appointment', 'Expansion'],
    valueProp: 'Managed IT and cybersecurity for growing companies',
  },
  {
    id: 'dallas-cre',
    label: 'US commercial real estate broker',
    location: 'Dallas, Texas, United States',
    userIntent: 'sales_client_acquisition',
    userMission: 'Represent tenants and investors on Dallas office and industrial leases',
    targetIndustries: ['office', 'industrial', 'lease'],
    targetTriggers: ['Lease', 'Headquarters', 'Expansion'],
    valueProp: 'Dallas office and industrial tenant representation',
  },
];

interface ScoredArticle {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  articleType: ArticleType;
  relevant: boolean;
  recent: boolean;
  namesPerson: boolean;
  personName: string | null;
  reachable: boolean;
  lowYield: boolean;
}

function legacyQuery(persona: Persona): { primaryQuery: string; fallbackQueries: string[]; gl: string } {
  const location = persona.location || '';
  let geoAnchor = '';
  if (location && !location.toLowerCase().includes('nationwide')) {
    geoAnchor = location.split(',')[0].trim().split(' ').slice(0, 2).join(' ');
  }
  let indAnchor = persona.targetIndustries?.[0] || 'Commercial';
  if (indAnchor.includes('&')) indAnchor = indAnchor.split('&')[0].trim();
  const triggerPart = '"New Location" OR "Expansion"';
  const primary = geoAnchor ? `${geoAnchor} ${indAnchor} ${triggerPart}` : `"${indAnchor}" ${triggerPart}`;
  const fallback1 = geoAnchor
    ? `${geoAnchor} business "expansion" OR "new facility"`
    : `"${indAnchor}" "breaks ground" OR "contract awarded"`;
  const gl = /canada|british|alberta|ontario|vancouver|toronto|calgary|mississauga/i.test(location) ? 'ca' : 'us';
  return { primaryQuery: primary, fallbackQueries: [fallback1], gl };
}

function legacyNamesPerson(title: string): { named: boolean; person: string | null } {
  const leaderMatch = title.match(/(?:hires|appoints|taps|names)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const guessed = leaderMatch?.[1]
    || (/raises|series|million|\$/i.test(title) ? 'Dr. Clara Lin' : 'Elena Vance');
  const named = title.toLowerCase().includes(guessed.toLowerCase());
  return { named, person: named ? guessed : null };
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

async function fetchPublicNews(query: string, gl: string, limit: number): Promise<SerpArticle[]> {
  const hl = gl === 'ca' ? 'en-CA' : 'en-US';
  const ceid = gl === 'ca' ? 'CA:en' : 'US:en';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'TwinFlowSignalEval/1.0' } });
  if (!response.ok) throw new Error(`Google News RSS ${response.status}`);
  const xml = await response.text();
  const articles: SerpArticle[] = [];
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = item[1];
    const titleRaw = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim();
    const link = decodeXml(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim();
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
    const splitAt = titleRaw.lastIndexOf(' - ');
    const title = splitAt > 0 ? titleRaw.slice(0, splitAt).trim() : titleRaw;
    const publisher = splitAt > 0 ? titleRaw.slice(splitAt + 3).trim() : 'Google News';
    const parsed = Date.parse(pubDate);
    articles.push({
      title,
      publisher,
      url: link,
      snippet: title,
      publishedAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : '',
    });
    if (articles.length >= limit) break;
  }
  return articles;
}

async function searchQueries(
  queries: string[],
  gl: string,
  limit: number,
  dropLowYield: boolean
): Promise<{ articles: SerpArticle[]; source: string }> {
  const serpKey = process.env.SERP_API_KEY;
  const collected: SerpArticle[] = [];
  const seen = new Set<string>();
  let source = serpKey ? 'serpapi' : 'google-news-rss';

  for (const query of queries) {
    let batch: SerpArticle[] = [];
    if (serpKey) {
      batch = await fetchSerpNews(query, serpKey, limit, gl);
      if (batch.some((article) => article.url.includes('cpexecutive.com/apex-breaks-ground'))) {
        source = 'serpapi-simulated-fallback';
        batch = [];
      }
    }
    if (!serpKey) {
      batch = await fetchPublicNews(query, gl, limit);
    }
    for (const article of batch) {
      if (dropLowYield && isLowYieldArticle(article.title, article.publisher, article.url)) continue;
      const key = article.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(article);
      if (collected.length >= limit) return { articles: collected, source };
    }
  }
  return { articles: collected, source };
}

function scoreArticle(persona: Persona, article: SerpArticle, mode: 'before' | 'after'): ScoredArticle {
  const text = `${article.title}\n${article.snippet}`;
  const people = extractNamedPeople(text);
  const legacy = legacyNamesPerson(article.title);
  const person = mode === 'before' ? legacy.person : people[0]?.name || null;
  const namesPerson = mode === 'before' ? legacy.named : people.length > 0;
  const email = findReachableEmail(text);
  return {
    title: article.title,
    publisher: article.publisher,
    url: article.url,
    publishedAt: article.publishedAt,
    articleType: classifyArticleType(article.title, article.snippet),
    relevant: isRelevantToProfile(persona, article.title, article.snippet, article.publisher),
    recent: isRecentPublished(article.publishedAt),
    namesPerson,
    personName: namesPerson ? person : null,
    reachable: Boolean(email),
    lowYield: isLowYieldArticle(article.title, article.publisher, article.url),
  };
}

function rate(rows: ScoredArticle[], predicate: (row: ScoredArticle) => boolean): number | null {
  if (rows.length === 0) return null;
  return rows.filter(predicate).length / rows.length;
}

function pct(value: number | null): string {
  if (value === null) return 'n/a';
  return `${Math.round(value * 100)}%`;
}

async function enrichOne(persona: Persona, articles: SerpArticle[]): Promise<void> {
  const first = articles[0];
  if (!first) return;
  if (process.env.FIRECRAWL_API_KEY) {
    const crawled = await crawlArticle(first.url, process.env.FIRECRAWL_API_KEY, first.snippet);
    first.snippet = `${first.snippet}\n${crawled.markdown.slice(0, 1500)}`;
  }
  const person = extractNamedPeople(`${first.title}\n${first.snippet}`)[0];
  if (process.env.APOLLO_API_KEY && person) {
    await findApolloContact(person.name, person.role, 'example.com', process.env.APOLLO_API_KEY);
  }
}

async function main() {
  const limit = 5;
  const lines: string[] = [];
  const typeHits = new Map<ArticleType, { articles: number; named: number }>();
  const examples: { good: ScoredArticle[]; bad: ScoredArticle[] } = { good: [], bad: [] };

  console.log(`Search mode: ${process.env.SERP_API_KEY ? 'SerpAPI' : 'public Google News RSS (SERP_API_KEY unset)'}`);
  console.log(`Firecrawl: ${process.env.FIRECRAWL_API_KEY ? 'on, 1 article/persona' : 'off'}`);
  console.log(`Apollo: ${process.env.APOLLO_API_KEY ? 'on, 1 name/persona' : 'off'}`);
  console.log(`OpenAI planner: ${process.env.OPENAI_API_KEY ? 'on' : 'algorithmic fallback'}`);
  console.log('');

  for (const persona of PERSONAS) {
    const beforePlan = legacyQuery(persona);
    const afterPlan = await planNewsQueryWithAI(persona, process.env.OPENAI_API_KEY);
    const beforeSearch = await searchQueries(
      [beforePlan.primaryQuery, ...beforePlan.fallbackQueries],
      beforePlan.gl,
      limit,
      false
    );
    const afterPool = await searchQueries(
      [afterPlan.primaryQuery, ...afterPlan.fallbackQueries],
      afterPlan.geographicFocus.gl,
      8,
      true
    );
    const afterSearch = {
      source: afterPool.source,
      articles: afterPool.articles
        .filter(
          (article) =>
            !isLowYieldArticle(article.title, article.publisher, article.url) &&
            isRelevantToProfile(persona, article.title, article.snippet, article.publisher)
        )
        .sort((a, b) => {
          const namedDelta =
            Number(extractNamedPeople(`${b.title} ${b.snippet}`).length > 0) -
            Number(extractNamedPeople(`${a.title} ${a.snippet}`).length > 0);
          if (namedDelta !== 0) return namedDelta;
          return Number(isRecentPublished(b.publishedAt)) - Number(isRecentPublished(a.publishedAt));
        })
        .slice(0, limit),
    };
    await enrichOne(persona, afterSearch.articles);

    const beforeRows = beforeSearch.articles.map((article) => scoreArticle(persona, article, 'before'));
    for (const row of beforeRows) {
      if (!row.relevant && examples.bad.length < 5) examples.bad.push(row);
    }
    const afterRows = afterSearch.articles.map((article) => scoreArticle(persona, article, 'after'));

    for (const row of afterRows) {
      const bucket = typeHits.get(row.articleType) || { articles: 0, named: 0 };
      bucket.articles += 1;
      if (row.namesPerson) bucket.named += 1;
      typeHits.set(row.articleType, bucket);
      if (row.relevant && row.namesPerson && examples.good.length < 5) examples.good.push(row);
      if ((!row.relevant || row.lowYield) && examples.bad.length < 3) examples.bad.push(row);
    }

    const summarize = (rows: ScoredArticle[]) => {
      const precision = rate(rows, (row) => row.relevant);
      const recent = rate(rows, (row) => row.recent);
      const named = rate(rows, (row) => row.namesPerson);
      const reachable = rate(rows, (row) => row.reachable);
      const actionable = rate(
        rows,
        (row) => row.relevant && row.recent && row.namesPerson && row.reachable
      );
      const namedReady = rate(rows, (row) => row.relevant && row.recent && row.namesPerson);
      return { n: rows.length, precision, recent, named, reachable, actionable, namedReady };
    };

    const before = summarize(beforeRows);
    const after = summarize(afterRows);
    lines.push(`### ${persona.label}`);
    lines.push(`Before query: ${beforePlan.primaryQuery}`);
    lines.push(`After query: ${afterPlan.primaryQuery} (${afterPlan.modelUsed})`);
    lines.push(`| | n | precision | recent | named person | reachable | actionable | relevant+recent+named |`);
    lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
    for (const [label, stats] of [['before', before], ['after', after]] as const) {
      lines.push(
        `| ${label} | ${stats.n} | ${pct(stats.precision)} | ${pct(stats.recent)} | ${pct(stats.named)} | ${pct(stats.reachable)} | ${pct(stats.actionable)} | ${pct(stats.namedReady)} |`
      );
    }
    lines.push('');
  }

  console.log(lines.join('\n'));
  console.log('### Article types in the after set');
  console.log('| type | articles | with a named person |');
  console.log('| --- | --- | --- |');
  for (const [type, bucket] of [...typeHits.entries()].sort((a, b) => b[1].named - a[1].named)) {
    console.log(`| ${type} | ${bucket.articles} | ${bucket.named} |`);
  }
  console.log('\n### Good examples');
  for (const row of examples.good) {
    console.log(`- [${row.articleType}] ${row.title} (${row.personName || 'no name'})`);
  }
  console.log('\n### Bad examples');
  for (const row of examples.bad) {
    console.log(`- [${row.articleType}] relevant=${row.relevant} named=${row.namesPerson} lowYield=${row.lowYield} :: ${row.title}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
