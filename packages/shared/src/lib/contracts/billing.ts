import { z } from 'zod';

export const billingPurchaseMethodSchema = z.enum(['none', 'iap']);
export type BillingPurchaseMethod = z.infer<typeof billingPurchaseMethodSchema>;

export const billingCapabilitiesSchema = z
  .object({
    enabled: z.boolean(),
    showUpgradeUi: z.boolean(),
    purchaseMethod: billingPurchaseMethodSchema,
    allowByok: z.boolean(),
    /** Public RevenueCat entitlement used to gate the upgrade paywall. */
    upgradeEntitlementId: z.string().min(1).nullable().default(null),
  })
  .strict();

export type BillingCapabilities = z.infer<typeof billingCapabilitiesSchema>;

const BILLING_DEFAULTS: BillingCapabilities = {
  enabled: false,
  showUpgradeUi: false,
  purchaseMethod: 'none',
  allowByok: true,
  upgradeEntitlementId: null,
};

export function createBillingCapabilities(
  overrides: Partial<BillingCapabilities> = {}
): BillingCapabilities {
  return {
    ...BILLING_DEFAULTS,
    ...overrides,
  };
}

export function resolveBillingCapabilities(
  billing?: BillingCapabilities | null
): BillingCapabilities {
  return createBillingCapabilities(billing ?? {});
}

export const billingEntitlementStatusSchema = z.enum([
  'inactive',
  'active',
  'grace_period',
  'past_due',
]);
export type BillingEntitlementStatus = z.infer<
  typeof billingEntitlementStatusSchema
>;

export const billingQuotaWindowSchema = z
  .object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    limit: z.number().int().nonnegative(),
    used: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
  })
  .strict();

export type BillingQuotaWindow = z.infer<typeof billingQuotaWindowSchema>;

export const billingEntitlementsResponseSchema = z
  .object({
    planId: z.string().nullable(),
    entitlementId: z.string().nullable(),
    status: billingEntitlementStatusSchema,
    willRenew: z.boolean(),
    paidThrough: z.string().datetime().nullable(),
    graceThrough: z.string().datetime().nullable(),
    quotaWindow: billingQuotaWindowSchema,
    refreshedAt: z.string().datetime(),
  })
  .strict();

export type BillingEntitlementsResponse = z.infer<
  typeof billingEntitlementsResponseSchema
>;

export const billingIdentityResponseSchema = z
  .object({
    appUserId: z.string().min(16).max(128),
  })
  .strict();

export type BillingIdentityResponse = z.infer<
  typeof billingIdentityResponseSchema
>;

const nanoUsdSchema = z.string().regex(/^\d+$/);

export const billingAiUsageTotalsSchema = z
  .object({
    requestCount: z.number().int().nonnegative(),
    successfulRequestCount: z.number().int().nonnegative(),
    failedRequestCount: z.number().int().nonnegative(),
    callCount: z.number().int().nonnegative(),
    unknownCostCallCount: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    accountedCostNanoUsd: nanoUsdSchema,
    platformCostNanoUsd: nanoUsdSchema,
    byokEstimatedCostNanoUsd: nanoUsdSchema,
    allowanceChargeNanoUsd: nanoUsdSchema,
  })
  .strict();
export type BillingAiUsageTotals = z.infer<typeof billingAiUsageTotalsSchema>;

export const billingAiUsageResponseSchema = z
  .object({
    window: z
      .object({
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
      })
      .strict(),
    totals: billingAiUsageTotalsSchema,
    byProvider: z.record(z.string(), billingAiUsageTotalsSchema),
    shadowBudget: z
      .object({
        limitNanoUsd: nanoUsdSchema,
        remainingNanoUsd: nanoUsdSchema,
        exceeded: z.boolean(),
        utilizationPercent: z.number().nonnegative(),
      })
      .strict()
      .nullable(),
    recentRequests: z.array(
      z
        .object({
          operationId: z.string().min(1),
          operation: z.enum(['generate', 'regenerate']),
          provider: z.enum(['openai', 'gemini', 'openrouter']),
          credentialSource: z.enum(['managed', 'vertex', 'byok']).nullable(),
          result: z.enum(['success', 'error']).nullable(),
          timestamp: z.string().datetime(),
          durationMs: z.number().int().nonnegative().nullable(),
          callCount: z.number().int().nonnegative(),
          totalTokens: z.number().int().nonnegative(),
          accountedCostNanoUsd: nanoUsdSchema,
          allowanceChargeNanoUsd: nanoUsdSchema,
        })
        .strict()
    ),
  })
  .strict();
export type BillingAiUsageResponse = z.infer<
  typeof billingAiUsageResponseSchema
>;

export const upgradeMetadataSchema = z
  .object({
    showUpgradeUi: z.boolean().optional(),
    purchaseMethod: billingPurchaseMethodSchema.optional(),
    entitlementId: z.string().optional(),
    offeringId: z.string().optional(),
    productIds: z.array(z.string()).optional(),
  })
  .strict();

export type UpgradeMetadata = z.infer<typeof upgradeMetadataSchema>;
