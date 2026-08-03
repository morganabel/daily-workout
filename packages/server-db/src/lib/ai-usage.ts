import {
  assertUsageEvent,
  type MeteringSink,
  type UsageEvent,
} from '@workout-agent-ce/metering';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { createHash } from 'node:crypto';

import type { Database } from './client.js';
import { aiModelCall, aiUsageEvent } from './schema.js';

type UsageTotals = {
  requestCount: number;
  successfulRequestCount: number;
  failedRequestCount: number;
  callCount: number;
  unknownCostCallCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  accountedCostNanoUsd: string;
  platformCostNanoUsd: string;
  byokEstimatedCostNanoUsd: string;
  allowanceChargeNanoUsd: string;
};

function emptyTotals(): UsageTotals {
  return {
    requestCount: 0,
    successfulRequestCount: 0,
    failedRequestCount: 0,
    callCount: 0,
    unknownCostCallCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    totalTokens: 0,
    accountedCostNanoUsd: '0',
    platformCostNanoUsd: '0',
    byokEstimatedCostNanoUsd: '0',
    allowanceChargeNanoUsd: '0',
  };
}

function addEventToTotals(
  totals: UsageTotals,
  event: typeof aiUsageEvent.$inferSelect
): void {
  totals.requestCount += 1;
  totals.successfulRequestCount += event.result === 'success' ? 1 : 0;
  totals.failedRequestCount += event.result === 'success' ? 0 : 1;
  totals.callCount += event.callCount;
  totals.unknownCostCallCount += event.unknownCostCallCount;
  totals.inputTokens += event.inputTokens;
  totals.outputTokens += event.outputTokens;
  totals.cachedInputTokens += event.cachedInputTokens;
  totals.totalTokens += event.totalTokens;
  totals.accountedCostNanoUsd = (
    BigInt(totals.accountedCostNanoUsd) + BigInt(event.accountedCostNanoUsd)
  ).toString();
  totals.platformCostNanoUsd = (
    BigInt(totals.platformCostNanoUsd) + BigInt(event.platformCostNanoUsd)
  ).toString();
  totals.byokEstimatedCostNanoUsd = (
    BigInt(totals.byokEstimatedCostNanoUsd) +
    BigInt(event.byokEstimatedCostNanoUsd)
  ).toString();
  totals.allowanceChargeNanoUsd = (
    BigInt(totals.allowanceChargeNanoUsd) + BigInt(event.allowanceChargeNanoUsd)
  ).toString();
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function usageEventStorageId(event: UsageEvent): string {
  const digest = createHash('sha256')
    .update(JSON.stringify(canonicalize(event)))
    .digest('hex');
  return `usage_${digest}`;
}

/** Durable, idempotent operation and per-call ledger for hosted generation. */
export class PostgresMeteringSink implements MeteringSink {
  constructor(private readonly db: Database) {}

  async recordUsage(event: UsageEvent): Promise<void> {
    assertUsageEvent(event);

    const operationId = event.operationId;
    const usage = event.usage;
    const modelCalls = event.modelCalls;
    const storageId = usageEventStorageId(event);
    await this.db.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(aiUsageEvent)
        .values({
          id: storageId,
          operationId,
          eventId: event.eventId,
          userId: event.userId,
          operation: event.operation,
          provider: event.provider,
          credentialSource: event.credentialSource,
          result: event.result,
          byok: event.byok,
          occurredAt: new Date(event.timestamp),
          durationMs: event.durationMs,
          callCount: usage.callCount,
          successfulCallCount: usage.successfulCallCount,
          failedCallCount: usage.failedCallCount,
          unknownCostCallCount: usage.unknownCostCallCount,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          reasoningOutputTokens: usage.reasoningOutputTokens,
          totalTokens: usage.totalTokens,
          accountedCostNanoUsd: BigInt(usage.accountedCostNanoUsd),
          platformCostNanoUsd: BigInt(usage.platformCostNanoUsd),
          byokEstimatedCostNanoUsd: BigInt(usage.byokEstimatedCostNanoUsd),
          allowanceChargeNanoUsd: BigInt(usage.allowanceChargeNanoUsd),
        })
        .onConflictDoNothing()
        .returning({ id: aiUsageEvent.id });

      if (inserted.length === 0) {
        const [stored] = await transaction
          .select({ id: aiUsageEvent.id })
          .from(aiUsageEvent)
          .where(
            and(
              eq(aiUsageEvent.userId, event.userId),
              eq(aiUsageEvent.operationId, operationId),
              eq(aiUsageEvent.eventId, event.eventId)
            )
          );
        if (stored?.id !== storageId) {
          throw new Error('metering_event_conflict');
        }
        return;
      }

      if (modelCalls.length === 0) {
        return;
      }

      await transaction.insert(aiModelCall).values(
        modelCalls.map((call, index) => ({
          id: `${storageId}:${index}`,
          usageEventId: storageId,
          phase: call.phase,
          provider: call.provider,
          requestedModel: call.requestedModel,
          resolvedModel: call.resolvedModel,
          responseId: call.responseId,
          status: call.status,
          startedAt: new Date(call.startedAt),
          durationMs: call.durationMs,
          inputTokens: call.tokens?.inputTokens,
          outputTokens: call.tokens?.outputTokens,
          cachedInputTokens: call.tokens?.cachedInputTokens,
          reasoningOutputTokens: call.tokens?.reasoningOutputTokens,
          totalTokens: call.tokens?.totalTokens,
          costAmountNanoUsd:
            call.cost.amountNanoUsd === undefined
              ? undefined
              : BigInt(call.cost.amountNanoUsd),
          costSource: call.cost.source,
          pricingSnapshotId: call.cost.pricingSnapshotId,
          upstreamAttemptCount: call.upstreamAttemptCount,
          errorCode: call.errorCode,
        }))
      );
    });
  }
}

export async function getAiUsageSummary(
  db: Database,
  params: {
    userId: string;
    startsAt: Date;
    endsAt: Date;
    recentLimit?: number;
    shadowBudgetNanoUsd?: string;
  }
) {
  const events = await db
    .select()
    .from(aiUsageEvent)
    .where(
      and(
        eq(aiUsageEvent.userId, params.userId),
        gte(aiUsageEvent.occurredAt, params.startsAt),
        lt(aiUsageEvent.occurredAt, params.endsAt)
      )
    )
    .orderBy(desc(aiUsageEvent.occurredAt));
  const totals = emptyTotals();
  const byProvider: Record<string, UsageTotals> = {};

  for (const event of events) {
    addEventToTotals(totals, event);
    const providerTotals = (byProvider[event.provider] ??= emptyTotals());
    addEventToTotals(providerTotals, event);
  }

  const budget = params.shadowBudgetNanoUsd;
  const platformCost = BigInt(totals.platformCostNanoUsd);
  const budgetLimit = budget ? BigInt(budget) : undefined;

  return {
    window: {
      startsAt: params.startsAt.toISOString(),
      endsAt: params.endsAt.toISOString(),
    },
    totals,
    byProvider,
    shadowBudget:
      budgetLimit === undefined
        ? null
        : {
            limitNanoUsd: budgetLimit.toString(),
            remainingNanoUsd:
              platformCost >= budgetLimit
                ? '0'
                : (budgetLimit - platformCost).toString(),
            exceeded: platformCost > budgetLimit,
            utilizationPercent:
              budgetLimit === 0n
                ? platformCost > 0n
                  ? 100
                  : 0
                : (Number(platformCost) / Number(budgetLimit)) * 100,
          },
    recentRequests: events.slice(0, params.recentLimit ?? 50).map((event) => ({
      operationId: event.operationId,
      operation: event.operation,
      provider: event.provider,
      credentialSource: event.credentialSource,
      result: event.result,
      timestamp: event.occurredAt.toISOString(),
      durationMs: event.durationMs,
      callCount: event.callCount,
      totalTokens: event.totalTokens,
      accountedCostNanoUsd: event.accountedCostNanoUsd.toString(),
      allowanceChargeNanoUsd: event.allowanceChargeNanoUsd.toString(),
    })),
  };
}
