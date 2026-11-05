/**
 * SerpAPI Google News Service Adapter
 * Queries Google News via SerpAPI and extracts article title, publisher, URL, snippet, and publish date.
 */

import { parsePublishedAtOrNull } from './publishedAt';
import { isLowYieldArticle, isRecentPublished, isSportsArticle } from './signalQuality';

export interface SerpArticle {
  title: string;
  publisher: string;
  url: string;
  snippet: string;
  publishedAt: string;
}

const FALLBACK_NEWS_POOL: SerpArticle[] = [
  {
    title: 'Apex Commercial Partners Breaks Ground on $65M Logistics Distribution Facility in Dallas',
    publisher: 'Commercial Property Executive',
    url: 'https://cpexecutive.com/apex-breaks-ground-dallas-logistics',
    snippet: 'Apex Commercial Partners has commenced construction on a 420,000-square-foot speculative distribution facility in South Dallas, seeking regional general contracting, HVAC trade specialists, and commercial leasing partners.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    title: 'Pinnacle Orthopedic Health Opens 3 Surgical Centers Across the Pacific Northwest',
    publisher: 'Healthcare Dive',
    url: 'https://healthcaredive.com/pinnacle-orthopedic-pacific-nw-expansion',
    snippet: 'Pinnacle Orthopedic Health has expanded its regional surgical presence with three new multi-specialty centers in Seattle and Portland, appointing Dr. Karen Mitchell as Regional Practice Director.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
  },
  {
    title: 'Titan Precision Tooling Announces $18M Modernization Investment in Ohio Manufacturing Plant',
    publisher: 'IndustryWeek',
    url: 'https://industryweek.com/titan-precision-18m-plant-investment',
    snippet: 'Titan Precision Tooling revealed an $18 million capital expenditure plan to modernize automation machinery and expand component fabrication lines across its Midwestern operations.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    title: 'Grant & Sterling LLP Expands Private Wealth & Tax Practice with 4 New Managing Partners',
    publisher: 'The American Lawyer',
    url: 'https://americanlawyer.com/grant-sterling-wealth-practice-hires',
    snippet: 'National law and tax advisory firm Grant & Sterling LLP announced the lateral hire of four managing partners to head its commercial real estate and succession advisory group.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    title: 'Turner & Townsend Awarded Lead Project Management for $120M Terminal Expansion',
    publisher: 'Construction Dive',
    url: 'https://constructiondive.com/turner-townsend-terminal-expansion',
    snippet: 'Global construction consultancy Turner & Townsend has been awarded the lead program management role for a $120 million municipal terminal modernization project, managing subcontractor bidding.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    title: 'CognitiveScale Raises $36M Series B to Automate Multi-Agent Workflow Governance',
    publisher: 'TechCrunch',
    url: 'https://techcrunch.com/2026/cognitivescale-raises-36m-series-b',
    snippet: 'CognitiveScale today announced a $36 million Series B funding round led by Index Ventures to expand its enterprise agentic workflow platform and commercial sales leadership.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
  },
  {
    title: 'FleetMatrix Lands $22M Integration Contract with 5 Major Regional Freight Carriers',
    publisher: 'FreightWaves',
    url: 'https://freightwaves.com/fleetmatrix-22m-freight-deal',
    snippet: 'FleetMatrix announced an enterprise deployment expanding into 18 regional distribution hubs across the Midwest, prompting an active search for third-party logistics and carrier partners.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
  },
];

export interface FetchSerpNewsOptions {
  /** Built-in sample headlines. Production callers must leave this false. */
  allowSampleFallback?: boolean;
}

const SAMPLE_ARTICLE_URLS = new Set(FALLBACK_NEWS_POOL.map((article) => article.url));

export function isSampleArticle(article: { url?: string | null }): boolean {
  return Boolean(article.url && SAMPLE_ARTICLE_URLS.has(article.url));
}

export function sampleArticles(limit = 3): SerpArticle[] {
  return FALLBACK_NEWS_POOL.slice(0, limit);
}

export async function fetchSerpNews(
  query: string,
  apiKey?: string,
  limit = 3,
  gl = 'us',
  fallbackQueries?: string[],
  options?: FetchSerpNewsOptions
): Promise<SerpArticle[]> {
  const cleanKey = (apiKey || '').trim();
  const queriesToTry = [query, ...(fallbackQueries || [])].filter(Boolean);

  if (cleanKey && !cleanKey.includes('your_') && cleanKey.length > 10) {
    const collected: SerpArticle[] = [];
    const seen = new Set<string>();

    for (const q of queriesToTry) {
      try {
        const endpoint = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(
          q
        )}&api_key=${encodeURIComponent(cleanKey)}&gl=${encodeURIComponent(gl)}&hl=en&tbs=${encodeURIComponent('qdr:w2')}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`SerpAPI error status: ${response.status}`);
        }

        const json = (await response.json()) as {
          news_results?: Array<{
            title?: string;
            link?: string;
            source?: { name?: string } | string;
            snippet?: string;
            date?: string;
          }>;
        };

        for (const item of json.news_results || []) {
          const publisherName =
            typeof item.source === 'object' && item.source !== null
              ? item.source.name || 'News Source'
              : (item.source as string) || 'News Source';
          const title = item.title || 'Market Signal Headline';
          const url = item.link || '';
          if (!url || isLowYieldArticle(title, publisherName, url) || isSportsArticle(title, publisherName)) continue;
          const publishedAt = parsePublishedAtOrNull(item.date);
          if (!publishedAt || !isRecentPublished(publishedAt)) continue;
          const key = title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push({
            title,
            publisher: publisherName,
            url,
            snippet: item.snippet || title,
            publishedAt,
          });
          if (collected.length >= limit) return collected;
        }
      } catch (err) {
        console.warn(`SerpAPI query failed for "${q}":`, err);
      }
    }

    if (collected.length > 0) return collected;
    console.warn(`[SerpAPI] No recent articles for "${query}". Not substituting sample headlines.`);
    return [];
  }

  if (options?.allowSampleFallback) {
    return sampleArticles(limit);
  }

  console.warn(`[SerpAPI] No live key for "${query}". Returning no articles.`);
  return [];
}
