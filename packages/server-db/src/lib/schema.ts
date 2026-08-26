import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
    issuer: text('issuer').notNull(),
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
  (table) => [
    uniqueIndex('account_issuer_accountId_uidx').on(
      table.issuer,
      table.accountId
    ),
    index('account_userId_idx').on(table.userId),
  ]
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
    eventId: text('event_id').notNull(),
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
    accountedCostNanoUsd: bigint('accounted_cost_nano_usd', {
      mode: 'bigint',
    }).notNull(),
    platformCostNanoUsd: bigint('platform_cost_nano_usd', {
      mode: 'bigint',
    }).notNull(),
    byokEstimatedCostNanoUsd: bigint('byok_estimated_cost_nano_usd', {
      mode: 'bigint',
    }).notNull(),
    allowanceChargeNanoUsd: bigint('allowance_charge_nano_usd', {
      mode: 'bigint',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('ai_usage_event_user_operation_event_idx').on(
      table.userId,
      table.operationId,
      table.eventId
    ),
    index('ai_usage_event_user_occurred_idx').on(
      table.userId,
      table.occurredAt
    ),
    index('ai_usage_event_occurred_idx').on(table.occurredAt),
  ]
);

export const billingWebhookEvent = pgTable(
  'billing_webhook_event',
  {
    source: text('source').notNull(),
    eventId: text('event_id').notNull(),
    normalizedHash: text('normalized_hash').notNull(),
    eventTimestamp: timestamp('event_timestamp', {
      withTimezone: true,
    }).notNull(),
    originalEventType: text('original_event_type').notNull(),
    lifecycleKind: text('lifecycle_kind').notNull(),
    appId: text('app_id').notNull(),
    environment: text('environment').notNull(),
    customerIds: jsonb('customer_ids').$type<string[]>().notNull(),
    entitlementIds: jsonb('entitlement_ids').$type<string[]>().notNull(),
    productId: text('product_id'),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    graceExpiresAt: timestamp('grace_expires_at', { withTimezone: true }),
    willRenew: boolean('will_renew'),
    outcome: text('outcome').notNull(),
    failureCode: text('failure_code'),
    accountId: text('account_id').references(() => user.id, {
      onDelete: 'cascade',
    }),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.source, table.eventId] }),
    index('billing_webhook_event_outcome_idx').on(
      table.outcome,
      table.receivedAt
    ),
    index('billing_webhook_event_account_idx').on(
      table.accountId,
      table.eventTimestamp
    ),
  ]
);

export const billingCustomerMapping = pgTable(
  'billing_customer_mapping',
  {
    source: text('source').notNull(),
    externalCustomerId: text('external_customer_id').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.source, table.externalCustomerId] }),
    index('billing_customer_mapping_account_idx').on(table.accountId),
  ]
);

export const billingAccountIdentity = pgTable('billing_account_identity', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  externalCustomerId: text('external_customer_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const billingEntitlementProjection = pgTable(
  'billing_entitlement_projection',
  {
    accountId: text('account_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    planId: text('plan_id').notNull(),
    entitlementId: text('entitlement_id'),
    productId: text('product_id'),
    status: text('status').notNull(),
    willRenew: boolean('will_renew').notNull(),
    paidThrough: timestamp('paid_through', { withTimezone: true }),
    graceThrough: timestamp('grace_through', { withTimezone: true }),
    lastEventTimestamp: timestamp('last_event_timestamp', {
      withTimezone: true,
    }).notNull(),
    lastEventId: text('last_event_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('billing_entitlement_status_idx').on(table.status)]
);

export const includedGenerationWindow = pgTable(
  'included_generation_window',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    committedCount: integer('committed_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('included_generation_window_account_start_idx').on(
      table.accountId,
      table.startsAt
    ),
  ]
);

export const includedGenerationReservation = pgTable(
  'included_generation_reservation',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    operationKey: text('operation_key').notNull(),
    windowId: text('window_id')
      .notNull()
      .references(() => includedGenerationWindow.id, { onDelete: 'cascade' }),
    operation: text('operation').notNull(),
    status: text('status').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('included_generation_reservation_account_operation_active_idx')
      .on(table.accountId, table.operationKey)
      .where(sql`${table.status} in ('pending', 'committed')`),
    index('included_generation_reservation_active_idx').on(
      table.accountId,
      table.windowId,
      table.status,
      table.expiresAt
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
    costAmountNanoUsd: bigint('cost_amount_nano_usd', { mode: 'bigint' }),
    costSource: text('cost_source').notNull(),
    pricingSnapshotId: text('pricing_snapshot_id'),
    upstreamAttemptCount: integer('upstream_attempt_count').notNull(),
    errorCode: text('error_code'),
  },
  (table) => [index('ai_model_call_usage_event_idx').on(table.usageEventId)]
);

/**
 * Durable application-ownership handoff from anonymous source A to account B.
 * IDs intentionally are not foreign keys: Better Auth deletes A after the
 * callback and this record must remain available for mobile resume/diagnostics.
 */
export const accountTransition = pgTable(
  'account_transition',
  {
    sourceUserId: text('source_user_id').primaryKey(),
    targetUserId: text('target_user_id').notNull(),
    method: text('method').notNull(),
    state: text('state').notNull(),
    failureCode: text('failure_code'),
    attemptCount: integer('attempt_count').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('account_transition_target_state_idx').on(
      table.targetUserId,
      table.state
    ),
  ]
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
