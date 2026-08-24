jest.mock('@/lib/auth-context', () => ({
  getAuthContext: jest.fn(),
}));

import { GET } from './route';

const { getAuthContext } = jest.requireMock('@/lib/auth-context') as {
  getAuthContext: jest.Mock;
};

const mockGetAuthContext = getAuthContext;

describe('GET /api/meta', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.BILLING_PROVIDER;
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    delete process.env.BILLING_CONFIG_JSON;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns billing-disabled defaults in CE mode', async () => {
    mockGetAuthContext.mockReturnValue({
      mode: 'stub',
      provider: { authenticate: jest.fn() },
      auth: null,
      db: null,
      googleAvailable: false,
    });

    const request = new Request('http://localhost:3000/api/meta');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.edition).toBe('CE');
    expect(data.billing.enabled).toBe(false);
    expect(data.billing.showUpgradeUi).toBe(false);
    expect(data.billing.purchaseMethod).toBe('none');
  });

  it('returns hosted billing capabilities when enabled in env', async () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.BILLING_PROVIDER = 'revenuecat';
    process.env.REVENUECAT_WEBHOOK_SECRET = 'secret';
    process.env.BILLING_CONFIG_JSON = JSON.stringify({
      schemaVersion: 1,
      revenueCat: {
        appIds: ['app.test'],
        environments: ['SANDBOX'],
        entitlementIds: ['OpenLift Pro'],
        productIds: ['monthly'],
      },
      plans: {
        freeGenerations: 25,
        proGenerations: 1000,
        windowDays: 30,
      },
      guardrails: {
        accountRequestsPerMinute: 30,
        accountMaxActiveGenerations: 2,
        accountDailySpendLimitNanoUsd: '5000000000',
        globalDailySpendLimitNanoUsd: '50000000000',
        pendingReservationTtlSeconds: 300,
      },
      capabilities: { showUpgradeUi: true },
    });

    mockGetAuthContext.mockReturnValue({
      mode: 'better-auth',
      provider: { authenticate: jest.fn() },
      auth: null,
      db: null,
      googleAvailable: true,
    });

    const request = new Request('http://localhost:3000/api/meta');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.edition).toBe('HOSTED');
    expect(data.billing.enabled).toBe(true);
    expect(data.billing.showUpgradeUi).toBe(true);
    expect(data.billing.purchaseMethod).toBe('iap');
    expect(data.billing.allowByok).toBe(true);
    expect(data.auth.googleAvailable).toBe(true);
    expect(data.auth.accountTransitionAvailable).toBe(true);
  });
});
