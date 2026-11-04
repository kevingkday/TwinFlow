/**
 * Utilities for launching email clients with pre-filled recipient, subject, and body.
 */

export function createGmailComposeUrl(to?: string | null, subject?: string | null, body?: string | null): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: to || '',
    su: subject || '',
    body: body || '',
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function createMailtoUrl(to?: string | null, subject?: string | null, body?: string | null): string {
  const parts: string[] = [];
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  const query = parts.length > 0 ? `?${parts.join('&')}` : '';
  return `mailto:${encodeURIComponent(to || '')}${query}`;
}

export function openEmailClient(
  type: 'gmail' | 'default',
  to?: string | null,
  subject?: string | null,
  body?: string | null
): void {
  if (type === 'gmail') {
    const url = createGmailComposeUrl(to, subject, body);
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    const url = createMailtoUrl(to, subject, body);
    window.location.href = url;
  }
}
