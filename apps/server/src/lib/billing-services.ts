import {
  MODEL_PRICING,
  type MeteringSink,
} from '@workout-agent-ce/metering';
import {
  InMemoryProviderAdmission,
  type EntitlementProjection,
  type ProviderAdmissionPolicy,
  type SpendCeilingPolicy,
  type UpgradeMetadata,
  type UsagePolicy,
} from '@workout-agent-ce/quotas';
import {
  PostgresBillingRepository,
  PostgresMeteringSink,
  PostgresSpendCeilingPolicy,
} from '@workout-agent-ce/server-db';
import type { BillingEntitlementsResponse } from '@workout-agent/shared';
import { getAuthContext } from './auth-context';
import {
  getBillingConfig,
  type RevenueCatBillingConfig,
} from './billing-config';

export interface RevenueCatBillingServices {
  config: RevenueCatBillingConfig;
  repository: PostgresBillingRepository;
  usagePolicy: UsagePolicy;
  admissionPolicy: ProviderAdmissionPolicy;
  spendCeilingPolicy: SpendCeilingPolicy;
  meteringSink: MeteringSink;
  getEntitlements(accountId: string): Promise<BillingEntitlementsResponse>;
}

let servicesPromise: Promise<RevenueCatBillingServices> | null = null;

export function includedGenerationLimitFor(
  config: Pick<
    RevenueCatBillingConfig,
    'freeGenerationLimit' | 'proGenerationLimit'
  >,
  entitlement: EntitlementProjection | null
): number {
  return entitlement?.planId === 'pro' && entitlement.status !== 'inactive'
    ? config.proGenerationLimit
    : config.freeGenerationLimit;
}

function observeBillingOutcome(outcome: {
  operation: string;
  outcome: string;
  accountId?: string;
  eventId?: string;
  operationId?: string;
  reservationId?: string;
}): void {
  console.info('[billing]', outcome);
}

function configuredModels(provider: 'openai' | 'gemini' | 'openrouter') {
  const includePlanner = process.env.ENABLE_STAGE_ONE_PLANNER !== 'false';
  if (provider === 'openai') {
    return [
      process.env.OPENAI_MODEL ?? 'gpt-5.6-luna',
      ...(includePlanner
        ? [process.env.OPENAI_PLANNER_MODEL ?? 'gpt-5.6-luna']
        : []),
    ];
  }
  if (provider === 'gemini') {
    return [
      process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
      ...(includePlanner
        ? [process.env.GEMINI_PLANNER_MODEL ?? 'gemini-3.1-flash-lite']
        : []),
    ];
  }
  return [
    process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash-0731',
    ...(includePlanner
      ? [
          process.env.OPENROUTER_PLANNER_MODEL ??
            'deepseek/deepseek-v4-flash-0731',
        ]
      : []),
  ];
}

export function configuredPricingAvailable(
  provider: 'openai' | 'gemini' | 'openrouter',
  credentialSource: 'managed' | 'vertex' | 'byok'
): boolean {
  if (provider === 'openrouter') return true;
  const endpoint = credentialSource === 'vertex' ? 'vertex' : 'standard';
  return configuredModels(provider).every((model) =>
    MODEL_PRICING.some(
      (pricing) =>
        pricing.provider === provider &&
        pricing.endpoint === endpoint &&
        (model === pricing.model || model.startsWith(`${pricing.model}-`))
    )
  );
}

export function quotaUpgradeMetadata(
  config: Pick<
    RevenueCatBillingConfig,
    'showUpgradeUi' | 'domainConfig' | 'defaultOfferingId'
  >
): UpgradeMetadata {
  if (!config.showUpgradeUi) {
    return { showUpgradeUi: false, purchaseMethod: 'none' };
  }
  return {
    showUpgradeUi: true,
    purchaseMethod: 'iap',
    entitlementId: [...config.domainConfig.allowedEntitlementIds][0],
    offeringId: config.defaultOfferingId,
    productIds: [...config.domainConfig.allowedProductIds],
  };
}

async function createRevenueCatBillingServices(
  config: RevenueCatBillingConfig
): Promise<RevenueCatBillingServices> {
  const { db } = await getAuthContext();
  if (!db) {
    throw new Error('billing_dependency_unavailable');
  }

  const repository = new PostgresBillingRepository(db, {
    includedGenerationLimit: (_accountId, entitlement) =>
      includedGenerationLimitFor(config, entitlement),
    quotaWindowDays: config.quotaWindowDays,
    reservationTtlMs: config.pendingReservationTtlMs,
    observe: observeBillingOutcome,
  });
  const admissionPolicy = new InMemoryProviderAdmission({
    accountRequestLimit: config.accountRequestsPerMinute,
    maxActivePerAccount: config.accountMaxActiveGenerations,
    windowMs: 60_000,
    leaseTtlMs: config.pendingReservationTtlMs,
  });
  const spendCeilingPolicy = new PostgresSpendCeilingPolicy(db, {
    accountDailyLimitNanoUsd: config.accountDailySpendLimitNanoUsd,
    globalDailyLimitNanoUsd: config.globalDailySpendLimitNanoUsd,
    isPricingAvailable: ({ provider, credentialSource }) =>
      configuredPricingAvailable(provider, credentialSource),
    observe: observeBillingOutcome,
  });
  const usagePolicy: UsagePolicy = {
    async reserveGenerate(request) {
      const result = await repository.reserveGenerate(request);
      if (result.allowed || result.code !== 'quota_exceeded') return result;
      return {
        ...result,
        upgrade: quotaUpgradeMetadata(config),
      };
    },
    commitGenerateReservation: (reservation) =>
      repository.commitGenerateReservation(reservation),
    rollbackGenerateReservation: (reservation) =>
      repository.rollbackGenerateReservation(reservation),
    getEntitlements: (accountId) => repository.getEntitlements(accountId),
  };

  return {
    config,
    repository,
    usagePolicy,
    admissionPolicy,
    spendCeilingPolicy,
    meteringSink: new PostgresMeteringSink(db),
    async getEntitlements(accountId) {
      const [projection, quotaWindow] = await Promise.all([
        repository.getProjection(accountId),
        repository.getIncludedGenerationUsage(accountId),
      ]);
      return {
        planId: projection?.planId ?? 'free',
        entitlementId: projection?.entitlementId ?? null,
        status: projection?.status ?? 'inactive',
        willRenew: projection?.willRenew ?? false,
        paidThrough: projection?.paidThrough ?? null,
        graceThrough: projection?.graceThrough ?? null,
        quotaWindow: {
          startsAt: quotaWindow.startsAt,
          endsAt: quotaWindow.endsAt,
          limit: quotaWindow.limit,
          used: quotaWindow.used,
          remaining: quotaWindow.remaining,
        },
        refreshedAt: new Date().toISOString(),
      };
    },
  };
}

export function getRevenueCatBillingServices(): Promise<RevenueCatBillingServices> {
  const config = getBillingConfig();
  if (config.provider !== 'revenuecat') {
    return Promise.reject(new Error('billing_provider_disabled'));
  }
  servicesPromise ??= createRevenueCatBillingServices(config).catch((error) => {
    servicesPromise = null;
    throw error;
  });
  return servicesPromise;
}
