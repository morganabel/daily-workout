jest.mock('@/lib/auth-context', () => ({
  getAuthContext: jest.fn(),
}));

jest.mock('@/lib/wiring', () => ({
  usagePolicy: {
    getEntitlements: jest.fn(),
  },
}));

import { GET } from './route';

const { getAuthContext } = jest.requireMock('@/lib/auth-context') as {
  getAuthContext: jest.Mock;
};

const { usagePolicy } = jest.requireMock('@/lib/wiring') as {
  usagePolicy: {
    getEntitlements: jest.Mock;
  };
};

describe('GET /api/billing/entitlements', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.EDITION = 'HOSTED';
    process.env.HOSTED_BILLING_ENABLED = 'true';
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

    usagePolicy.getEntitlements.mockResolvedValue({
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
  });
});
