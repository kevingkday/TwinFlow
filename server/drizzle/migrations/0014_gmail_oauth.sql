-- Gmail OAuth 2.0 Authorization States & Connections
CREATE TABLE IF NOT EXISTS `gmail_oauth_states` (
  `state` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `redirect_after` text,
  `expires_at` integer NOT NULL,
  `created_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS `gmail_oauth_connections` (
  `user_id` text PRIMARY KEY NOT NULL,
  `gmail_email` text NOT NULL,
  `scope` text,
  `access_token_enc` text,
  `refresh_token_enc` text,
  `expires_at` integer,
  `created_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS `idx_gmail_oauth_states_user` ON `gmail_oauth_states` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_gmail_oauth_connections_email` ON `gmail_oauth_connections` (`gmail_email`);
