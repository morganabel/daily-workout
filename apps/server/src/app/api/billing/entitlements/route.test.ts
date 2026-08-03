jest.mock('@/lib/auth-context', () => ({
  getAuthContext: jest.fn(),
}));

jest.mock('@/lib/billing-services', () => ({
  getRevenueCatBillingServices: jest.fn(),
}));

import { GET } from './route';

const { getAuthContext } = jest.requireMock('@/lib/auth-context') as {
  getAuthContext: jest.Mock;
};

const { getRevenueCatBillingServices } = jest.requireMock(
  '@/lib/billing-services'
) as {
  getRevenueCatBillingServices: jest.Mock;
};
const bootstrapAuthenticatedCustomer = jest.fn();
const getEntitlements = jest.fn();

describe('GET /api/billing/entitlements', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.BILLING_PROVIDER = 'revenuecat';
    getRevenueCatBillingServices.mockResolvedValue({
      repository: { bootstrapAuthenticatedCustomer },
      getEntitlements,
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects unauthenticated requests', async () => {
    getAuthContext.mockReturnValue({
      provider: {
        authenticate: jest.fn().mockResolvedValue(null),
      },
    });

    const response = await GET(
      new Request('http://localhost/api/billing/entitlements')
    );

    expect(response.status).toBe(401);
  });

  it('returns account-bound entitlements for authenticated users', async () => {
    getAuthContext.mockReturnValue({
      provider: {
        authenticate: jest.fn().mockResolvedValue({
          userId: 'user-123',
          principalId: 'session-123',
        }),
      },
    });

    getEntitlements.mockResolvedValue({
      planId: 'pro',
      entitlementId: 'OpenLift Pro',
      status: 'active',
      willRenew: true,
      paidThrough: '2026-09-01T00:00:00.000Z',
      graceThrough: null,
      quotaWindow: {
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-02-01T00:00:00.000Z',
        limit: 100,
        used: 10,
        remaining: 90,
      },
      refreshedAt: '2026-01-10T00:00:00.000Z',
    });

    const response = await GET(
      new Request('http://localhost/api/billing/entitlements')
    );
    const data = (await response.json()) as {
      planId: string;
      status: string;
      quotaWindow: { remaining: number };
    };

    expect(response.status).toBe(200);
    expect(data.planId).toBe('pro');
    expect(data.status).toBe('active');
    expect(data.quotaWindow.remaining).toBe(90);
    expect(bootstrapAuthenticatedCustomer).toHaveBeenCalledWith({
      accountId: 'user-123',
      externalCustomerId: 'user-123',
    });
  });

  it('returns 503 when durable billing is unavailable', async () => {
    getAuthContext.mockReturnValue({
      provider: {
        authenticate: jest.fn().mockResolvedValue({
          userId: 'user-123',
          principalId: 'session-123',
        }),
      },
    });
    getRevenueCatBillingServices.mockRejectedValue(
      new Error('billing_dependency_unavailable')
    );

    const response = await GET(
      new Request('http://localhost/api/billing/entitlements')
    );
    expect(response.status).toBe(503);
  });
});
