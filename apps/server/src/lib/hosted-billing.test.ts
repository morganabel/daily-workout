import { HostedBillingRuntime } from './hosted-billing';

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

  it('enforces hosted quota limits for managed usage', () => {
    const runtime = new HostedBillingRuntime();
    const userId = 'user-free';

    expect(runtime.canGenerate(userId).allowed).toBe(true);
    const denied = runtime.canGenerate(userId);
    expect(denied.allowed).toBe(false);
    expect(denied.upgrade?.entitlementId).toBe('OpenLift Pro');
  });

  it('can roll back a reserved managed usage unit', () => {
    const runtime = new HostedBillingRuntime();
    const userId = 'user-free';

    expect(runtime.canGenerate(userId).allowed).toBe(true);
    runtime.rollbackManagedUsage(userId);

    expect(runtime.canGenerate(userId).allowed).toBe(true);
  });

  it('applies RevenueCat purchase events and grants pro entitlements', () => {
    const runtime = new HostedBillingRuntime();

    const result = runtime.applyRevenueCatWebhook({
      type: 'INITIAL_PURCHASE',
      app_user_id: 'user-pro',
      product_id: 'monthly',
      entitlement_ids: ['OpenLift Pro'],
    });

    expect(result.applied).toBe(true);
    const entitlements = runtime.getEntitlements('user-pro');
    expect(entitlements.planId).toBe('pro');
    expect(entitlements.status).toBe('active');
  });
});
