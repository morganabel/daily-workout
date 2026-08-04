import {
  InMemoryEntitlementProcessor,
  InMemoryUsagePolicy,
  type EntitlementLifecycleEvent,
  type EntitlementProcessorOutcome,
  type IncludedGenerationReservation,
  type IncludedGenerationReserveRequest,
  type IncludedGenerationReserveResult,
  type UsagePolicy,
} from '@workout-agent-ce/quotas';
import type { BillingEntitlementsResponse } from '@workout-agent/shared';
import type { RevenueCatDomainConfig } from './revenuecat';

const OPENLIFT_PRO_ENTITLEMENT = 'OpenLift Pro';
const UPGRADE_PRODUCT_IDS = ['weekly', 'monthly', 'yearly'] as const;

const parsePositiveInt = (
  value: string | undefined,
  fallback: number
): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const quotaWindowDays = (): number =>
  parsePositiveInt(process.env.HOSTED_QUOTA_WINDOW_DAYS, 30);

export class HostedBillingRuntime implements UsagePolicy {
  readonly domainConfig: RevenueCatDomainConfig = {
    allowedAppIds: new Set(['app.test']),
    allowedEnvironments: new Set(['SANDBOX', 'PRODUCTION']),
    allowedEntitlementIds: new Set([OPENLIFT_PRO_ENTITLEMENT]),
    allowedProductIds: new Set(UPGRADE_PRODUCT_IDS),
  };

  private readonly entitlements = new InMemoryEntitlementProcessor();
  private readonly usage = new InMemoryUsagePolicy({
    limit: (accountId) =>
      this.entitlements.getProjection(accountId)?.planId === 'pro'
        ? parsePositiveInt(process.env.HOSTED_PRO_GENERATION_LIMIT, 1_000)
        : parsePositiveInt(process.env.HOSTED_FREE_GENERATION_LIMIT, 25),
  });
  private readonly windowStartedAt = Date.now();

  bootstrapAuthenticatedCustomer(
    accountId: string,
    externalCustomerId = accountId
  ): Promise<{ accountId: string; externalCustomerId: string }> {
    return this.entitlements.bootstrapAuthenticatedCustomer({
      accountId,
      externalCustomerId,
    });
  }

  async applyRevenueCatWebhook(event: EntitlementLifecycleEvent): Promise<{
    outcome: EntitlementProcessorOutcome;
    accountId?: string;
  }> {
    const result = await this.entitlements.process(event);
    return { outcome: result.outcome, accountId: result.accountId };
  }

  reserveGenerate(
    request: IncludedGenerationReserveRequest
  ): Promise<IncludedGenerationReserveResult> {
    return this.usage.reserveGenerate(request);
  }

  commitGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void> {
    return this.usage.commitGenerateReservation(reservation);
  }

  rollbackGenerateReservation(
    reservation: IncludedGenerationReservation
  ): Promise<void> {
    return this.usage.rollbackGenerateReservation(reservation);
  }

  async getEntitlements(
    accountId: string
  ): Promise<BillingEntitlementsResponse> {
    const projection = this.entitlements.getProjection(accountId);
    const startsAt = new Date(this.windowStartedAt);
    const endsAt = new Date(
      this.windowStartedAt + quotaWindowDays() * 24 * 60 * 60 * 1000
    );
    const limit = parsePositiveInt(
      projection?.planId === 'pro'
        ? process.env.HOSTED_PRO_GENERATION_LIMIT
        : process.env.HOSTED_FREE_GENERATION_LIMIT,
      projection?.planId === 'pro' ? 1_000 : 25
    );
    const used = Math.min(this.usage.getCommitted(accountId), limit);

    return {
      planId: projection?.planId ?? 'free',
      entitlementId: projection?.entitlementId ?? null,
      status: projection?.status ?? 'inactive',
      willRenew: projection?.willRenew ?? false,
      paidThrough: projection?.paidThrough ?? null,
      graceThrough: projection?.graceThrough ?? null,
      quotaWindow: {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        limit,
        used,
        remaining: Math.max(0, limit - used),
      },
      refreshedAt: new Date().toISOString(),
    };
  }
}

export const hostedBillingRuntime = new HostedBillingRuntime();
