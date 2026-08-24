import { and, eq, gt, isNotNull, lte, or, sql } from 'drizzle-orm';

import type { Database } from './client.js';
import {
  accountTransition,
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

export type AccountTransitionMethod = 'email' | 'google';
export type AccountTransitionState =
  | 'transitioning'
  | 'completed'
  | 'blocked'
  | 'failed';

export type AccountTransitionFailureCode =
  | 'source_not_anonymous'
  | 'target_not_authenticated'
  | 'target_has_application_state'
  | 'source_target_conflict'
  | 'migration_failed';

export interface TransitionAnonymousAccountInput {
  sourceUserId: string;
  targetUserId: string;
  method: AccountTransitionMethod;
}

export interface AccountTransitionRecord {
  sourceUserId: string;
  targetUserId: string;
  method: AccountTransitionMethod;
  state: AccountTransitionState;
  failureCode: AccountTransitionFailureCode | null;
  attemptCount: number;
  completedAt: Date | null;
}

export type AccountTransitionPhase =
  | 'validated'
  | 'ledger_started'
  | 'usage_moved'
  | 'quota_moved'
  | 'billing_moved'
  | 'completed';

export interface AccountTransitionHooks {
  /** Test/diagnostic seam; production callers omit this. */
  afterPhase?: (phase: AccountTransitionPhase) => Promise<void> | void;
}

export interface AccountTransitionDiagnostics {
  total: number;
  byState: Record<AccountTransitionState, number>;
  byFailureCode: Partial<Record<AccountTransitionFailureCode, number>>;
  retried: number;
  completedButNotCleanedUp: number;
}

export class AccountTransitionError extends Error {
  constructor(readonly code: AccountTransitionFailureCode) {
    super(code);
    this.name = 'AccountTransitionError';
  }
}

export class AccountOwnershipTransitionError extends Error {
  readonly code = 'account_ownership_transitioned';

  constructor() {
    super('account_ownership_transitioned');
    this.name = 'AccountOwnershipTransitionError';
  }
}

async function lockOwnershipIds(
  transaction: DbTransaction,
  userIds: readonly string[]
): Promise<void> {
  const ids = [...new Set(userIds)].sort();
  await transaction.execute(sql`
    select pg_advisory_xact_lock(
      hashtextextended('account-transition:' || locked.user_id, 0)
    )
    from jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)
      as locked(user_id)
    order by locked.user_id
  `);
}

/** Serialize an application write with any transition sourced from userId. */
export async function assertAccountAcceptsWrites(
  transaction: DbTransaction,
  userId: string
): Promise<void> {
  await lockOwnershipIds(transaction, [userId]);
  const [transition] = await transaction
    .select({ state: accountTransition.state })
    .from(accountTransition)
    .where(eq(accountTransition.sourceUserId, userId))
    .limit(1);

  if (
    transition?.state === 'transitioning' ||
    transition?.state === 'completed'
  ) {
    throw new AccountOwnershipTransitionError();
  }
}

async function targetHasApplicationState(
  transaction: DbTransaction,
  targetUserId: string
): Promise<boolean> {
  const probes = [
    transaction
      .select({ value: aiUsageEvent.id })
      .from(aiUsageEvent)
      .where(eq(aiUsageEvent.userId, targetUserId))
      .limit(1),
    transaction
      .select({ value: includedGenerationWindow.id })
      .from(includedGenerationWindow)
      .where(eq(includedGenerationWindow.accountId, targetUserId))
      .limit(1),
    transaction
      .select({ value: includedGenerationReservation.id })
      .from(includedGenerationReservation)
      .where(eq(includedGenerationReservation.accountId, targetUserId))
      .limit(1),
    transaction
      .select({ value: billingAccountIdentity.externalCustomerId })
      .from(billingAccountIdentity)
      .where(eq(billingAccountIdentity.accountId, targetUserId))
      .limit(1),
    transaction
      .select({ value: billingCustomerMapping.externalCustomerId })
      .from(billingCustomerMapping)
      .where(eq(billingCustomerMapping.accountId, targetUserId))
      .limit(1),
    transaction
      .select({ value: billingEntitlementProjection.accountId })
      .from(billingEntitlementProjection)
      .where(eq(billingEntitlementProjection.accountId, targetUserId))
      .limit(1),
    transaction
      .select({ value: billingWebhookEvent.eventId })
      .from(billingWebhookEvent)
      .where(eq(billingWebhookEvent.accountId, targetUserId))
      .limit(1),
  ];

  // Keep these sequential: node-postgres transactions use one connection.
  for (const probe of probes) {
    if ((await probe).length > 0) return true;
  }
  return false;
}

async function persistFailure(
  db: Database,
  input: TransitionAnonymousAccountInput,
  code: AccountTransitionFailureCode
): Promise<void> {
  await db.transaction(async (transaction) => {
    await lockOwnershipIds(transaction, [input.sourceUserId]);
    const [existing] = await transaction
      .select({ targetUserId: accountTransition.targetUserId })
      .from(accountTransition)
      .where(eq(accountTransition.sourceUserId, input.sourceUserId))
      .limit(1);
    if (existing && existing.targetUserId !== input.targetUserId) return;

    const now = new Date();
    const state =
      code === 'migration_failed' || code === 'source_not_anonymous'
        ? 'failed'
        : 'blocked';
    await transaction
      .insert(accountTransition)
      .values({
        sourceUserId: input.sourceUserId,
        targetUserId: input.targetUserId,
        method: input.method,
        state,
        failureCode: code,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: accountTransition.sourceUserId,
        set: {
          method: input.method,
          state,
          failureCode: code,
          attemptCount: sql`${accountTransition.attemptCount} + 1`,
          updatedAt: now,
        },
      });
  });
}

function classifyTransitionError(error: unknown): AccountTransitionFailureCode {
  return error instanceof AccountTransitionError
    ? error.code
    : 'migration_failed';
}

/**
 * Move Workout Agent-owned state from anonymous A to authenticated B.
 * Better Auth remains solely responsible for auth users, accounts, sessions,
 * provider profiles, and deleting A after this callback commits.
 */
export async function transitionAnonymousAccount(
  db: Database,
  input: TransitionAnonymousAccountInput,
  hooks: AccountTransitionHooks = {}
): Promise<AccountTransitionRecord> {
  try {
    if (input.sourceUserId === input.targetUserId) {
      throw new AccountTransitionError('source_target_conflict');
    }

    return await db.transaction(async (transaction) => {
      await lockOwnershipIds(transaction, [
        input.sourceUserId,
        input.targetUserId,
      ]);

      const [existing] = await transaction
        .select()
        .from(accountTransition)
        .where(eq(accountTransition.sourceUserId, input.sourceUserId))
        .limit(1)
        .for('update');
      if (existing) {
        if (existing.targetUserId !== input.targetUserId) {
          throw new AccountTransitionError('source_target_conflict');
        }
        if (existing.state === 'completed') {
          const [retried] = await transaction
            .update(accountTransition)
            .set({
              attemptCount: sql`${accountTransition.attemptCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(accountTransition.sourceUserId, input.sourceUserId))
            .returning();
          return retried as AccountTransitionRecord;
        }
      }

      const principals = await transaction
        .select({ id: user.id, isAnonymous: user.isAnonymous })
        .from(user)
        .where(
          or(eq(user.id, input.sourceUserId), eq(user.id, input.targetUserId))
        )
        .for('update');
      const source = principals.find((row) => row.id === input.sourceUserId);
      const target = principals.find((row) => row.id === input.targetUserId);
      if (!source?.isAnonymous) {
        throw new AccountTransitionError('source_not_anonymous');
      }
      if (!target || target.isAnonymous) {
        throw new AccountTransitionError('target_not_authenticated');
      }
      if (await targetHasApplicationState(transaction, input.targetUserId)) {
        throw new AccountTransitionError('target_has_application_state');
      }
      await hooks.afterPhase?.('validated');

      const now = new Date();
      await transaction
        .insert(accountTransition)
        .values({
          sourceUserId: input.sourceUserId,
          targetUserId: input.targetUserId,
          method: input.method,
          state: 'transitioning',
          failureCode: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: accountTransition.sourceUserId,
          set: {
            method: input.method,
            state: 'transitioning',
            failureCode: null,
            attemptCount: sql`${accountTransition.attemptCount} + 1`,
            updatedAt: now,
          },
        });
      await hooks.afterPhase?.('ledger_started');

      await transaction
        .update(aiUsageEvent)
        .set({ userId: input.targetUserId })
        .where(eq(aiUsageEvent.userId, input.sourceUserId));
      await hooks.afterPhase?.('usage_moved');
      await transaction
        .update(includedGenerationWindow)
        .set({ accountId: input.targetUserId })
        .where(eq(includedGenerationWindow.accountId, input.sourceUserId));
      await transaction
        .update(includedGenerationReservation)
        .set({ accountId: input.targetUserId })
        .where(eq(includedGenerationReservation.accountId, input.sourceUserId));
      await hooks.afterPhase?.('quota_moved');
      await transaction
        .update(billingAccountIdentity)
        .set({ accountId: input.targetUserId })
        .where(eq(billingAccountIdentity.accountId, input.sourceUserId));
      await transaction
        .update(billingCustomerMapping)
        .set({ accountId: input.targetUserId })
        .where(eq(billingCustomerMapping.accountId, input.sourceUserId));
      await transaction
        .update(billingWebhookEvent)
        .set({ accountId: input.targetUserId })
        .where(eq(billingWebhookEvent.accountId, input.sourceUserId));
      await transaction
        .update(billingEntitlementProjection)
        .set({ accountId: input.targetUserId, updatedAt: now })
        .where(eq(billingEntitlementProjection.accountId, input.sourceUserId));
      await hooks.afterPhase?.('billing_moved');

      const [completed] = await transaction
        .update(accountTransition)
        .set({
          state: 'completed',
          failureCode: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(accountTransition.sourceUserId, input.sourceUserId),
            eq(accountTransition.targetUserId, input.targetUserId)
          )
        )
        .returning();
      if (!completed) throw new Error('account transition ledger unavailable');
      await hooks.afterPhase?.('completed');
      return completed as AccountTransitionRecord;
    });
  } catch (error) {
    const code = classifyTransitionError(error);
    await persistFailure(db, input, code);
    throw error instanceof AccountTransitionError
      ? error
      : new AccountTransitionError(code);
  }
}

export async function getCompletedAccountTransitionForTarget(
  db: Database,
  sourceUserId: string,
  targetUserId: string
): Promise<AccountTransitionRecord | null> {
  const [record] = await db
    .select()
    .from(accountTransition)
    .where(
      and(
        eq(accountTransition.sourceUserId, sourceUserId),
        eq(accountTransition.targetUserId, targetUserId),
        eq(accountTransition.state, 'completed')
      )
    )
    .limit(1);
  return (record as AccountTransitionRecord | undefined) ?? null;
}

/** Aggregate-only diagnostics; no account identifiers or credentials leave the DB. */
export async function getAccountTransitionDiagnostics(
  db: Database,
  options: { now?: Date; cleanupThresholdMs?: number } = {}
): Promise<AccountTransitionDiagnostics> {
  const now = options.now ?? new Date();
  const cleanupThresholdMs = options.cleanupThresholdMs ?? 15 * 60_000;
  const cleanupCutoff = new Date(now.getTime() - cleanupThresholdMs);

  const [stateRows, failureRows, retriedRows, cleanupRows] = await Promise.all([
    db
      .select({
        state: accountTransition.state,
        count: sql<number>`count(*)::int`,
      })
      .from(accountTransition)
      .groupBy(accountTransition.state),
    db
      .select({
        failureCode: accountTransition.failureCode,
        count: sql<number>`count(*)::int`,
      })
      .from(accountTransition)
      .where(isNotNull(accountTransition.failureCode))
      .groupBy(accountTransition.failureCode),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountTransition)
      .where(gt(accountTransition.attemptCount, 1)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountTransition)
      .innerJoin(user, eq(user.id, accountTransition.sourceUserId))
      .where(
        and(
          eq(accountTransition.state, 'completed'),
          isNotNull(accountTransition.completedAt),
          lte(accountTransition.completedAt, cleanupCutoff)
        )
      ),
  ]);

  const byState: Record<AccountTransitionState, number> = {
    transitioning: 0,
    completed: 0,
    blocked: 0,
    failed: 0,
  };
  for (const row of stateRows) {
    if (row.state in byState) {
      byState[row.state as AccountTransitionState] = Number(row.count);
    }
  }
  const byFailureCode: Partial<Record<AccountTransitionFailureCode, number>> =
    {};
  for (const row of failureRows) {
    if (row.failureCode) {
      byFailureCode[row.failureCode as AccountTransitionFailureCode] = Number(
        row.count
      );
    }
  }

  return {
    total: Object.values(byState).reduce((sum, count) => sum + count, 0),
    byState,
    byFailureCode,
    retried: Number(retriedRows[0]?.count ?? 0),
    completedButNotCleanedUp: Number(cleanupRows[0]?.count ?? 0),
  };
}
