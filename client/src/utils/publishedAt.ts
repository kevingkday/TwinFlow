const EARLIEST_ARTICLE_MS = Date.UTC(2000, 0, 1);

/** True when the value is an http(s) URL. Example citations are plain text and must not be linked. */
export function isExternalArticleUrl(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

export function articleSourceLabel(sourceUrl: string | null | undefined, fallback = 'Example coverage'): string {
  if (!sourceUrl) return fallback;
  if (!isExternalArticleUrl(sourceUrl)) {
    return (
      sourceUrl
        .replace(/^Example:\s*/i, '')
        .replace(/\s*\(not a live link\)\s*$/i, '')
        .trim() || fallback
    );
  }
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    return fallback;
  }
}

function parsePublishedAt(value: string | number | null | undefined): Date | null {
  if (value == null || value === '' || value === '0') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const ms = value < 1e12 ? value * 1000 : value;
    return ms >= EARLIEST_ARTICLE_MS ? new Date(ms) : null;
  }

  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const parsed = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0))
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() < EARLIEST_ARTICLE_MS) return null;
  return parsed;
}

/** Relative label for a card. Never returns a 1969/1970 calendar date. */
export function formatPublishedAgo(value: string | number | null | undefined): string {
  const parsed = parsePublishedAt(value);
  if (!parsed) return 'Recent';
  const delta = Date.now() - parsed.getTime();
  if (delta < 60 * 1000) return 'Just now';
  const minutes = Math.round(delta / (60 * 1000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(delta / (60 * 60 * 1000));
  if (hours < 24) return `${Math.max(1, hours)}h ago`;
  const days = Math.round(hours / 24);
  return `${Math.max(1, days)}d ago`;
}
