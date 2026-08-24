jest.mock('@workout-agent-ce/server-db', () => ({
  getAiUsageSummary: jest.fn(),
}));
jest.mock('@/lib/auth-context', () => ({
  getAuthContext: jest.fn(),
}));
jest.mock('@/lib/deployment', () => ({
  getBillingProvider: jest.fn(),
}));
jest.mock('@/lib/billing-services', () => ({
  getRevenueCatBillingServices: jest.fn(),
}));

import { getAiUsageSummary } from '@workout-agent-ce/server-db';
import { getAuthContext } from '@/lib/auth-context';
import { getBillingProvider } from '@/lib/deployment';
import { getRevenueCatBillingServices } from '@/lib/billing-services';

import { GET } from './route';

const mockedGetAiUsageSummary = getAiUsageSummary as jest.Mock;
const mockedGetAuthContext = getAuthContext as jest.Mock;
const mockedGetBillingProvider = getBillingProvider as jest.Mock;
const mockedGetBillingServices = getRevenueCatBillingServices as jest.Mock;
const mockedGetEntitlements = jest.fn();

describe('GET /api/billing/usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetBillingProvider.mockReturnValue('revenuecat');
    mockedGetAuthContext.mockResolvedValue({
      db: { name: 'db' },
      provider: { authenticate: jest.fn().mockResolvedValue({ userId: 'u1' }) },
    });
    mockedGetEntitlements.mockResolvedValue({
      planId: 'free',
      quotaWindow: {
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-09-01T00:00:00.000Z',
      },
    });
    mockedGetBillingServices.mockResolvedValue({
      getEntitlements: mockedGetEntitlements,
    });
    mockedGetAiUsageSummary.mockResolvedValue({
      window: {
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-09-01T00:00:00.000Z',
      },
      totals: {
        requestCount: 1,
        successfulRequestCount: 1,
        failedRequestCount: 0,
        callCount: 2,
        unknownCostCallCount: 0,
        inputTokens: 100,
        outputTokens: 20,
        cachedInputTokens: 10,
        totalTokens: 120,
        accountedCostNanoUsd: '500000',
        platformCostNanoUsd: '500000',
        byokEstimatedCostNanoUsd: '0',
        allowanceChargeNanoUsd: '500000',
      },
      byProvider: {},
      shadowBudget: null,
      recentRequests: [],
    });
  });

  it('returns 404 when hosted billing is disabled', async () => {
    mockedGetBillingProvider.mockReturnValue('none');

    const response = await GET(new Request('http://localhost/api/billing/usage'));

    expect(response.status).toBe(404);
  });

  it('returns the authenticated user usage window', async () => {
    const response = await GET(
      new Request('http://localhost/api/billing/usage', {
        headers: {
          'x-revenuecat-app-user-id': '$RCAnonymousID:attacker-chosen',
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mockedGetAiUsageSummary).toHaveBeenCalledWith(
      { name: 'db' },
      expect.objectContaining({
        userId: 'u1',
      })
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        totals: expect.objectContaining({ requestCount: 1 }),
      })
    );
    expect(mockedGetEntitlements).toHaveBeenCalledWith('u1');
  });
});
