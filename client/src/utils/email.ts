/**
 * Utilities for launching email clients or sending directly via connected Gmail OAuth.
 */
import { authFetch } from './api';

export interface SendGmailPayload {
  to: string;
  subject: string;
  body: string;
  contactId?: string;
  signalId?: string;
  draftId?: string;
}

export interface SendGmailResponse {
  success: boolean;
  messageId?: string;
  threadId?: string;
  fromEmail?: string;
  needsReauth?: boolean;
  message?: string;
  error?: string;
}

export async function sendEmailViaGmailApi(payload: SendGmailPayload): Promise<SendGmailResponse> {
  const res = await authFetch('/api/oauth/gmail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as SendGmailResponse;
  if (!res.ok && !data.error) {
    return { success: false, error: `Request failed (${res.status})` };
  }
  return data;
}

export async function startGmailOAuthConnect(redirect = '/#profile'): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await authFetch(
      `/api/oauth/gmail/start?format=json&redirect=${encodeURIComponent(redirect)}`
    );
    const data = (await res.json()) as { success: boolean; authUrl?: string; error?: string };
    if (res.ok && data.success && data.authUrl) {
      window.location.href = data.authUrl;
      return { success: true };
    }
    return {
      success: false,
      error: data.error || 'Could not initiate Gmail authorization.',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function disconnectGmailAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authFetch('/api/oauth/gmail/disconnect', { method: 'POST' });
    const data = (await res.json()) as { success: boolean; error?: string };
    return res.ok && data.success
      ? { success: true }
      : { success: false, error: data.error || 'Failed to disconnect Gmail.' };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

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
