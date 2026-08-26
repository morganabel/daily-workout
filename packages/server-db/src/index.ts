/**
 * Server Database Package
 *
 * Provides Drizzle ORM client factory and schema for PostgreSQL.
 * No side effects at import time - all initialization happens via factory functions.
 */

// Export client factory
export {
  createDb,
  createLocalDb,
  createCloudSqlDb,
  createDbFromEnv,
  closeConnector,
  ping,
  type Database,
  type CreateDbOptions,
  type LocalDbOptions,
  type CloudSqlOptions,
} from './lib/client.js';

// Export schema and types
export * as schema from './lib/schema.js';
export { PostgresMeteringSink, getAiUsageSummary } from './lib/ai-usage.js';
export {
  promoteAnonymousUserIdentity,
  type PromoteAnonymousUserInput,
} from './lib/auth-identity.js';
export {
  PostgresBillingRepository,
  PostgresSpendCeilingPolicy,
  type BillingRepositoryOperation,
  type BillingRepositoryOutcome,
  type BillingRepositoryObserver,
  type PostgresBillingRepositoryOptions,
  type PostgresSpendCeilingPolicyOptions,
  type IncludedGenerationUsageSnapshot,
} from './lib/billing.js';
import {
  user,
  session,
  account,
  verification,
  aiUsageEvent,
  aiModelCall,
} from './lib/schema.js';

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type AiUsageEvent = typeof aiUsageEvent.$inferSelect;
export type NewAiUsageEvent = typeof aiUsageEvent.$inferInsert;
export type AiModelCall = typeof aiModelCall.$inferSelect;
export type NewAiModelCall = typeof aiModelCall.$inferInsert;
