import { createHash } from 'node:crypto';
import {
  type BillingEnvironment,
  type EntitlementLifecycleEvent,
  type EntitlementLifecycleKind,
} from '@workout-agent-ce/quotas';
import { z } from 'zod';

const MAX_ID_LENGTH = 160;
const MAX_ALIASES = 32;
const MAX_ENTITLEMENTS = 16;

export const REVENUECAT_EVENT_TYPES = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'NON_RENEWING_PURCHASE',
  'CANCELLATION',
  'UNCANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
  'TRANSFER',
  'SUBSCRIPTION_PAUSED',
] as const;

const boundedId = z.string().trim().min(1).max(MAX_ID_LENGTH);

export const revenueCatEventSchema = z
  .object({
    id: boundedId,
    type: z.enum(REVENUECAT_EVENT_TYPES),
    event_timestamp_ms: z.number().int().nonnegative().safe(),
    app_id: boundedId,
    environment: z.enum(['SANDBOX', 'PRODUCTION']),
    app_user_id: boundedId.optional(),
    original_app_user_id: boundedId.optional(),
    aliases: z.array(boundedId).max(MAX_ALIASES).optional(),
    entitlement_ids: z.array(boundedId).max(MAX_ENTITLEMENTS).optional(),
    product_id: boundedId.optional(),
    purchased_at_ms: z.number().int().nonnegative().safe().optional(),
    expiration_at_ms: z.number().int().nonnegative().safe().optional(),
    grace_period_expiration_at_ms: z
      .number()
      .int()
      .nonnegative()
      .safe()
      .optional(),
  })
  .passthrough();

export const revenueCatWebhookSchema = z
  .object({ event: revenueCatEventSchema })
  .passthrough();

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;

export interface RevenueCatDomainConfig {
  allowedAppIds: ReadonlySet<string>;
  allowedEnvironments: ReadonlySet<BillingEnvironment>;
  allowedEntitlementIds: ReadonlySet<string>;
  allowedProductIds: ReadonlySet<string>;
}

const KIND_BY_EVENT: Record<
  (typeof REVENUECAT_EVENT_TYPES)[number],
  EntitlementLifecycleKind
> = {
  INITIAL_PURCHASE: 'grant',
  RENEWAL: 'renew',
  NON_RENEWING_PURCHASE: 'grant',
  CANCELLATION: 'cancel_renewal',
  UNCANCELLATION: 'restore_renewal',
  EXPIRATION: 'expire',
  BILLING_ISSUE: 'billing_issue',
  PRODUCT_CHANGE: 'product_change',
  TRANSFER: 'unsupported',
  SUBSCRIPTION_PAUSED: 'unsupported',
};

function iso(milliseconds: number | undefined): string | undefined {
  return milliseconds === undefined
    ? undefined
    : new Date(milliseconds).toISOString();
}

function normalizedHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class RevenueCatNormalizationError extends Error {
  constructor(readonly code: 'invalid_scope' | 'incomplete_event') {
    super(code);
  }
}

export function normalizeRevenueCatEvent(
  event: RevenueCatEvent,
  config: RevenueCatDomainConfig
): EntitlementLifecycleEvent {
  if (
    !config.allowedAppIds.has(event.app_id) ||
    !config.allowedEnvironments.has(event.environment)
  ) {
    throw new RevenueCatNormalizationError('invalid_scope');
  }

  const customerIds = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ].filter((value): value is string => Boolean(value));
  const entitlementIds = [...new Set(event.entitlement_ids ?? [])].sort();
  const kind = KIND_BY_EVENT[event.type];
  const stateChanging = kind !== 'unsupported';

  if (
    stateChanging &&
    (customerIds.length === 0 ||
      !event.product_id ||
      entitlementIds.length === 0 ||
      event.expiration_at_ms === undefined)
  ) {
    throw new RevenueCatNormalizationError('incomplete_event');
  }
  if (
    (event.product_id && !config.allowedProductIds.has(event.product_id)) ||
    entitlementIds.some((id) => !config.allowedEntitlementIds.has(id))
  ) {
    throw new RevenueCatNormalizationError('invalid_scope');
  }

  const normalized = {
    source: 'revenuecat' as const,
    eventId: event.id,
    eventTimestamp: new Date(event.event_timestamp_ms).toISOString(),
    originalEventType: event.type,
    kind,
    appId: event.app_id,
    environment: event.environment,
    customerIds: [...new Set(customerIds)].sort(),
    entitlementIds,
    productId: event.product_id,
    purchasedAt: iso(event.purchased_at_ms),
    expiresAt: iso(event.expiration_at_ms),
    graceExpiresAt: iso(event.grace_period_expiration_at_ms),
    willRenew:
      event.type === 'NON_RENEWING_PURCHASE' ||
      kind === 'cancel_renewal' ||
      kind === 'expire'
        ? false
        : event.type === 'INITIAL_PURCHASE' ||
          kind === 'restore_renewal' ||
          kind === 'renew'
        ? true
        : undefined,
  };

  return { ...normalized, normalizedHash: normalizedHash(normalized) };
}
