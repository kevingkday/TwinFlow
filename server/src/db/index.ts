import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  APP_NAME?: string;
  SERP_API_KEY?: string;
  FIRECRAWL_API_KEY?: string;
  OPENAI_API_KEY?: string;
  APOLLO_API_KEY?: string;
  GHL_API_KEY?: string;
  GHL_LOCATION_ID?: string;
  GHL_PIPELINE_ID?: string;
  GHL_STAGE_ID?: string;
  GHL_AGENCY_API_KEY?: string;
  GHL_COMPANY_ID?: string;
  GHL_DEFAULT_COUNTRY?: string;
  GHL_DEFAULT_TIMEZONE?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  ASSETS?: Fetcher;
};

export const getDb = (d1: D1Database) => {
  return drizzle(d1, { schema });
};

export type Database = ReturnType<typeof getDb>;
export { schema };
