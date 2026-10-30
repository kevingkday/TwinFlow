import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Users Table
 * Tracks account operator, GoHighLevel subaccount mapping, credits, and gamification metrics
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default('Operator'),
  role: text('role').notNull().default('user'),
  organization: text('organization'),
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  avatarUrl: text('avatar_url'),
  ghlSubaccountId: text('ghl_subaccount_id'),
  ghlApiKey: text('ghl_api_key'),
  creditBalance: integer('credit_balance').notNull().default(500),
  streakCount: integer('streak_count').notNull().default(0),
  totalPoints: integer('total_points').notNull().default(0),
  icpQuery: text('icp_query'),
  targetIndustries: text('target_industries'), // JSON array string e.g. ["B2B SaaS", "AI & Robotics"]
  targetTriggers: text('target_triggers'), // JSON array string e.g. ["Series A Funding", "Executive Hire"]
  targetRoles: text('target_roles'), // JSON array string e.g. ["CEO", "VP Sales"]
  targetLocation: text('target_location'),
  userIntent: text('user_intent'), // 'sales_client_acquisition' | 'job_seeking' | 'subcontractor_partners' | 'investing' | 'general'
  userMission: text('user_mission'), // Free-form statement of what they sell or what opportunity they seek
  valueProp: text('value_prop'),
  onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * User Sessions Table
 * Active authenticated login sessions (cookie or bearer token)
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

/**
 * Credit Transactions Table
 * Audit ledger for credit expenditures, lead approvals, and replenishments
 */
export const creditTransactions = sqliteTable('credit_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(), // e.g. -10
  balanceAfter: integer('balance_after').notNull(),
  type: text('type').notNull(), // 'lead_approval', 'bonus', 'replenish'
  referenceId: text('reference_id'), // e.g. signalId
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
});

/**
 * Signals Table
 * Ingested market triggers, funding, hiring, or expansion signals
 */
export const signals = sqliteTable('signals', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  parentSignalId: text('parent_signal_id'),
  title: text('title').notNull(),
  sourceUrl: text('source_url').notNull(),
  publishedAt: text('published_at').notNull(),
  summaryBullets: text('summary_bullets').notNull(), // JSON array string e.g. ["point 1", "point 2", "point 3"]
  companyName: text('company_name').notNull(),
  signalType: text('signal_type').notNull(),
  industryTags: text('industry_tags'), // JSON array string e.g. ["Fintech", "Series A"]
  status: text('status', { enum: ['queued', 'approved', 'dismissed'] }).notNull().default('queued'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Related Entities Table
 * Discovered competitor peers and alternative internal decision-makers for knowledge graph branching
 */
export const relatedEntities = sqliteTable('related_entities', {
  id: text('id').primaryKey(),
  signalId: text('signal_id')
    .notNull()
    .references(() => signals.id, { onDelete: 'cascade' }),
  entityType: text('entity_type', { enum: ['competitor', 'internal_peer'] }).notNull(),
  name: text('name').notNull(),
  domain: text('domain'),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['unexplored', 'explored'] }).notNull().default('unexplored'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Contacts Table
 * Extracted decision-maker profile corresponding to an ingested signal
 */
export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  signalId: text('signal_id')
    .notNull()
    .references(() => signals.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  title: text('title').notNull(),
  email: text('email'),
  linkedinUrl: text('linkedin_url'),
  avatarUrl: text('avatar_url'),
  ghlContactId: text('ghl_contact_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Outreach Drafts Table
 * Pre-composed outreach pitch tailored to the specific signal and contact
 */
export const outreachDrafts = sqliteTable('outreach_drafts', {
  id: text('id').primaryKey(),
  signalId: text('signal_id')
    .notNull()
    .references(() => signals.id, { onDelete: 'cascade' }),
  contactId: text('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status', { enum: ['draft', 'queued', 'sent'] }).notNull().default('draft'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Drizzle ORM Relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  creditTransactions: many(creditTransactions),
  sessions: many(sessions),
  signals: many(signals),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
}));

export const signalsRelations = relations(signals, ({ one, many }) => ({
  user: one(users, {
    fields: [signals.userId],
    references: [users.id],
  }),
  contacts: many(contacts),
  outreachDrafts: many(outreachDrafts),
  relatedEntities: many(relatedEntities),
  parentSignal: one(signals, {
    fields: [signals.parentSignalId],
    references: [signals.id],
    relationName: 'signalBranches',
  }),
  childBranches: many(signals, {
    relationName: 'signalBranches',
  }),
}));

export const relatedEntitiesRelations = relations(relatedEntities, ({ one }) => ({
  signal: one(signals, {
    fields: [relatedEntities.signalId],
    references: [signals.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  signal: one(signals, {
    fields: [contacts.signalId],
    references: [signals.id],
  }),
  outreachDrafts: many(outreachDrafts),
}));

export const outreachDraftsRelations = relations(outreachDrafts, ({ one }) => ({
  signal: one(signals, {
    fields: [outreachDrafts.signalId],
    references: [signals.id],
  }),
  contact: one(contacts, {
    fields: [outreachDrafts.contactId],
    references: [contacts.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = typeof signals.$inferInsert;

export type RelatedEntity = typeof relatedEntities.$inferSelect;
export type InsertRelatedEntity = typeof relatedEntities.$inferInsert;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

export type OutreachDraft = typeof outreachDrafts.$inferSelect;
export type InsertOutreachDraft = typeof outreachDrafts.$inferInsert;

