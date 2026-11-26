ALTER TABLE campaigns ADD COLUMN organization text;
--> statement-breakpoint
ALTER TABLE signals ADD COLUMN query_id text;
--> statement-breakpoint
ALTER TABLE signals ADD COLUMN trigger_sentence text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS campaign_queries (
  id text PRIMARY KEY NOT NULL,
  campaign_id text NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_text text NOT NULL,
  tier text NOT NULL DEFAULT 'specific',
  pinned integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  runs integer NOT NULL DEFAULT 0,
  articles_returned integer NOT NULL DEFAULT 0,
  relevant_count integer NOT NULL DEFAULT 0,
  saved_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  last_run_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
--> statement-breakpoint
UPDATE contacts SET name = '' WHERE name IN ('Verified Executive', 'Target Decision Maker');
--> statement-breakpoint
UPDATE contacts SET title = '' WHERE title = 'Decision Maker';
