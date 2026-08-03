export const ENTITLEMENT_LIFECYCLE_KINDS = [
  'grant',
  'renew',
  'cancel_renewal',
  'restore_renewal',
  'expire',
  'billing_issue',
  'product_change',
  'extend',
  'restore_access',
  'unsupported',
] as const;

export type EntitlementLifecycleKind =
  (typeof ENTITLEMENT_LIFECYCLE_KINDS)[number];
export type BillingEnvironment = 'SANDBOX' | 'PRODUCTION';
export type EntitlementStatus =
  | 'inactive'
  | 'active'
  | 'grace_period'
  | 'past_due';
export type EntitlementReducerDecision =
  | 'apply'
  | 'stale'
  | 'ignored'
  | 'no_change';
export type EntitlementProcessorOutcome =
  | 'applied'
  | 'duplicate'
  | 'stale'
  | 'ignored'
  | 'unmapped'
  | 'conflict';

export interface EntitlementLifecycleEvent {
  source: 'revenuecat';
  eventId: string;
  eventTimestamp: string;
  originalEventType: string;
  kind: EntitlementLifecycleKind;
  appId: string;
  environment: BillingEnvironment;
  customerIds: readonly string[];
  entitlementIds: readonly string[];
  productId?: string;
  purchasedAt?: string;
  expiresAt?: string;
  graceExpiresAt?: string;
  willRenew?: boolean;
  normalizedHash: string;
}

export interface EntitlementProjection {
  accountId: string;
  planId: string;
  entitlementId: string | null;
  productId: string | null;
  status: EntitlementStatus;
  willRenew: boolean;
  paidThrough: string | null;
  graceThrough: string | null;
  lastEventTimestamp: string;
  lastEventId: string;
}

export interface EntitlementReduction {
  decision: EntitlementReducerDecision;
  projection: EntitlementProjection | null;
}

function orderingKey(timestamp: string, eventId: string): string {
  return `${timestamp}\u0000${eventId}`;
}

function laterTimestamp(
  current: string | null | undefined,
  candidate: string | undefined
): string | null {
  if (!candidate) return current ?? null;
  if (!current) return candidate;
  return candidate > current ? candidate : current;
}

function sameState(
  left: EntitlementProjection | null,
  right: EntitlementProjection | null
): boolean {
  if (!left || !right) return left === right;
  return (
    left.planId === right.planId &&
    left.entitlementId === right.entitlementId &&
    left.productId === right.productId &&
    left.status === right.status &&
    left.willRenew === right.willRenew &&
    left.paidThrough === right.paidThrough &&
    left.graceThrough === right.graceThrough
  );
}

export function reduceEntitlement(
  current: EntitlementProjection | null,
  event: EntitlementLifecycleEvent,
  accountId: string,
  now: Date = new Date()
): EntitlementReduction {
  if (event.kind === 'unsupported') {
    return { decision: 'ignored', projection: current };
  }

  if (
    current &&
    orderingKey(event.eventTimestamp, event.eventId) <
      orderingKey(current.lastEventTimestamp, current.lastEventId)
  ) {
    return { decision: 'stale', projection: current };
  }

  const base: EntitlementProjection = current ?? {
    accountId,
    planId: 'free',
    entitlementId: null,
    productId: null,
    status: 'inactive',
    willRenew: false,
    paidThrough: null,
    graceThrough: null,
    lastEventTimestamp: event.eventTimestamp,
    lastEventId: event.eventId,
  };
  const entitlementId = event.entitlementIds[0] ?? base.entitlementId;
  const paidThrough = laterTimestamp(base.paidThrough, event.expiresAt);
  const next: EntitlementProjection = {
    ...base,
    lastEventTimestamp: event.eventTimestamp,
    lastEventId: event.eventId,
  };

  switch (event.kind) {
    case 'grant':
    case 'renew':
    case 'product_change':
    case 'restore_access':
      Object.assign(next, {
        planId: 'pro',
        entitlementId,
        productId: event.productId ?? base.productId,
        status: 'active',
        willRenew: event.willRenew ?? base.willRenew,
        paidThrough,
        graceThrough: null,
      });
      break;
    case 'extend':
      Object.assign(next, {
        planId: entitlementId ? 'pro' : base.planId,
        entitlementId,
        productId: event.productId ?? base.productId,
        status:
          paidThrough && paidThrough > now.toISOString()
            ? 'active'
            : base.status,
        willRenew: event.willRenew ?? base.willRenew,
        paidThrough,
      });
      break;
    case 'cancel_renewal':
      Object.assign(next, {
        planId: entitlementId ? 'pro' : base.planId,
        entitlementId,
        productId: event.productId ?? base.productId,
        status:
          paidThrough && paidThrough > now.toISOString()
            ? 'active'
            : base.status,
        willRenew: false,
        paidThrough,
      });
      break;
    case 'restore_renewal':
      Object.assign(next, {
        planId: 'pro',
        entitlementId,
        productId: event.productId ?? base.productId,
        status: 'active',
        willRenew: true,
        paidThrough,
      });
      break;
    case 'expire':
      Object.assign(next, {
        status: 'inactive',
        willRenew: false,
        paidThrough: event.expiresAt ?? base.paidThrough,
        graceThrough: null,
      });
      break;
    case 'billing_issue': {
      const graceThrough = laterTimestamp(
        base.graceThrough,
        event.graceExpiresAt
      );
      Object.assign(next, {
        planId: 'pro',
        entitlementId,
        productId: event.productId ?? base.productId,
        status:
          graceThrough && graceThrough > now.toISOString()
            ? 'grace_period'
            : 'past_due',
        willRenew: event.willRenew ?? base.willRenew,
        paidThrough,
        graceThrough,
      });
      break;
    }
  }

  return {
    decision: sameState(current, next) ? 'no_change' : 'apply',
    projection: next,
  };
}

export function effectiveEntitlement(
  projection: EntitlementProjection,
  now: Date = new Date()
): EntitlementProjection {
  const boundary = laterTimestamp(
    projection.paidThrough,
    projection.graceThrough ?? undefined
  );
  if (boundary && boundary <= now.toISOString()) {
    return { ...projection, status: 'inactive', willRenew: false };
  }
  return projection;
}

export interface EntitlementEventProcessor {
  process(event: EntitlementLifecycleEvent): Promise<{
    outcome: EntitlementProcessorOutcome;
    accountId?: string;
    projection?: EntitlementProjection | null;
  }>;
}

export interface BillingCustomerBootstrap {
  bootstrapAuthenticatedCustomer(input: {
    accountId: string;
    externalCustomerId: string;
  }): Promise<{ accountId: string; externalCustomerId: string }>;
}
