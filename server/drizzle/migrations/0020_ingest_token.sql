-- Add personal ingest_token for zero-login quick-add (Share Sheet, Email Routing, Bookmarklet)
ALTER TABLE users ADD COLUMN ingest_token text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ingest_token ON users(ingest_token);
