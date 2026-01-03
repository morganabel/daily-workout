/**
 * Database schema for Better Auth
 *
 * This schema is compatible with Better Auth's Drizzle adapter.
 * Generated based on Better Auth documentation for PostgreSQL.
 *
 * Tables:
 * - user: User accounts
 * - session: Active sessions (bearer token auth)
 * - account: OAuth/credential accounts linked to users
 * - verification: Email verification tokens (future use)
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core';

/**
 * User table - stores user accounts
 *
 * For anonymous users, email/emailVerified may be null until they upgrade
 * to email/password authentication.
 */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Session table - stores active sessions
 *
 * The session ID (id) is used to derive principalId for device-scoped state.
 * The token field contains the bearer token sent by clients.
 */
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Account table - stores authentication methods linked to users
 *
 * Supports multiple auth methods per user:
 * - 'anonymous': Initial anonymous session
 * - 'credential': Email/password authentication
 * - Future: 'google', 'apple' for social login
 */
export const account = pgTable(
  'account',
  {
    id: text('id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.id] })]
);

/**
 * Verification table - stores email verification tokens
 *
 * Used for email verification flow (future feature).
 */
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Export table types for use in queries
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
