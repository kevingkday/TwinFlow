-- HighLevel OAuth 2.0 Authorization States & Connections
CREATE TABLE IF NOT EXISTS `ghl_oauth_states` (
  `state` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `creator_id` text,
  `user_email` text NOT NULL,
  `redirect_after` text,
  `expires_at` integer NOT NULL,
  `created_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS `ghl_oauth_connections` (
  `user_id` text PRIMARY KEY NOT NULL,
  `creator_id` text,
  `location_id` text NOT NULL,
  `company_id` text,
  `user_type` text DEFAULT 'Location',
  `scope` text,
  `access_token_enc` text,
  `refresh_token_enc` text,
  `expires_at` integer,
  `connected_by_email` text,
  `subaccount_user_id` text,
  `subaccount_login_email` text,
  `subaccount_temp_password_enc` text,
  `created_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` text NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS `idx_ghl_oauth_states_user` ON `ghl_oauth_states` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_ghl_oauth_connections_loc` ON `ghl_oauth_connections` (`location_id`);
