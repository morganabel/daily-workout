import { renderHook, waitFor } from '@testing-library/react-native';
import type { BillingEntitlementsResponse } from '@leveza/shared';
import { useBillingState } from './useBillingState';
import {
  fetchBillingEntitlements,
  fetchBillingIdentity,
} from '../services/api';
import { authClient, fetchServerCapabilities } from '../services/auth-client';

jest.mock('../services/api', () => ({
  fetchBillingEntitlements: jest.fn(),
  fetchBillingIdentity: jest.fn(),
}));

jest.mock('../services/auth-client', () => ({
  authClient: { getSession: jest.fn() },
  fetchServerCapabilities: jest.fn(),
}));

const mockFetchBillingEntitlements = fetchBillingEntitlements as jest.Mock;
const mockFetchBillingIdentity = fetchBillingIdentity as jest.Mock;
const mockFetchServerCapabilities = fetchServerCapabilities as jest.Mock;
const mockGetSession = authClient.getSession as jest.Mock;

const entitlements: BillingEntitlementsResponse = {
  planId: 'pro',
  entitlementId: 'Leveza Pro',
  status: 'active',
  willRenew: true,
  paidThrough: '2026-09-27T00:00:00.000Z',
  graceThrough: null,
  quotaWindow: {
    startsAt: '2026-08-27T00:00:00.000Z',
    endsAt: '2026-09-27T00:00:00.000Z',
    limit: 1000,
    used: 10,
    remaining: 990,
  },
  refreshedAt: '2026-08-27T12:00:00.000Z',
};

describe('useBillingState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockFetchBillingEntitlements.mockResolvedValue(entitlements);
  });

  it('loads server entitlements without initializing RevenueCat when purchases are hidden', async () => {
    mockFetchServerCapabilities.mockResolvedValue({
      billing: {
        enabled: true,
        showUpgradeUi: false,
        purchaseMethod: 'none',
        allowByok: true,
        upgradeEntitlementId: null,
      },
    });

    const { result } = renderHook(() => useBillingState());

    await waitFor(() => {
      expect(result.current.entitlements).toStrictEqual(entitlements);
    });

    expect(result.current.client.type).toBe('noop');
    expect(result.current.clientReady).toBe(true);
    expect(result.current.showUpgradeUi).toBe(false);
    expect(mockFetchBillingIdentity).not.toHaveBeenCalled();
    expect(mockFetchBillingEntitlements).toHaveBeenCalledTimes(1);
  });
});
