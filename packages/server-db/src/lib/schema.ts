import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  isAnonymous: boolean('is_anonymous').default(false),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const aiUsageEvent = pgTable(
  'ai_usage_event',
  {
    id: text('id').primaryKey(),
    operationId: text('operation_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    operation: text('operation').notNull(),
    provider: text('provider').notNull(),
    credentialSource: text('credential_source'),
    result: text('result'),
    byok: boolean('byok').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    durationMs: integer('duration_ms'),
    callCount: integer('call_count').notNull(),
    successfulCallCount: integer('successful_call_count').notNull(),
    failedCallCount: integer('failed_call_count').notNull(),
    unknownCostCallCount: integer('unknown_cost_call_count').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    cachedInputTokens: integer('cached_input_tokens').notNull(),
    reasoningOutputTokens: integer('reasoning_output_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),
    accountedCostNanoUsd: text('accounted_cost_nano_usd').notNull(),
    platformCostNanoUsd: text('platform_cost_nano_usd').notNull(),
    byokEstimatedCostNanoUsd: text('byok_estimated_cost_nano_usd').notNull(),
    allowanceChargeNanoUsd: text('allowance_charge_nano_usd').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('ai_usage_event_user_operation_idx').on(
      table.userId,
      table.operationId
    ),
    index('ai_usage_event_user_occurred_idx').on(
      table.userId,
      table.occurredAt
    ),
  ]
);

export const aiModelCall = pgTable(
  'ai_model_call',
  {
    id: text('id').primaryKey(),
    usageEventId: text('usage_event_id')
      .notNull()
      .references(() => aiUsageEvent.id, { onDelete: 'cascade' }),
    phase: text('phase').notNull(),
    provider: text('provider').notNull(),
    requestedModel: text('requested_model').notNull(),
    resolvedModel: text('resolved_model'),
    responseId: text('response_id'),
    status: text('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cachedInputTokens: integer('cached_input_tokens'),
    reasoningOutputTokens: integer('reasoning_output_tokens'),
    totalTokens: integer('total_tokens'),
    costAmountNanoUsd: text('cost_amount_nano_usd'),
    costSource: text('cost_source').notNull(),
    pricingSnapshotId: text('pricing_snapshot_id'),
    upstreamAttemptCount: integer('upstream_attempt_count').notNull(),
    errorCode: text('error_code'),
  },
  (table) => [index('ai_model_call_usage_event_idx').on(table.usageEventId)]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
