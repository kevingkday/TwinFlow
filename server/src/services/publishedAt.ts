/** Timestamps before 2000 are the Unix epoch (or a timezone shift of it), not an article date. */
const EARLIEST_ARTICLE_MS = Date.UTC(2000, 0, 1);

/**
 * Build an ISO timestamp `hoursAgo` before now.
 * If the clock is still at the epoch — including a bundler that constant-folds
 * `Date.now()` to 0 — use 5 Nov 2026 16:00 UTC so western timezones do not
 * render 1969-12-31.
 */
export function publishedAtFromHoursAgo(hoursAgo: number): string {
  const now = Date.now();
  const base = now > EARLIEST_ARTICLE_MS ? now : Date.UTC(2026, 10, 5, 16, 0, 0);
  const hours = Number.isFinite(hoursAgo) ? Math.max(0, hoursAgo) : 0;
  return new Date(base - hours * 60 * 60 * 1000).toISOString();
}

function fromRelativePhrase(value: string): string | null {
  const match = /^(\d+)\s+(minute|hour|day|week)s?\s+ago$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const hours =
    unit === 'minute' ? amount / 60 : unit === 'hour' ? amount : unit === 'day' ? amount * 24 : amount * 24 * 7;
  return publishedAtFromHoursAgo(hours);
}

/**
 * Turn a SerpAPI date, ISO string, or unix timestamp into an ISO string.
 * Date-only values are pinned to 12:00 UTC so a western timezone does not
 * roll them back a calendar day. Unusable values, including the epoch, use
 * the fallback age instead of 1969-12-31.
 */
/** Null when the value is missing, the epoch, or not a real date. Does not invent a timestamp. */
export function parsePublishedAtOrNull(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const ms = value < 1e12 ? value * 1000 : value;
    if (ms >= EARLIEST_ARTICLE_MS) return new Date(ms).toISOString();
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed && trimmed !== '0') {
      const relative = fromRelativePhrase(trimmed);
      if (relative) return relative;

      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
      const parsed = dateOnly
        ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0))
        : new Date(trimmed);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() >= EARLIEST_ARTICLE_MS) {
        return parsed.toISOString();
      }
    }
  }

  return null;
}

export function normalizePublishedAt(value: unknown, fallbackHoursAgo = 1): string {
  return parsePublishedAtOrNull(value) || publishedAtFromHoursAgo(fallbackHoursAgo);
}
