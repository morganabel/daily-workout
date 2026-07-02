import type { PolicyResult, UsagePolicy } from '@workout-agent-ce/server-core';
import type {
  BillingEntitlementStatus,
  BillingEntitlementsResponse,
  GenerationRequest,
  UpgradeMetadata,
} from '@workout-agent/shared';

const OPENLIFT_PRO_ENTITLEMENT = 'OpenLift Pro';
const UPGRADE_PRODUCT_IDS = ['weekly', 'monthly', 'yearly'] as const;

type RevenueCatEvent = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[];
  product_id?: string;
};

type BillingTier = 'free' | 'pro';

type UserBillingState = {
  tier: BillingTier;
  status: BillingEntitlementStatus;
  used: number;
  windowStartedAt: number;
  revenueCatCustomerId?: string;
};

type RevenueCatApplyResult = {
  applied: boolean;
  userId?: string;
  reason?: string;
};

const ACTIVE_REVENUECAT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'NON_RENEWING_PURCHASE',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
]);

const INACTIVE_REVENUECAT_EVENTS = new Set(['CANCELLATION', 'EXPIRATION']);

const parsePositiveInt = (
  value: string | undefined,
  fallback: number
): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const freeLimit = (): number =>
  parsePositiveInt(process.env.HOSTED_FREE_GENERATION_LIMIT, 25);
const proLimit = (): number =>
  parsePositiveInt(process.env.HOSTED_PRO_GENERATION_LIMIT, 1_000);
const quotaWindowDays = (): number =>
  parsePositiveInt(process.env.HOSTED_QUOTA_WINDOW_DAYS, 30);

const isWindowExpired = (windowStartedAt: number): boolean => {
  const windowMs = quotaWindowDays() * 24 * 60 * 60 * 1000;
  return Date.now() >= windowStartedAt + windowMs;
};

export class HostedBillingRuntime {
  // WARNING: In-memory only. State is lost on restart/redeploy.
  private readonly userStates = new Map<string, UserBillingState>();
  private readonly customerToUserId = new Map<string, string>();

  private getOrCreateState(userId: string): UserBillingState {
    const existing = this.userStates.get(userId);
    if (existing) {
      if (isWindowExpired(existing.windowStartedAt)) {
        const refreshed = {
          ...existing,
          used: 0,
          windowStartedAt: Date.now(),
        };
        this.userStates.set(userId, refreshed);
        return refreshed;
      }
      return existing;
    }

    const created: UserBillingState = {
      tier: 'free',
      status: 'inactive',
      used: 0,
      windowStartedAt: Date.now(),
    };
    this.userStates.set(userId, created);
    return created;
  }

  private limitForTier(tier: BillingTier): number {
    return tier === 'pro' ? proLimit() : freeLimit();
  }

  private toEntitlements(state: UserBillingState): BillingEntitlementsResponse {
    const startsAt = new Date(state.windowStartedAt);
    const endsAt = new Date(
      state.windowStartedAt + quotaWindowDays() * 24 * 60 * 60 * 1000
    );
    const limit = this.limitForTier(state.tier);
    const used = Math.min(state.used, limit);

    return {
      planId: state.tier,
      entitlementId:
        state.tier === 'pro' && state.status !== 'inactive'
          ? OPENLIFT_PRO_ENTITLEMENT
          : null,
      status: state.status,
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

  private resolveUserId(event: RevenueCatEvent): string | null {
    const direct = event.app_user_id?.trim();
    if (direct) {
      return direct;
    }

    const candidates = [event.original_app_user_id, ...(event.aliases ?? [])]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    for (const customerId of candidates) {
      const mapped = this.customerToUserId.get(customerId);
      if (mapped) {
        return mapped;
      }
    }

    return null;
  }

  getEntitlements(userId: string): BillingEntitlementsResponse {
    const state = this.getOrCreateState(userId);
    return this.toEntitlements(state);
  }

  canGenerate(userId: string): PolicyResult {
    const state = this.getOrCreateState(userId);
    const limit = this.limitForTier(state.tier);
    if (state.used < limit) {
      this.userStates.set(userId, {
        ...state,
        used: state.used + 1,
      });
      return { allowed: true };
    }

    const upgrade: UpgradeMetadata = {
      showUpgradeUi: true,
      purchaseMethod: 'iap',
      entitlementId: OPENLIFT_PRO_ENTITLEMENT,
      offeringId: process.env.REVENUECAT_DEFAULT_OFFERING_ID,
      productIds: [...UPGRADE_PRODUCT_IDS],
    };

    return {
      allowed: false,
      reason: 'Included quota exceeded for current billing window',
      statusCode: 429,
      upgrade,
    };
  }

  rollbackManagedUsage(userId: string): void {
    const state = this.getOrCreateState(userId);
    if (state.used <= 0) {
      return;
    }
    this.userStates.set(userId, {
      ...state,
      used: state.used - 1,
    });
  }

  applyRevenueCatWebhook(event: RevenueCatEvent): RevenueCatApplyResult {
    const userId = this.resolveUserId(event);
    if (!userId) {
      return { applied: false, reason: 'missing_user_mapping' };
    }

    const existing = this.getOrCreateState(userId);
    const eventType = event.type.toUpperCase();
    const hasProEntitlement =
      event.entitlement_ids?.includes(OPENLIFT_PRO_ENTITLEMENT) ?? false;
    const hasKnownProduct =
      event.product_id !== undefined &&
      UPGRADE_PRODUCT_IDS.includes(
        event.product_id as (typeof UPGRADE_PRODUCT_IDS)[number]
      );

    let tier: BillingTier = existing.tier;
    let status: BillingEntitlementStatus = existing.status;

    if (eventType === 'BILLING_ISSUE') {
      tier = 'pro';
      status = 'grace_period';
    } else if (INACTIVE_REVENUECAT_EVENTS.has(eventType)) {
      tier = 'free';
      status = 'inactive';
    } else if (
      ACTIVE_REVENUECAT_EVENTS.has(eventType) ||
      hasKnownProduct ||
      hasProEntitlement
    ) {
      tier = 'pro';
      status = 'active';
    }

    const customerId =
      event.app_user_id?.trim() ?? event.original_app_user_id?.trim();
    if (customerId) {
      this.customerToUserId.set(customerId, userId);
    }

    this.userStates.set(userId, {
      ...existing,
      tier,
      status,
      revenueCatCustomerId: customerId ?? existing.revenueCatCustomerId,
    });

    return { applied: true, userId };
  }
}

export class HostedUsagePolicy implements UsagePolicy {
  constructor(private readonly runtime: HostedBillingRuntime) {}

  async canGenerate(userId: string): Promise<PolicyResult> {
    return this.runtime.canGenerate(userId);
  }

  async getEntitlements(userId: string): Promise<BillingEntitlementsResponse> {
    return this.runtime.getEntitlements(userId);
  }

  async rollbackGenerateReservation(
    userId: string,
    _request: GenerationRequest
  ): Promise<void> {
    this.runtime.rollbackManagedUsage(userId);
  }
}

export const hostedBillingRuntime = new HostedBillingRuntime();
