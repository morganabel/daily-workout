import {
  effectiveEntitlement,
  reduceEntitlement,
  type BillingCustomerBootstrap,
  type EntitlementEventProcessor,
  type EntitlementLifecycleEvent,
  type EntitlementProcessorOutcome,
  type EntitlementProjection,
  type IncludedGenerationReservation,
  type IncludedGenerationReserveRequest,
  type IncludedGenerationReserveResult,
  type SpendCeilingDecision,
  type SpendCeilingPolicy,
  type UsagePolicy,
} from '@leveza/quotas';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  sql,
} from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import type { Database } from './client.js';
import { assertAccountAcceptsWrites } from './auth-identity.js';
import {
  aiUsageEvent,
  billingAccountIdentity,
  billingCustomerMapping,
  billingEntitlementProjection,
  billingWebhookEvent,
  includedGenerationReservation,
  includedGenerationWindow,
  user,
} from './schema.js';

type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const WRITE_TRANSACTION_CONFIG = {
  isolationLevel: 'read committed',
  accessMode: 'read write',
} as const;
const BILLING_LOCK_TIMEOUT_MS = 2_000;
const RECONCILIATION_BATCH_SIZE = 100;

export type BillingRepositoryOperation =
  | 'webhook'
  | 'mapping'
  | 'reconciliation'
  | 'reserve'
  | 'commit'
  | 'rollback'
  | 'usage_read'
  | 'spend_ceiling';

/**
 * Redacted repository telemetry. It intentionally excludes webhook payloads,
 * customer aliases, credentials, and provider response bodies.
 */
export interface BillingRepositoryOutcome {
  operation: BillingRepositoryOperation;
  outcome: string;
  accountId?: string;
  eventId?: string;
  operationId?: string;
  reservationId?: string;
  durationMs?: number;
}

export type BillingRepositoryObserver = (
  outcome: BillingRepositoryOutcome
) => void;

export interface PostgresBillingRepositoryOptions {
  includedGenerationLimit:
    | number
    | ((
        accountId: string,
        entitlement: EntitlementProjection | null
      ) => number);
  quotaWindowDays: number;
  reservationTtlMs: number;
  now?: () => Date;
  createId?: (kind: 'window' | 'reservation') => string;
  observe?: BillingRepositoryObserver;
}

export interface IncludedGenerationUsageSnapshot {
  startsAt: string;
  endsAt: string;
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
}

function createId(kind: 'window' | 'reservation'): string {
  return `${kind}_${uuidv7()}`;
}

function asError(code: string): Error {
  return new Error(code);
}

function hasDatabaseErrorCode(error: unknown, code: string): boolean {
  const seen = new Set<unknown>();
  let current = error;

  while (
    typeof current === 'object' &&
    current !== null &&
    !seen.has(current)
  ) {
    seen.add(current);
    if ('code' in current && current.code === code) {
      return true;
    }
    current = 'cause' in current ? current.cause : undefined;
  }

  return false;
}

function databaseFailureOutcome(error: unknown): string {
  return hasDatabaseErrorCode(error, '55P03')
    ? 'lock_timeout'
    : 'dependency_unavailable';
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function rowToProjection(
  row: typeof billingEntitlementProjection.$inferSelect
): EntitlementProjection {
  return {
    accountId: row.accountId,
    planId: row.planId,
    entitlementId: row.entitlementId,
    productId: row.productId,
    status: row.status as EntitlementProjection['status'],
    willRenew: row.willRenew,
    paidThrough: toIso(row.paidThrough),
    graceThrough: toIso(row.graceThrough),
    lastEventTimestamp: row.lastEventTimestamp.toISOString(),
    lastEventId: row.lastEventId,
  };
}

function projectionValues(projection: EntitlementProjection, now: Date) {
  return {
    accountId: projection.accountId,
    planId: projection.planId,
    entitlementId: projection.entitlementId,
    productId: projection.productId,
    status: projection.status,
    willRenew: projection.willRenew,
    paidThrough: projection.paidThrough
      ? new Date(projection.paidThrough)
      : null,
    graceThrough: projection.graceThrough
      ? new Date(projection.graceThrough)
      : null,
    lastEventTimestamp: new Date(projection.lastEventTimestamp),
    lastEventId: projection.lastEventId,
    updatedAt: now,
  };
}

function rowToEvent(
  row: typeof billingWebhookEvent.$inferSelect
): EntitlementLifecycleEvent {
  return {
    source: 'revenuecat',
    eventId: row.eventId,
    eventTimestamp: row.eventTimestamp.toISOString(),
    originalEventType: row.originalEventType,
    kind: row.lifecycleKind as EntitlementLifecycleEvent['kind'],
    appId: row.appId,
    environment: row.environment as EntitlementLifecycleEvent['environment'],
    customerIds: row.customerIds,
    entitlementIds: row.entitlementIds,
    productId: row.productId ?? undefined,
    purchasedAt: toIso(row.purchasedAt) ?? undefined,
    expiresAt: toIso(row.expiresAt) ?? undefined,
    graceExpiresAt: toIso(row.graceExpiresAt) ?? undefined,
    willRenew: row.willRenew ?? undefined,
    normalizedHash: row.normalizedHash,
  };
}

function reservationFromRow(
  row: typeof includedGenerationReservation.$inferSelect
): IncludedGenerationReservation {
  return {
    kind: 'included_generation',
    reservationId: row.id,
    accountId: row.accountId,
    operationId: row.operationKey,
    expiresAt: row.expiresAt.toISOString(),
  };
}

async function lockCustomerAliases(
  transaction: DbTransaction,
  source: string,
  customerIds: readonly string[]
): Promise<void> {
  const aliases = [...new Set(customerIds)].sort();
  if (aliases.length === 0) return;
  await transaction.execute(sql`
    select pg_advisory_xact_lock(
      hashtextextended(${source} || ':' || alias.customer_id, 0)
    )
    from jsonb_array_elements_text(${JSON.stringify(aliases)}::jsonb)
      as alias(customer_id)
    order by alias.customer_id
  `);
}

async function lockBillingAccount(
  transaction: DbTransaction,
  accountId: string
): Promise<void> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`billing-account:${accountId}`}, 0))`
  );
}

async function runWriteTransaction<T>(
  db: Database,
  callback: (transaction: DbTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select set_config('lock_timeout', ${`${BILLING_LOCK_TIMEOUT_MS}ms`}, true)`
    );
    return callback(transaction);
  }, WRITE_TRANSACTION_CONFIG);
}

export class PostgresBillingRepository
  implements EntitlementEventProcessor, BillingCustomerBootstrap, UsagePolicy
{
  private readonly now: () => Date;
  private readonly id: (kind: 'window' | 'reservation') => string;

  constructor(
    private readonly db: Database,
    private readonly options: PostgresBillingRepositoryOptions
  ) {
    if (
      !Number.isSafeInteger(options.quotaWindowDays) ||
      options.quotaWindowDays <= 0 ||
      !Number.isSafeInteger(options.reservationTtlMs) ||
      options.reservationTtlMs <= 0
    ) {
      throw asError('invalid_billing_repository_options');
    }
    this.now = options.now ?? (() => new Date());
    this.id = options.createId ?? createId;
  }

  private observe(outcome: BillingRepositoryOutcome): void {
    try {
      this.options.observe?.(outcome);
    } catch {
      // Telemetry must never alter billing state or public outcomes.
    }
  }

  private limitFor(
    accountId: string,
    entitlement: EntitlementProjection | null
  ): number {
    const limit =
      typeof this.options.includedGenerationLimit === 'function'
        ? this.options.includedGenerationLimit(accountId, entitlement)
        : this.options.includedGenerationLimit;
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw asError('invalid_included_generation_limit');
    }
    return limit;
  }

  private quotaWindowBounds(accountCreatedAt: Date, now: Date) {
    const periodMs = this.options.quotaWindowDays * 86_400_000;
    const anchorMs = Math.min(accountCreatedAt.getTime(), now.getTime());
    const periodIndex = Math.floor((now.getTime() - anchorMs) / periodMs);
    const startsAt = new Date(anchorMs + periodIndex * periodMs);
    return {
      startsAt,
      endsAt: new Date(startsAt.getTime() + periodMs),
    };
  }

  private async getOrCreateActiveWindow(
    transaction: DbTransaction,
    accountId: string,
    accountCreatedAt: Date,
    now: Date
  ): Promise<typeof includedGenerationWindow.$inferSelect> {
    const [existing] = await transaction
      .select()
      .from(includedGenerationWindow)
      .where(
        and(
          eq(includedGenerationWindow.accountId, accountId),
          lte(includedGenerationWindow.startsAt, now),
          gt(includedGenerationWindow.endsAt, now)
        )
      )
      .orderBy(desc(includedGenerationWindow.startsAt))
      .limit(1)
      .for('update');
    if (existing) return existing;

    const { startsAt, endsAt } = this.quotaWindowBounds(accountCreatedAt, now);
    const [created] = await transaction
      .insert(includedGenerationWindow)
      .values({
        id: this.id('window'),
        accountId,
        startsAt,
        endsAt,
      })
      .returning();
    if (!created) throw asError('billing_window_unavailable');
    return created;
  }

  private async getActiveWindowSnapshot(accountId: string, now: Date) {
    const [window] = await this.db
      .select({
        id: includedGenerationWindow.id,
        startsAt: includedGenerationWindow.startsAt,
        endsAt: includedGenerationWindow.endsAt,
        committedCount: includedGenerationWindow.committedCount,
        reserved: sql<number>`count(${includedGenerationReservation.id})::int`,
      })
      .from(includedGenerationWindow)
      .leftJoin(
        includedGenerationReservation,
        and(
          eq(
            includedGenerationReservation.windowId,
            includedGenerationWindow.id
          ),
          eq(includedGenerationReservation.status, 'pending'),
          gt(includedGenerationReservation.expiresAt, now)
        )
      )
      .where(
        and(
          eq(includedGenerationWindow.accountId, accountId),
          lte(includedGenerationWindow.startsAt, now),
          gt(includedGenerationWindow.endsAt, now)
        )
      )
      .groupBy(
        includedGenerationWindow.id,
        includedGenerationWindow.startsAt,
        includedGenerationWindow.endsAt,
        includedGenerationWindow.committedCount
      )
      .orderBy(desc(includedGenerationWindow.startsAt))
      .limit(1);
    return window;
  }

  async bootstrapAuthenticatedCustomer(input: {
    accountId: string;
    externalCustomerId: string;
  }): Promise<{ accountId: string; externalCustomerId: string }> {
    const startedAt = Date.now();
    let mappingOutcome = 'existing';
    try {
      await runWriteTransaction(this.db, async (transaction) => {
        await assertAccountAcceptsWrites(transaction, input.accountId);
        await lockCustomerAliases(transaction, 'revenuecat', [
          input.externalCustomerId,
        ]);
        const [account] = await transaction
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, input.accountId));
        if (!account) throw asError('billing_account_not_found');

        const [inserted] = await transaction
          .insert(billingCustomerMapping)
          .values({
            source: 'revenuecat',
            externalCustomerId: input.externalCustomerId,
            accountId: input.accountId,
          })
          .onConflictDoNothing()
          .returning({ accountId: billingCustomerMapping.accountId });
        mappingOutcome = inserted ? 'created' : 'existing';

        const [mapping] = await transaction
          .select({ accountId: billingCustomerMapping.accountId })
          .from(billingCustomerMapping)
          .where(
            and(
              eq(billingCustomerMapping.source, 'revenuecat'),
              eq(
                billingCustomerMapping.externalCustomerId,
                input.externalCustomerId
              )
            )
          );
        if (!mapping || mapping.accountId !== input.accountId) {
          throw asError('billing_customer_conflict');
        }
      });
    } catch (error) {
      const outcome =
        error instanceof Error &&
        (error.message === 'billing_account_not_found' ||
          error.message === 'billing_customer_conflict')
          ? error.message
          : databaseFailureOutcome(error);
      this.observe({
        operation: 'mapping',
        outcome,
        accountId: input.accountId,
        durationMs: Date.now() - startedAt,
      });
      throw outcome === 'billing_account_not_found' ||
        outcome === 'billing_customer_conflict'
        ? error
        : asError('billing_dependency_unavailable');
    }

    this.observe({
      operation: 'mapping',
      outcome: mappingOutcome,
      accountId: input.accountId,
      durationMs: Date.now() - startedAt,
    });
    const reconciliationStartedAt = Date.now();
    try {
      await this.reconcileUnmappedEvents(input.externalCustomerId);
    } catch (error) {
      this.observe({
        operation: 'reconciliation',
        outcome: databaseFailureOutcome(error),
        accountId: input.accountId,
        durationMs: Date.now() - reconciliationStartedAt,
      });
      throw asError('billing_dependency_unavailable');
    }
    return input;
  }

  async getOrCreateCanonicalCustomerIdentity(
    accountId: string
  ): Promise<{ accountId: string; externalCustomerId: string }> {
    const startedAt = Date.now();
    let externalCustomerId = '';
    let mappingOutcome = 'existing';

    try {
      await runWriteTransaction(this.db, async (transaction) => {
        await assertAccountAcceptsWrites(transaction, accountId);

        const [account] = await transaction
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, accountId))
          .limit(1);
        if (!account) throw asError('billing_account_not_found');

        const [existing] = await transaction
          .select({
            externalCustomerId: billingAccountIdentity.externalCustomerId,
          })
          .from(billingAccountIdentity)
          .where(eq(billingAccountIdentity.accountId, accountId))
          .limit(1);

        externalCustomerId =
          existing?.externalCustomerId ??
          `wa_${uuidv7().replaceAll('-', '')}`;
        await lockCustomerAliases(transaction, 'revenuecat', [
          externalCustomerId,
        ]);

        if (!existing) {
          await transaction.insert(billingAccountIdentity).values({
            accountId,
            externalCustomerId,
          });
          mappingOutcome = 'created';
        }

        await transaction
          .insert(billingCustomerMapping)
          .values({
            source: 'revenuecat',
            externalCustomerId,
            accountId,
          })
          .onConflictDoNothing();

        const [mapping] = await transaction
          .select({ accountId: billingCustomerMapping.accountId })
          .from(billingCustomerMapping)
          .where(
            and(
              eq(billingCustomerMapping.source, 'revenuecat'),
              eq(
                billingCustomerMapping.externalCustomerId,
                externalCustomerId
              )
            )
          )
          .limit(1);

        if (!mapping || mapping.accountId !== accountId) {
          throw asError('billing_customer_conflict');
        }
      });
    } catch (error) {
      const outcome =
        error instanceof Error &&
        (error.message === 'billing_account_not_found' ||
          error.message === 'billing_customer_conflict' ||
          error.message === 'account_ownership_transitioned')
          ? error.message
          : databaseFailureOutcome(error);
      this.observe({
        operation: 'mapping',
        outcome,
        accountId,
        durationMs: Date.now() - startedAt,
      });
      throw outcome === 'billing_account_not_found' ||
        outcome === 'billing_customer_conflict' ||
        outcome === 'account_ownership_transitioned'
        ? error
        : asError('billing_dependency_unavailable');
    }

    this.observe({
      operation: 'mapping',
      outcome: mappingOutcome,
      accountId,
      durationMs: Date.now() - startedAt,
    });
    return { accountId, externalCustomerId };
  }

  async process(event: EntitlementLifecycleEvent): Promise<{
    outcome: EntitlementProcessorOutcome;
    accountId?: string;
    projection?: EntitlementProjection | null;
  }> {
    const startedAt = Date.now();
    try {
      const result = await runWriteTransaction(this.db, async (transaction) => {
        await lockCustomerAliases(transaction, event.source, event.customerIds);
        const [inserted] = await transaction
          .insert(billingWebhookEvent)
          .values({
            source: event.source,
            eventId: event.eventId,
            normalizedHash: event.normalizedHash,
            eventTimestamp: new Date(event.eventTimestamp),
            originalEventType: event.originalEventType,
            lifecycleKind: event.kind,
            appId: event.appId,
            environment: event.environment,
            customerIds: [...event.customerIds],
            entitlementIds: [...event.entitlementIds],
            productId: event.productId,
            purchasedAt: event.purchasedAt
              ? new Date(event.purchasedAt)
              : undefined,
            expiresAt: event.expiresAt ? new Date(event.expiresAt) : undefined,
            graceExpiresAt: event.graceExpiresAt
              ? new Date(event.graceExpiresAt)
              : undefined,
            willRenew: event.willRenew,
            outcome: 'processing',
          })
          .onConflictDoNothing()
          .returning({ eventId: billingWebhookEvent.eventId });

        if (!inserted) {
          const [existing] = await transaction
            .select({
              normalizedHash: billingWebhookEvent.normalizedHash,
              accountId: billingWebhookEvent.accountId,
            })
            .from(billingWebhookEvent)
            .where(
              and(
                eq(billingWebhookEvent.source, event.source),
                eq(billingWebhookEvent.eventId, event.eventId)
              )
            );
          return {
            outcome: (existing?.normalizedHash === event.normalizedHash
              ? 'duplicate'
              : 'conflict') as EntitlementProcessorOutcome,
            accountId: existing?.accountId ?? undefined,
          };
        }

        return this.applyStoredEvent(transaction, event);
      });
      this.observe({
        operation: 'webhook',
        outcome: result.outcome,
        accountId: result.accountId,
        eventId: event.eventId,
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      this.observe({
        operation: 'webhook',
        outcome: databaseFailureOutcome(error),
        eventId: event.eventId,
        durationMs: Date.now() - startedAt,
      });
      throw asError('billing_dependency_unavailable');
    }
  }

  private async applyStoredEvent(
    transaction: DbTransaction,
    event: EntitlementLifecycleEvent
  ): Promise<{
    outcome: EntitlementProcessorOutcome;
    accountId?: string;
    projection?: EntitlementProjection | null;
  }> {
    const customerIds = [...new Set(event.customerIds)];
    const mappings =
      customerIds.length === 0
        ? []
        : await transaction
            .select({ accountId: billingCustomerMapping.accountId })
            .from(billingCustomerMapping)
            .where(
              and(
                eq(billingCustomerMapping.source, event.source),
                inArray(billingCustomerMapping.externalCustomerId, customerIds)
              )
            );
    const accountIds = [...new Set(mappings.map((row) => row.accountId))];

    if (accountIds.length === 0) {
      await this.finishWebhookEvent(transaction, event, 'unmapped');
      return { outcome: 'unmapped' };
    }
    if (accountIds.length > 1) {
      await this.finishWebhookEvent(
        transaction,
        event,
        'conflict',
        undefined,
        'customer_mapping_conflict'
      );
      return { outcome: 'conflict' };
    }

    const accountId = accountIds[0];
    await assertAccountAcceptsWrites(transaction, accountId);
    await lockBillingAccount(transaction, accountId);
    await transaction
      .insert(billingCustomerMapping)
      .values(
        customerIds.map((externalCustomerId) => ({
          source: event.source,
          externalCustomerId,
          accountId,
        }))
      )
      .onConflictDoNothing();
    const claimedMappings = await transaction
      .select({
        externalCustomerId: billingCustomerMapping.externalCustomerId,
        accountId: billingCustomerMapping.accountId,
      })
      .from(billingCustomerMapping)
      .where(
        and(
          eq(billingCustomerMapping.source, event.source),
          inArray(billingCustomerMapping.externalCustomerId, customerIds)
        )
      );
    if (
      claimedMappings.length !== customerIds.length ||
      claimedMappings.some((mapping) => mapping.accountId !== accountId)
    ) {
      await this.finishWebhookEvent(
        transaction,
        event,
        'conflict',
        undefined,
        'customer_mapping_conflict'
      );
      return { outcome: 'conflict' };
    }

    const [storedProjection] = await transaction
      .select()
      .from(billingEntitlementProjection)
      .where(eq(billingEntitlementProjection.accountId, accountId))
      .for('update');
    const current = storedProjection ? rowToProjection(storedProjection) : null;
    const reduction = reduceEntitlement(current, event, accountId, this.now());

    if (
      reduction.projection &&
      reduction.decision !== 'ignored' &&
      reduction.decision !== 'stale'
    ) {
      const values = projectionValues(reduction.projection, this.now());
      await transaction
        .insert(billingEntitlementProjection)
        .values(values)
        .onConflictDoUpdate({
          target: billingEntitlementProjection.accountId,
          set: {
            planId: values.planId,
            entitlementId: values.entitlementId,
            productId: values.productId,
            status: values.status,
            willRenew: values.willRenew,
            paidThrough: values.paidThrough,
            graceThrough: values.graceThrough,
            lastEventTimestamp: values.lastEventTimestamp,
            lastEventId: values.lastEventId,
            updatedAt: this.now(),
          },
        });
    }

    const outcome: EntitlementProcessorOutcome =
      reduction.decision === 'apply'
        ? 'applied'
        : reduction.decision === 'stale'
        ? 'stale'
        : 'ignored';
    await this.finishWebhookEvent(transaction, event, outcome, accountId);
    return { outcome, accountId, projection: reduction.projection };
  }

  private async finishWebhookEvent(
    transaction: DbTransaction,
    event: EntitlementLifecycleEvent,
    outcome: EntitlementProcessorOutcome,
    accountId?: string,
    failureCode?: string
  ): Promise<void> {
    await transaction
      .update(billingWebhookEvent)
      .set({
        outcome,
        accountId: accountId ?? null,
        failureCode: failureCode ?? null,
        processedAt: this.now(),
      })
      .where(
        and(
          eq(billingWebhookEvent.source, event.source),
          eq(billingWebhookEvent.eventId, event.eventId)
        )
      );
  }

  private async reconcileUnmappedEvents(
    externalCustomerId: string
  ): Promise<void> {
    const pending = await this.db
      .select({
        source: billingWebhookEvent.source,
        eventId: billingWebhookEvent.eventId,
        customerIds: billingWebhookEvent.customerIds,
      })
      .from(billingWebhookEvent)
      .where(
        and(
          eq(billingWebhookEvent.source, 'revenuecat'),
          eq(billingWebhookEvent.outcome, 'unmapped'),
          sql`${billingWebhookEvent.customerIds} @> ${JSON.stringify([
            externalCustomerId,
          ])}::jsonb`
        )
      )
      .orderBy(
        asc(billingWebhookEvent.eventTimestamp),
        asc(billingWebhookEvent.eventId)
      )
      .limit(RECONCILIATION_BATCH_SIZE);

    for (const pendingEvent of pending) {
      const startedAt = Date.now();
      const result = await runWriteTransaction(this.db, async (transaction) => {
        await lockCustomerAliases(
          transaction,
          pendingEvent.source,
          pendingEvent.customerIds
        );
        const [stored] = await transaction
          .select()
          .from(billingWebhookEvent)
          .where(
            and(
              eq(billingWebhookEvent.source, pendingEvent.source),
              eq(billingWebhookEvent.eventId, pendingEvent.eventId)
            )
          )
          .for('update');
        if (!stored || stored.outcome !== 'unmapped') return null;
        return this.applyStoredEvent(transaction, rowToEvent(stored));
      });
      this.observe({
        operation: 'reconciliation',
        outcome: result?.outcome ?? 'already_reconciled',
        accountId: result?.accountId,
        eventId: pendingEvent.eventId,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  async getProjection(
    accountId: string,
    now = this.now()
  ): Promise<EntitlementProjection | null> {
    const [stored] = await this.db
      .select()
      .from(billingEntitlementProjection)
      .where(eq(billingEntitlementProjection.accountId, accountId));
    return stored ? effectiveEntitlement(rowToProjection(stored), now) : null;
  }

  getEntitlements(accountId: string): Promise<EntitlementProjection | null> {
    return this.getProjection(accountId);
  }

  async getIncludedGenerationUsage(
    accountId: string
  ): Promise<IncludedGenerationUsageSnapshot> {
    const startedAt = Date.now();
    const now = this.now();
    const projection = await this.getProjection(accountId, now);
    const limit = this.limitFor(accountId, projection);
    let window = await this.getActiveWindowSnapshot(accountId, now);
    if (!window) {
      await runWriteTransaction(this.db, async (transaction) => {
        await assertAccountAcceptsWrites(transaction, accountId);
        await lockBillingAccount(transaction, accountId);
        const [account] = await transaction
          .select({ createdAt: user.createdAt })
          .from(user)
          .where(eq(user.id, accountId));
        if (!account) throw asError('billing_account_not_found');
        await this.getOrCreateActiveWindow(
          transaction,
          accountId,
          account.createdAt,
          now
        );
      });
      window = await this.getActiveWindowSnapshot(accountId, now);
    }
    if (!window) throw asError('billing_window_unavailable');

    const result = {
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
      limit,
      used: window.committedCount,
      reserved: window.reserved,
      remaining: Math.max(0, limit - window.committedCount - window.reserved),
    };
    this.observe({
      operation: 'usage_read',
      outcome: 'read',
      accountId,
      durationMs: Date.now() - startedAt,
    });
    return result;
  }

  async checkHealth(): Promise<void> {
    await Promise.all([
      this.db
        .select({ eventId: billingWebhookEvent.eventId })
        .from(billingWebhookEvent)
        .limit(1),
      this.db
        .select({
          externalCustomerId: billingCustomerMapping.externalCustomerId,
        })
        .from(billingCustomerMapping)
        .limit(1),
      this.db
        .select({ accountId: billingEntitlementProjection.accountId })
        .from(billingEntitlementProjection)
        .limit(1),
      this.db
        .select({ id: includedGenerationWindow.id })
        .from(includedGenerationWindow)
        .limit(1),
      this.db
        .select({ id: includedGenerationReservation.id })
        .from(includedGenerationReservation)
        .limit(1),
      this.db.select({ id: aiUsageEvent.id }).from(aiUsageEvent).limit(1),
    ]);
  }

  async reserveGenerate(
    request: IncludedGenerationReserveRequest
  ): Promise<IncludedGenerationReserveResult> {
    const startedAt = Date.now();
    try {
      const result = await runWriteTransaction(this.db, async (transaction) => {
        const now = this.now();
        await assertAccountAcceptsWrites(transaction, request.accountId);
        await lockBillingAccount(transaction, request.accountId);
        const [account] = await transaction
          .select({ id: user.id, createdAt: user.createdAt })
          .from(user)
          .where(eq(user.id, request.accountId));
        if (!account) {
          return {
            allowed: false,
            code: 'dependency_unavailable',
          } as const;
        }
        const [storedEntitlement] = await transaction
          .select()
          .from(billingEntitlementProjection)
          .where(eq(billingEntitlementProjection.accountId, request.accountId));
        const entitlement = storedEntitlement
          ? effectiveEntitlement(rowToProjection(storedEntitlement), now)
          : null;

        const existingRows = await transaction
          .select()
          .from(includedGenerationReservation)
          .where(
            and(
              eq(includedGenerationReservation.accountId, request.accountId),
              eq(
                includedGenerationReservation.operationKey,
                request.operationId
              )
            )
          )
          .orderBy(desc(includedGenerationReservation.createdAt))
          .for('update');
        for (const existing of existingRows) {
          if (existing.status === 'committed') {
            return {
              allowed: true,
              reservation: reservationFromRow(existing),
            } as const;
          }
          if (existing.status === 'pending') {
            return {
              allowed: true,
              reservation: reservationFromRow(existing),
            } as const;
          }
        }

        const window = await this.getOrCreateActiveWindow(
          transaction,
          request.accountId,
          account.createdAt,
          now
        );

        const [active] = await transaction
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(includedGenerationReservation)
          .where(
            and(
              eq(includedGenerationReservation.accountId, request.accountId),
              eq(includedGenerationReservation.windowId, window.id),
              eq(includedGenerationReservation.status, 'pending'),
              gt(includedGenerationReservation.expiresAt, now)
            )
          );
        if (
          window.committedCount + (active?.count ?? 0) >=
          this.limitFor(request.accountId, entitlement)
        ) {
          return {
            allowed: false,
            code: 'quota_exceeded',
            statusCode: 429,
          } as const;
        }

        const [reservation] = await transaction
          .insert(includedGenerationReservation)
          .values({
            id: this.id('reservation'),
            accountId: request.accountId,
            operationKey: request.operationId,
            windowId: window.id,
            operation: request.operation,
            status: 'pending',
            expiresAt: new Date(now.getTime() + this.options.reservationTtlMs),
            updatedAt: now,
          })
          .returning();
        return {
          allowed: true,
          reservation: reservationFromRow(reservation),
        } as const;
      });
      this.observe({
        operation: 'reserve',
        outcome: result.allowed
          ? 'reserved'
          : result.code === 'quota_exceeded'
          ? 'denied'
          : 'dependency_unavailable',
        accountId: request.accountId,
        operationId: request.operationId,
        reservationId: result.allowed
          ? result.reservation?.reservationId
          : undefined,
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      this.observe({
        operation: 'reserve',
        outcome: databaseFailureOutcome(error),
        accountId: request.accountId,
        operationId: request.operationId,
        durationMs: Date.now() - startedAt,
      });
      return { allowed: false, code: 'dependency_unavailable' };
    }
  }

  async commitGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void> {
    const startedAt = Date.now();
    const outcome = await runWriteTransaction(this.db, async (transaction) => {
      const now = this.now();
      await assertAccountAcceptsWrites(transaction, reservation.accountId);
      const [stored] = await transaction
        .select()
        .from(includedGenerationReservation)
        .where(eq(includedGenerationReservation.id, reservation.reservationId))
        .for('update');
      if (
        !stored ||
        stored.accountId !== reservation.accountId ||
        stored.operationKey !== reservation.operationId ||
        stored.expiresAt.toISOString() !== reservation.expiresAt
      ) {
        return 'not_found';
      }
      if (stored.status === 'committed') return 'already_committed';
      if (stored.status !== 'pending' && stored.status !== 'expired') {
        return stored.status;
      }

      await transaction
        .select({ id: includedGenerationWindow.id })
        .from(includedGenerationWindow)
        .where(eq(includedGenerationWindow.id, stored.windowId))
        .for('update');
      await transaction
        .update(includedGenerationReservation)
        .set({ status: 'committed', updatedAt: now })
        .where(eq(includedGenerationReservation.id, stored.id));
      await transaction
        .update(includedGenerationWindow)
        .set({
          committedCount: sql`${includedGenerationWindow.committedCount} + 1`,
        })
        .where(eq(includedGenerationWindow.id, stored.windowId));
      return stored.expiresAt <= now ? 'committed_after_expiry' : 'committed';
    });
    this.observe({
      operation: 'commit',
      outcome,
      accountId: reservation.accountId,
      operationId: reservation.operationId,
      reservationId: reservation.reservationId,
      durationMs: Date.now() - startedAt,
    });
    if (outcome === 'not_found') throw asError('billing_reservation_not_found');
  }

  async rollbackGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void> {
    const startedAt = Date.now();
    const outcome = await runWriteTransaction(this.db, async (transaction) => {
      await assertAccountAcceptsWrites(transaction, reservation.accountId);
      const [stored] = await transaction
        .select()
        .from(includedGenerationReservation)
        .where(eq(includedGenerationReservation.id, reservation.reservationId))
        .for('update');
      if (
        !stored ||
        stored.accountId !== reservation.accountId ||
        stored.operationKey !== reservation.operationId ||
        stored.expiresAt.toISOString() !== reservation.expiresAt
      ) {
        return 'not_found';
      }
      if (stored.status !== 'pending') return stored.status;
      await transaction
        .update(includedGenerationReservation)
        .set({ status: 'rolled_back', updatedAt: this.now() })
        .where(eq(includedGenerationReservation.id, stored.id));
      return 'rolled_back';
    });
    this.observe({
      operation: 'rollback',
      outcome,
      accountId: reservation.accountId,
      operationId: reservation.operationId,
      reservationId: reservation.reservationId,
      durationMs: Date.now() - startedAt,
    });
    if (outcome === 'not_found') throw asError('billing_reservation_not_found');
  }
}

export interface PostgresSpendCeilingPolicyOptions {
  accountDailyLimitNanoUsd: string;
  globalDailyLimitNanoUsd: string;
  now?: () => Date;
  isPricingAvailable: (
    input: Parameters<SpendCeilingPolicy['checkSpendCeiling']>[0]
  ) => boolean | Promise<boolean>;
  observe?: BillingRepositoryObserver;
}

export class PostgresSpendCeilingPolicy implements SpendCeilingPolicy {
  private readonly accountLimit: bigint;
  private readonly globalLimit: bigint;

  constructor(
    private readonly db: Database,
    private readonly options: PostgresSpendCeilingPolicyOptions
  ) {
    this.accountLimit = BigInt(options.accountDailyLimitNanoUsd);
    this.globalLimit = BigInt(options.globalDailyLimitNanoUsd);
    if (this.accountLimit < 0n || this.globalLimit < 0n) {
      throw asError('invalid_spend_ceiling');
    }
  }

  private observe(outcome: BillingRepositoryOutcome): void {
    try {
      this.options.observe?.(outcome);
    } catch {
      // Telemetry must never alter billing decisions.
    }
  }

  async checkSpendCeiling(
    input: Parameters<SpendCeilingPolicy['checkSpendCeiling']>[0]
  ): Promise<SpendCeilingDecision> {
    try {
      if (!(await this.options.isPricingAvailable(input))) {
        this.observe({
          operation: 'spend_ceiling',
          outcome: 'pricing_unavailable',
          accountId: input.accountId,
        });
        return { allowed: false, code: 'pricing_unavailable' };
      }

      const now = this.options.now?.() ?? new Date();
      const startsAt = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );
      const endsAt = new Date(startsAt.getTime() + 86_400_000);
      const [totals] = await this.db
        .select({
          accountNanoUsd: sql<string>`coalesce(sum(${aiUsageEvent.platformCostNanoUsd}) filter (where ${aiUsageEvent.userId} = ${input.accountId}), 0)::text`,
          globalNanoUsd: sql<string>`coalesce(sum(${aiUsageEvent.platformCostNanoUsd}), 0)::text`,
        })
        .from(aiUsageEvent)
        .where(
          and(
            gte(aiUsageEvent.occurredAt, startsAt),
            lt(aiUsageEvent.occurredAt, endsAt)
          )
        );
      const denied =
        BigInt(totals?.accountNanoUsd ?? '0') >= this.accountLimit ||
        BigInt(totals?.globalNanoUsd ?? '0') >= this.globalLimit;
      this.observe({
        operation: 'spend_ceiling',
        outcome: denied ? 'denied' : 'allowed',
        accountId: input.accountId,
      });
      return denied
        ? { allowed: false, code: 'spend_limit_exceeded' }
        : { allowed: true };
    } catch {
      this.observe({
        operation: 'spend_ceiling',
        outcome: 'dependency_unavailable',
        accountId: input.accountId,
      });
      return { allowed: false, code: 'dependency_unavailable' };
    }
  }
}
