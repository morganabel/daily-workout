import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { PaywallScreen } from './PaywallScreen';

const mockGoBack = jest.fn();
const mockUseBillingState = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
}));

jest.mock('./hooks/useBillingState', () => ({
  useBillingState: () => mockUseBillingState(),
}));

const createBillingState = (overrides = {}) => ({
  capabilities: {
    enabled: true,
    showUpgradeUi: true,
    purchaseMethod: 'iap',
    allowByok: true,
  },
  client: {
    type: 'revenuecat',
    initialize: jest.fn(),
    getAvailablePackages: jest.fn().mockResolvedValue([]),
    presentPaywall: jest.fn().mockResolvedValue('cancelled'),
    restorePurchases: jest.fn().mockResolvedValue({
      entitlements: { active: {} },
    }),
    getCustomerInfo: jest.fn().mockResolvedValue(null),
    presentCustomerCenter: jest.fn().mockResolvedValue(undefined),
  },
  clientReady: true,
  showUpgradeUi: true,
  entitlements: null,
  loading: false,
  refreshing: false,
  error: null,
  refreshEntitlements: jest.fn().mockResolvedValue(null),
  ...overrides,
});

describe('PaywallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not poll backend when restore finds no active entitlement', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const refreshEntitlements = jest.fn().mockResolvedValue(null);
    const restorePurchases = jest.fn().mockResolvedValue({
      entitlements: { active: {} },
    });

    mockUseBillingState.mockReturnValue(
      createBillingState({
        client: {
          ...createBillingState().client,
          restorePurchases,
        },
        refreshEntitlements,
      })
    );

    const screen = render(<PaywallScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Restore purchases'));
      await Promise.resolve();
    });

    expect(restorePurchases).toHaveBeenCalledTimes(1);
    expect(refreshEntitlements).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'No active purchase found',
      'We could not find an active OpenLift Pro purchase for this store account.'
    );
  });

  it('refreshes backend entitlements after an active restore', async () => {
    const refreshEntitlements = jest.fn().mockResolvedValue({
      planId: 'pro',
      entitlementId: 'OpenLift Pro',
      status: 'active',
      willRenew: true,
      paidThrough: '2026-09-01T00:00:00.000Z',
      graceThrough: null,
      quotaWindow: {
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-02-01T00:00:00.000Z',
        limit: 1000,
        used: 1,
        remaining: 999,
      },
      refreshedAt: '2026-01-01T00:00:00.000Z',
    });
    const restorePurchases = jest.fn().mockResolvedValue({
      entitlements: {
        active: {
          'OpenLift Pro': {},
        },
      },
    });

    mockUseBillingState.mockReturnValue(
      createBillingState({
        client: {
          ...createBillingState().client,
          restorePurchases,
        },
        refreshEntitlements,
      })
    );

    const screen = render(<PaywallScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Restore purchases'));
      await Promise.resolve();
    });

    expect(refreshEntitlements).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
