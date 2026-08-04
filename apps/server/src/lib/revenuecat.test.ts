import {
  normalizeRevenueCatEvent,
  RevenueCatNormalizationError,
  revenueCatWebhookSchema,
  type RevenueCatDomainConfig,
} from './revenuecat';

const domainConfig: RevenueCatDomainConfig = {
  allowedAppIds: new Set(['app.test']),
  allowedEnvironments: new Set(['SANDBOX']),
  allowedEntitlementIds: new Set(['OpenLift Pro']),
  allowedProductIds: new Set(['monthly']),
};

const event = (overrides: Record<string, unknown> = {}) => ({
  id: 'event-1',
  type: 'INITIAL_PURCHASE' as const,
  event_timestamp_ms: Date.parse('2026-08-02T12:00:00.000Z'),
  app_id: 'app.test',
  environment: 'SANDBOX' as const,
  app_user_id: 'rc-user-1',
  entitlement_ids: ['OpenLift Pro'],
  product_id: 'monthly',
  expiration_at_ms: Date.parse('2026-09-02T12:00:00.000Z'),
  ...overrides,
});

describe('RevenueCat normalization', () => {
  it('retains bounded lifecycle identity and produces a stable normalized hash', () => {
    const normalized = normalizeRevenueCatEvent(
      revenueCatWebhookSchema.parse({ event: event() }).event,
      domainConfig
    );
    const replay = normalizeRevenueCatEvent(
      revenueCatWebhookSchema.parse({ event: event() }).event,
      domainConfig
    );

    expect(normalized).toMatchObject({
      eventId: 'event-1',
      eventTimestamp: '2026-08-02T12:00:00.000Z',
      appId: 'app.test',
      environment: 'SANDBOX',
      customerIds: ['rc-user-1'],
      entitlementIds: ['OpenLift Pro'],
      productId: 'monthly',
      expiresAt: '2026-09-02T12:00:00.000Z',
      willRenew: true,
    });
    expect(replay.normalizedHash).toBe(normalized.normalizedHash);
  });

  it('normalizes non-renewing, extension, and refund-reversal semantics', () => {
    const nonRenewing = normalizeRevenueCatEvent(
      revenueCatWebhookSchema.parse({
        event: event({ type: 'NON_RENEWING_PURCHASE' }),
      }).event,
      domainConfig
    );
    expect(nonRenewing).toMatchObject({ kind: 'grant', willRenew: false });

    const extended = normalizeRevenueCatEvent(
      revenueCatWebhookSchema.parse({
        event: event({ type: 'SUBSCRIPTION_EXTENDED' }),
      }).event,
      domainConfig
    );
    expect(extended).toMatchObject({ kind: 'extend' });
    expect(extended.willRenew).toBeUndefined();

    const restored = normalizeRevenueCatEvent(
      revenueCatWebhookSchema.parse({
        event: event({ type: 'REFUND_REVERSED' }),
      }).event,
      domainConfig
    );
    expect(restored).toMatchObject({ kind: 'restore_access' });
    expect(restored.willRenew).toBeUndefined();
  });

  it('rejects incomplete state-changing events after envelope parsing', () => {
    const parsed = revenueCatWebhookSchema.parse({
      event: event({ expiration_at_ms: undefined }),
    });

    expect(() => normalizeRevenueCatEvent(parsed.event, domainConfig)).toThrow(
      new RevenueCatNormalizationError('incomplete_event')
    );
  });

  it('rejects missing identity fields and bounded collection overflow', () => {
    expect(
      revenueCatWebhookSchema.safeParse({ event: event({ id: undefined }) })
        .success
    ).toBe(false);
    expect(
      revenueCatWebhookSchema.safeParse({
        event: event({
          aliases: Array.from({ length: 33 }, (_, index) => `alias-${index}`),
        }),
      }).success
    ).toBe(false);
  });

  it('rejects configured-domain mismatches', () => {
    const parsed = revenueCatWebhookSchema.parse({
      event: event({ app_id: 'other-app' }),
    });

    expect(() => normalizeRevenueCatEvent(parsed.event, domainConfig)).toThrow(
      new RevenueCatNormalizationError('invalid_scope')
    );
  });
});
