import { v7 as uuidv7 } from 'uuid';

import {
  effectiveEntitlement,
  reduceEntitlement,
  type BillingCustomerBootstrap,
  type EntitlementEventProcessor,
  type EntitlementLifecycleEvent,
  type EntitlementProcessorOutcome,
  type EntitlementProjection,
} from './entitlements';
import type {
  IncludedGenerationReservation,
  IncludedGenerationReserveRequest,
  IncludedGenerationReserveResult,
  ProviderAdmissionLease,
  ProviderAdmissionPolicy,
  ProviderAdmissionResult,
  SpendCeilingDecision,
  SpendCeilingPolicy,
  UsagePolicy,
} from './generation-policy';

function id(prefix: string): string {
  return `${prefix}_${uuidv7()}`;
}

export class InMemoryEntitlementProcessor
  implements EntitlementEventProcessor, BillingCustomerBootstrap
{
  private readonly events = new Map<string, string>();
  private readonly unmappedEvents = new Map<
    string,
    EntitlementLifecycleEvent
  >();
  private readonly customers = new Map<string, string>();
  private readonly projections = new Map<string, EntitlementProjection>();

  async bootstrapAuthenticatedCustomer(input: {
    accountId: string;
    externalCustomerId: string;
  }): Promise<{ accountId: string; externalCustomerId: string }> {
    const owner = this.customers.get(input.externalCustomerId);
    if (owner && owner !== input.accountId) {
      throw new Error('billing_customer_conflict');
    }
    this.customers.set(input.externalCustomerId, input.accountId);
    for (const [ledgerKey, event] of this.unmappedEvents) {
      const accountId = this.accountFor(event);
      if (!accountId || accountId === 'conflict') continue;
      this.applyMappedEvent(event, accountId);
      this.unmappedEvents.delete(ledgerKey);
    }
    return input;
  }

  private accountFor(
    event: EntitlementLifecycleEvent
  ): string | 'conflict' | undefined {
    const owners = new Set(
      event.customerIds
        .map((customerId) => this.customers.get(customerId))
        .filter((candidate): candidate is string => Boolean(candidate))
    );
    if (owners.size > 1) return 'conflict';
    const accountId = owners.values().next().value as string | undefined;
    if (!accountId) return undefined;
    for (const customerId of event.customerIds) {
      this.customers.set(customerId, accountId);
    }
    return accountId;
  }

  private applyMappedEvent(
    event: EntitlementLifecycleEvent,
    accountId: string
  ): {
    outcome: EntitlementProcessorOutcome;
    accountId: string;
    projection: EntitlementProjection | null;
  } {
    const reduction = reduceEntitlement(
      this.projections.get(accountId) ?? null,
      event,
      accountId
    );
    if (reduction.projection && reduction.decision !== 'ignored') {
      this.projections.set(accountId, reduction.projection);
    }
    const outcome: EntitlementProcessorOutcome =
      reduction.decision === 'apply'
        ? 'applied'
        : reduction.decision === 'stale'
        ? 'stale'
        : 'ignored';
    return { outcome, accountId, projection: reduction.projection };
  }

  async process(event: EntitlementLifecycleEvent): Promise<{
    outcome: EntitlementProcessorOutcome;
    accountId?: string;
    projection?: EntitlementProjection | null;
  }> {
    const ledgerKey = `${event.source}:${event.eventId}`;
    const existingHash = this.events.get(ledgerKey);
    if (existingHash) {
      return {
        outcome:
          existingHash === event.normalizedHash ? 'duplicate' : 'conflict',
      };
    }
    this.events.set(ledgerKey, event.normalizedHash);

    const accountId = this.accountFor(event);
    if (accountId === 'conflict') {
      return { outcome: 'conflict' };
    }
    if (!accountId) {
      this.unmappedEvents.set(ledgerKey, event);
      return { outcome: 'unmapped' };
    }

    return this.applyMappedEvent(event, accountId);
  }

  getProjection(
    accountId: string,
    now = new Date()
  ): EntitlementProjection | null {
    const projection = this.projections.get(accountId);
    return projection ? effectiveEntitlement(projection, now) : null;
  }
}

export interface InMemoryUsagePolicyOptions {
  limit: number | ((accountId: string) => number);
  reservationTtlMs?: number;
}

export class InMemoryUsagePolicy implements UsagePolicy {
  private readonly committed = new Map<string, number>();
  private readonly reservations = new Map<
    string,
    IncludedGenerationReservation
  >();
  private readonly operationReservations = new Map<
    string,
    IncludedGenerationReservation
  >();
  private readonly committedReservations = new Set<string>();
  private readonly rolledBackReservations = new Set<string>();
  private readonly ttlMs: number;

  constructor(private readonly options: InMemoryUsagePolicyOptions) {
    this.ttlMs = options.reservationTtlMs ?? 5 * 60_000;
  }

  private limitFor(accountId: string): number {
    return typeof this.options.limit === 'function'
      ? this.options.limit(accountId)
      : this.options.limit;
  }

  async reserveGenerate(
    request: IncludedGenerationReserveRequest
  ): Promise<IncludedGenerationReserveResult> {
    const operationKey = `${request.accountId}:${request.operationId}`;
    const replay = this.operationReservations.get(operationKey);
    if (replay) return { allowed: true, reservation: replay };

    const active = [...this.reservations.values()].filter(
      (reservation) =>
        reservation.accountId === request.accountId &&
        !this.committedReservations.has(reservation.reservationId) &&
        !this.rolledBackReservations.has(reservation.reservationId) &&
        Date.parse(reservation.expiresAt) > Date.now()
    ).length;
    const used = this.committed.get(request.accountId) ?? 0;
    if (used + active >= this.limitFor(request.accountId)) {
      return { allowed: false, code: 'quota_exceeded', statusCode: 429 };
    }

    const reservation: IncludedGenerationReservation = {
      kind: 'included_generation',
      reservationId: id('allowance'),
      accountId: request.accountId,
      operationId: request.operationId,
      expiresAt: new Date(Date.now() + this.ttlMs).toISOString(),
    };
    this.reservations.set(reservation.reservationId, reservation);
    this.operationReservations.set(operationKey, reservation);
    return { allowed: true, reservation };
  }

  async commitGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void> {
    const stored = this.assertStoredReservation(reservation);
    if (
      this.committedReservations.has(stored.reservationId) ||
      this.rolledBackReservations.has(stored.reservationId)
    ) {
      return;
    }
    this.committedReservations.add(stored.reservationId);
    this.committed.set(
      stored.accountId,
      (this.committed.get(stored.accountId) ?? 0) + 1
    );
  }

  async rollbackGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void> {
    const stored = this.assertStoredReservation(reservation);
    if (
      this.committedReservations.has(stored.reservationId) ||
      this.rolledBackReservations.has(stored.reservationId)
    ) {
      return;
    }
    this.rolledBackReservations.add(stored.reservationId);
    this.operationReservations.delete(
      `${stored.accountId}:${stored.operationId}`
    );
  }

  private assertStoredReservation(
    reservation: IncludedGenerationReservation
  ): IncludedGenerationReservation {
    const stored = this.reservations.get(reservation.reservationId);
    if (
      !stored ||
      stored.kind !== reservation.kind ||
      stored.accountId !== reservation.accountId ||
      stored.operationId !== reservation.operationId ||
      stored.expiresAt !== reservation.expiresAt
    ) {
      throw new Error('billing_reservation_not_found');
    }
    return stored;
  }

  getCommitted(accountId: string): number {
    return this.committed.get(accountId) ?? 0;
  }
}

export interface InMemoryAdmissionOptions {
  accountRequestLimit: number;
  maxActivePerAccount: number;
  windowMs?: number;
  leaseTtlMs?: number;
}

export class InMemoryProviderAdmission implements ProviderAdmissionPolicy {
  private readonly accountRequests = new Map<
    string,
    { count: number; startedAt: number }
  >();
  private readonly leases = new Map<string, ProviderAdmissionLease>();
  private readonly operationLeases = new Map<string, ProviderAdmissionLease>();

  constructor(private readonly options: InMemoryAdmissionOptions) {}

  private requestCount(
    windows: Map<string, { count: number; startedAt: number }>,
    key: string,
    now: number
  ): number {
    const window = windows.get(key);
    if (
      !window ||
      now >= window.startedAt + (this.options.windowMs ?? 60_000)
    ) {
      windows.delete(key);
      return 0;
    }
    return window.count;
  }

  private incrementRequestCount(
    windows: Map<string, { count: number; startedAt: number }>,
    key: string,
    now: number
  ): void {
    const existing = windows.get(key);
    const count = this.requestCount(windows, key, now);
    windows.set(key, {
      count: count + 1,
      startedAt: count === 0 ? now : existing?.startedAt ?? now,
    });
  }

  private removeExpiredLeases(now: number): void {
    for (const lease of this.leases.values()) {
      if (Date.parse(lease.expiresAt) <= now) {
        this.leases.delete(lease.leaseId);
        this.operationLeases.delete(`${lease.accountId}:${lease.operationId}`);
      }
    }
  }

  async acquireProviderAdmission(input: {
    accountId: string;
    operationId: string;
  }): Promise<ProviderAdmissionResult> {
    const now = Date.now();
    this.removeExpiredLeases(now);
    const operationKey = `${input.accountId}:${input.operationId}`;
    const replay = this.operationLeases.get(operationKey);
    if (replay) return { allowed: true, lease: replay };

    const accountCount = this.requestCount(
      this.accountRequests,
      input.accountId,
      now
    );
    if (accountCount >= this.options.accountRequestLimit) {
      return { allowed: false, code: 'account_rate_limited' };
    }
    const active = [...this.leases.values()].filter(
      (lease) => lease.accountId === input.accountId
    ).length;
    if (active >= this.options.maxActivePerAccount) {
      return { allowed: false, code: 'concurrency_limited' };
    }
    this.incrementRequestCount(this.accountRequests, input.accountId, now);
    const lease: ProviderAdmissionLease = {
      kind: 'provider_admission',
      leaseId: id('admission'),
      accountId: input.accountId,
      operationId: input.operationId,
      expiresAt: new Date(
        now + (this.options.leaseTtlMs ?? 5 * 60_000)
      ).toISOString(),
    };
    this.leases.set(lease.leaseId, lease);
    this.operationLeases.set(operationKey, lease);
    return { allowed: true, lease };
  }

  async releaseProviderAdmission(lease: ProviderAdmissionLease): Promise<void> {
    this.leases.delete(lease.leaseId);
    this.operationLeases.delete(`${lease.accountId}:${lease.operationId}`);
  }
}

export interface InMemorySpendCeilingOptions {
  accountDailyLimitNanoUsd: bigint;
  globalDailyLimitNanoUsd: bigint;
}

/**
 * Settle-only spend ceilings for tests and local development. The durable
 * implementation evaluates the same decision from metered `ai_usage_event`
 * cost data; day-window bounds live in that query, not in this contract.
 */
export class InMemorySpendCeilingPolicy implements SpendCeilingPolicy {
  private readonly settledByAccount = new Map<string, bigint>();
  private settledGlobal = 0n;

  constructor(private readonly options: InMemorySpendCeilingOptions) {}

  settleActualCost(input: {
    accountId: string;
    actualCostNanoUsd: string;
  }): void {
    const actual = BigInt(input.actualCostNanoUsd);
    this.settledByAccount.set(
      input.accountId,
      (this.settledByAccount.get(input.accountId) ?? 0n) + actual
    );
    this.settledGlobal += actual;
  }

  async checkSpendCeiling(
    input: Parameters<SpendCeilingPolicy['checkSpendCeiling']>[0]
  ): Promise<SpendCeilingDecision> {
    const account = this.settledByAccount.get(input.accountId) ?? 0n;
    if (
      account >= this.options.accountDailyLimitNanoUsd ||
      this.settledGlobal >= this.options.globalDailyLimitNanoUsd
    ) {
      return { allowed: false, code: 'spend_limit_exceeded' };
    }
    return { allowed: true };
  }

  totals(): { globalSettledNanoUsd: string } {
    return { globalSettledNanoUsd: this.settledGlobal.toString() };
  }
}
