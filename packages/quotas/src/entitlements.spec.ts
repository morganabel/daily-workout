import {
  InMemoryEntitlementProcessor,
  reduceEntitlement,
  type EntitlementLifecycleEvent,
  type EntitlementProjection,
} from '.';
import { verifyEntitlementProcessorContract } from './testing';

function event(
  overrides: Partial<EntitlementLifecycleEvent> = {}
): EntitlementLifecycleEvent {
  return {
    source: 'revenuecat',
    eventId: 'event-1',
    eventTimestamp: '2026-08-02T12:00:00.000Z',
    originalEventType: 'INITIAL_PURCHASE',
    kind: 'grant',
    appId: 'app.test',
    environment: 'SANDBOX',
    customerIds: ['rc-user'],
    entitlementIds: ['Leveza Pro'],
    productId: 'monthly',
    expiresAt: '2026-09-02T12:00:00.000Z',
    normalizedHash: 'hash-1',
    ...overrides,
  };
}

const current: EntitlementProjection = {
  accountId: 'user-1',
  planId: 'pro',
  entitlementId: 'Leveza Pro',
  productId: 'monthly',
  status: 'active',
  willRenew: true,
  paidThrough: '2026-09-02T12:00:00.000Z',
  graceThrough: null,
  lastEventTimestamp: '2026-08-02T12:00:00.000Z',
  lastEventId: 'event-1',
};

describe('entitlement lifecycle', () => {
  it('passes the reusable event-processor and mapping contract', async () => {
    await verifyEntitlementProcessorContract(
      () => new InMemoryEntitlementProcessor()
    );
  });

  it('cancellation disables renewal without shortening paid access', () => {
    const result = reduceEntitlement(
      current,
      event({
        eventId: 'event-2',
        eventTimestamp: '2026-08-03T12:00:00.000Z',
        kind: 'cancel_renewal',
        originalEventType: 'CANCELLATION',
        expiresAt: '2026-08-20T12:00:00.000Z',
      }),
      'user-1',
      new Date('2026-08-04T00:00:00.000Z')
    );

    expect(result).toMatchObject({
      decision: 'apply',
      projection: {
        status: 'active',
        willRenew: false,
        paidThrough: '2026-09-02T12:00:00.000Z',
      },
    });
  });

  it('a newer expiration revokes access even when it shortens paidThrough', () => {
    const expired = reduceEntitlement(
      current,
      event({
        eventId: 'event-3',
        eventTimestamp: '2026-08-03T12:00:00.000Z',
        kind: 'expire',
        originalEventType: 'EXPIRATION',
        expiresAt: '2026-08-03T12:00:00.000Z',
      }),
      'user-1',
      new Date('2026-08-03T12:00:01.000Z')
    );
    expect(expired.projection).toMatchObject({
      status: 'inactive',
      paidThrough: '2026-08-03T12:00:00.000Z',
      willRenew: false,
    });

    expect(
      reduceEntitlement(
        expired.projection,
        event({ eventTimestamp: '2026-08-01T00:00:00.000Z' }),
        'user-1'
      ).decision
    ).toBe('stale');
  });

  it('preserves renewal state unless the lifecycle event specifies it', () => {
    const changed = reduceEntitlement(
      { ...current, willRenew: false },
      event({
        eventId: 'event-4',
        eventTimestamp: '2026-08-04T12:00:00.000Z',
        kind: 'product_change',
        originalEventType: 'PRODUCT_CHANGE',
      }),
      'user-1'
    );
    expect(changed.projection?.willRenew).toBe(false);

    const nonRenewing = reduceEntitlement(
      null,
      event({
        kind: 'grant',
        originalEventType: 'NON_RENEWING_PURCHASE',
        willRenew: false,
      }),
      'user-1'
    );
    expect(nonRenewing.projection?.willRenew).toBe(false);
  });

  it('extends access and restores refunded access without inventing renewal', () => {
    const canceled = { ...current, willRenew: false };
    const extended = reduceEntitlement(
      canceled,
      event({
        eventId: 'event-5',
        eventTimestamp: '2026-08-05T12:00:00.000Z',
        kind: 'extend',
        originalEventType: 'SUBSCRIPTION_EXTENDED',
        expiresAt: '2026-10-02T12:00:00.000Z',
      }),
      'user-1'
    );
    expect(extended.projection).toMatchObject({
      status: 'active',
      paidThrough: '2026-10-02T12:00:00.000Z',
      willRenew: false,
    });

    const restored = reduceEntitlement(
      { ...canceled, status: 'inactive' },
      event({
        eventId: 'event-6',
        eventTimestamp: '2026-08-06T12:00:00.000Z',
        kind: 'restore_access',
        originalEventType: 'REFUND_REVERSED',
      }),
      'user-1'
    );
    expect(restored.projection).toMatchObject({
      status: 'active',
      willRenew: false,
    });
  });

  it('separates duplicate, conflict, unmapped, and applied outcomes', async () => {
    const processor = new InMemoryEntitlementProcessor();
    await expect(processor.process(event())).resolves.toMatchObject({
      outcome: 'unmapped',
    });
    await expect(processor.process(event())).resolves.toMatchObject({
      outcome: 'duplicate',
    });
    await expect(
      processor.process(event({ normalizedHash: 'changed' }))
    ).resolves.toMatchObject({ outcome: 'conflict' });

    const mapped = new InMemoryEntitlementProcessor();
    await mapped.bootstrapAuthenticatedCustomer({
      accountId: 'user-1',
      externalCustomerId: 'rc-user',
    });
    await expect(mapped.process(event())).resolves.toMatchObject({
      outcome: 'applied',
      accountId: 'user-1',
    });
  });

  it('does not allow another account to claim an existing customer mapping', async () => {
    const processor = new InMemoryEntitlementProcessor();
    await processor.bootstrapAuthenticatedCustomer({
      accountId: 'user-1',
      externalCustomerId: 'rc-user',
    });
    await expect(
      processor.bootstrapAuthenticatedCustomer({
        accountId: 'user-2',
        externalCustomerId: 'rc-user',
      })
    ).rejects.toThrow('billing_customer_conflict');
  });
});
