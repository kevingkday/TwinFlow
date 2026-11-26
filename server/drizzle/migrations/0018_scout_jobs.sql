CREATE TABLE IF NOT EXISTS scout_jobs (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id text,
  status text NOT NULL DEFAULT 'running',
  stage text NOT NULL DEFAULT 'searching',
  message text NOT NULL DEFAULT 'Searching Google News...',
  progress integer NOT NULL DEFAULT 10,
  limit_count integer NOT NULL DEFAULT 3,
  state_json text,
  result_json text,
  error text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
