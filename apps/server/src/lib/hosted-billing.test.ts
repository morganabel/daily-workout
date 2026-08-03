import { HostedBillingRuntime } from './hosted-billing';
import { normalizeRevenueCatEvent } from './revenuecat';

describe('HostedBillingRuntime', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.HOSTED_FREE_GENERATION_LIMIT = '1';
    process.env.HOSTED_PRO_GENERATION_LIMIT = '5';
    process.env.HOSTED_QUOTA_WINDOW_DAYS = '30';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('enforces hosted quota limits with exact reservation tokens', async () => {
    const runtime = new HostedBillingRuntime();
    const reserved = await runtime.reserveGenerate({
      accountId: 'user-free',
      operationId: 'operation-1',
      operation: 'generate',
    });
    expect(reserved.allowed).toBe(true);

    const denied = await runtime.reserveGenerate({
      accountId: 'user-free',
      operationId: 'operation-2',
      operation: 'generate',
    });
    expect(denied).toMatchObject({
      allowed: false,
      code: 'quota_exceeded',
    });
  });

  it('rolls back only the exact managed-usage reservation', async () => {
    const runtime = new HostedBillingRuntime();
    const reserved = await runtime.reserveGenerate({
      accountId: 'user-free',
      operationId: 'operation-1',
      operation: 'generate',
    });
    if (!reserved.allowed || !reserved.reservation) {
      throw new Error('expected reservation');
    }
    await runtime.rollbackGenerateReservation(reserved.reservation);

    await expect(
      runtime.reserveGenerate({
        accountId: 'user-free',
        operationId: 'operation-2',
        operation: 'generate',
      })
    ).resolves.toMatchObject({ allowed: true });
  });

  it('grants paid access only after authenticated customer bootstrap', async () => {
    const runtime = new HostedBillingRuntime();
    await runtime.bootstrapAuthenticatedCustomer('user-pro', 'rc-user-pro');
    const event = normalizeRevenueCatEvent(
      {
        id: 'event-1',
        type: 'INITIAL_PURCHASE',
        event_timestamp_ms: Date.parse('2026-08-02T12:00:00.000Z'),
        app_id: 'app.test',
        environment: 'SANDBOX',
        app_user_id: 'rc-user-pro',
        product_id: 'monthly',
        entitlement_ids: ['OpenLift Pro'],
        expiration_at_ms: Date.parse('2026-09-02T12:00:00.000Z'),
      },
      runtime.domainConfig
    );

    await expect(runtime.applyRevenueCatWebhook(event)).resolves.toMatchObject({
      outcome: 'applied',
      accountId: 'user-pro',
    });
    await expect(runtime.getEntitlements('user-pro')).resolves.toMatchObject({
      planId: 'pro',
      status: 'active',
      willRenew: true,
      paidThrough: '2026-09-02T12:00:00.000Z',
    });

    const first = await runtime.reserveGenerate({
      accountId: 'user-pro',
      operationId: 'operation-1',
      operation: 'generate',
    });
    if (!first.allowed || !first.reservation) {
      throw new Error('expected paid reservation');
    }
    await runtime.commitGenerateReservation(first.reservation);
    await expect(
      runtime.reserveGenerate({
        accountId: 'user-pro',
        operationId: 'operation-2',
        operation: 'generate',
      })
    ).resolves.toMatchObject({ allowed: true });
  });
});
