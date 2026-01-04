/**
 * Server Database Package
 *
 * Provides Drizzle ORM client factory and schema for PostgreSQL.
 * No side effects at import time - all initialization happens via factory functions.
 */

// Export client factory
export { createDb, createDbFromEnv, type Database, type CreateDbOptions } from './lib/client.js';

// Export schema and types
export * as schema from './lib/schema.js';
import { user, session, account, verification } from './lib/schema.js';

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
