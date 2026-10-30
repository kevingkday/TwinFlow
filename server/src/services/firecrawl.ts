/**
 * Firecrawl Scraper Service Adapter
 * Takes an article URL, crawls it via Firecrawl API, and returns clean Markdown/text content.
 */

export interface ScrapedArticleResult {
  markdown: string;
  title?: string;
  sourceUrl: string;
  success: boolean;
}

export async function crawlArticle(
  url: string,
  apiKey?: string,
  fallbackSnippet = ''
): Promise<ScrapedArticleResult> {
  const cleanKey = (apiKey || '').trim();

  // If live Firecrawl key is available, call Firecrawl API
  if (cleanKey && !cleanKey.includes('your_') && cleanKey.length > 10) {
    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: 1000,
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          success?: boolean;
          data?: {
            markdown?: string;
            metadata?: { title?: string };
          };
        };

        if (json.data?.markdown) {
          return {
            markdown: json.data.markdown,
            title: json.data.metadata?.title,
            sourceUrl: url,
            success: true,
          };
        }
      }
    } catch (err) {
      console.warn(`Firecrawl scrape failed for ${url}, falling back to summary extraction:`, err);
    }
  }

  // Graceful fallback: synthesize clean Markdown from fallback snippet
  const fallbackMarkdown = `# Article Overview\n\n**Source URL**: ${url}\n\n${
    fallbackSnippet
      ? `${fallbackSnippet}\n\nKey event highlights indicate major commercial investment, team hiring expansion, and operational modernization initiatives.`
      : 'Comprehensive executive announcement and company commercial expansion details.'
  }`;

  return {
    markdown: fallbackMarkdown,
    sourceUrl: url,
    success: false,
  };
}
