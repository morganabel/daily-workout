jest.mock('@workout-agent-ce/server-db', () => ({
  getAiUsageSummary: jest.fn(),
}));
jest.mock('@/lib/auth-context', () => ({
  getAuthContext: jest.fn(),
}));
jest.mock('@/lib/deployment', () => ({
  isBillingEnabled: jest.fn(),
}));
jest.mock('@/lib/wiring', () => ({
  usagePolicy: { getEntitlements: jest.fn() },
}));

import { getAiUsageSummary } from '@workout-agent-ce/server-db';
import { getAuthContext } from '@/lib/auth-context';
import { isBillingEnabled } from '@/lib/deployment';
import { usagePolicy } from '@/lib/wiring';

import { GET } from './route';

const mockedGetAiUsageSummary = getAiUsageSummary as jest.Mock;
const mockedGetAuthContext = getAuthContext as jest.Mock;
const mockedIsBillingEnabled = isBillingEnabled as jest.Mock;
const mockedGetEntitlements = usagePolicy.getEntitlements as jest.Mock;

describe('GET /api/billing/usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.HOSTED_FREE_AI_COST_BUDGET_USD;
    mockedIsBillingEnabled.mockReturnValue(true);
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
    mockedIsBillingEnabled.mockReturnValue(false);

    const response = await GET(new Request('http://localhost/api/billing/usage'));

    expect(response.status).toBe(404);
  });

  it('returns the authenticated user usage window', async () => {
    process.env.HOSTED_FREE_AI_COST_BUDGET_USD = '2.50';

    const response = await GET(new Request('http://localhost/api/billing/usage'));

    expect(response.status).toBe(200);
    expect(mockedGetAiUsageSummary).toHaveBeenCalledWith(
      { name: 'db' },
      expect.objectContaining({
        userId: 'u1',
        shadowBudgetNanoUsd: '2500000000',
      })
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        totals: expect.objectContaining({ requestCount: 1 }),
      })
    );
  });
});
