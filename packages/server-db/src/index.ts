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
export type {
  User,
  NewUser,
  Session,
  NewSession,
  Account,
  NewAccount,
  Verification,
  NewVerification,
} from './lib/schema.js';
