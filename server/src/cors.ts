/**
 * Browser origins allowed to call the API.
 * Production hosts are exact matches. Local dev accepts localhost and
 * 127.0.0.1 on any port (http or https). Every other origin is denied.
 */
export const PRODUCTION_ORIGINS = ['https://twinflow.co', 'https://www.twinflow.co'] as const;

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function resolveAllowedOrigin(origin: string): string | null {
  if (!origin) return null;
  if ((PRODUCTION_ORIGINS as readonly string[]).includes(origin)) return origin;
  if (LOCAL_DEV_ORIGIN.test(origin)) return origin;
  return null;
}
