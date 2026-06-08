import { z } from 'zod';

export const billingPurchaseMethodSchema = z.enum(['none', 'iap']);
export type BillingPurchaseMethod = z.infer<typeof billingPurchaseMethodSchema>;

export const billingCapabilitiesSchema = z
  .object({
    enabled: z.boolean(),
    showUpgradeUi: z.boolean(),
    purchaseMethod: billingPurchaseMethodSchema,
    allowByok: z.boolean(),
  })
  .strict();

export type BillingCapabilities = z.infer<typeof billingCapabilitiesSchema>;

const BILLING_DEFAULTS: BillingCapabilities = {
  enabled: false,
  showUpgradeUi: false,
  purchaseMethod: 'none',
  allowByok: true,
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
    quotaWindow: billingQuotaWindowSchema,
    refreshedAt: z.string().datetime(),
  })
  .strict();

export type BillingEntitlementsResponse = z.infer<
  typeof billingEntitlementsResponseSchema
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
