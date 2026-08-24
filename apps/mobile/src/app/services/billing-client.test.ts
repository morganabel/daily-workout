import {
  createBillingClient,
  customerInfoHasActiveEntitlement,
  reconcileRevenueCatIdentity,
} from './billing-client';
import Purchases from 'react-native-purchases';

describe('billing client adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects NoOpBillingClient when billing is disabled', async () => {
    const client = createBillingClient({
      enabled: false,
      showUpgradeUi: false,
      purchaseMethod: 'none',
      allowByok: true,
    });

    expect(client.type).toBe('noop');
    expect(await client.presentPaywall('OpenLift Pro')).toBe('not_presented');
  });

  it('selects RevenueCatBillingClient for iap billing capabilities', () => {
    const client = createBillingClient({
      enabled: true,
      showUpgradeUi: true,
      purchaseMethod: 'iap',
      allowByok: true,
    });

    expect(client.type).toBe('revenuecat');
  });

  it('detects active RevenueCat entitlements in customer info', () => {
    expect(
      customerInfoHasActiveEntitlement(
        {
          entitlements: {
            active: {
              'OpenLift Pro': {},
            },
          },
        } as never,
        'OpenLift Pro'
      )
    ).toBe(true);

    expect(
      customerInfoHasActiveEntitlement(
        {
          entitlements: { active: {} },
        } as never,
        'OpenLift Pro'
      )
    ).toBe(false);
  });

  it('logs in to the server-owned identity and verifies the exact SDK identity', async () => {
    (Purchases.getAppUserID as jest.Mock)
      .mockResolvedValueOnce('$RCAnonymousID:abcdefghijklmnop')
      .mockResolvedValueOnce('wa_1234567890ab7def8abc1234567890ab');
    (Purchases.logIn as jest.Mock).mockResolvedValueOnce({
      customerInfo: {
        entitlements: { active: { 'OpenLift Pro': {} } },
      },
      created: false,
    });

    await expect(
      reconcileRevenueCatIdentity(
        'public-sdk-key',
        'wa_1234567890ab7def8abc1234567890ab'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        entitlements: { active: { 'OpenLift Pro': {} } },
      })
    );
    expect(Purchases.logIn).toHaveBeenCalledWith(
      'wa_1234567890ab7def8abc1234567890ab'
    );
    expect(Purchases.logOut).not.toHaveBeenCalled();
  });

  it('does not log in again when the SDK already uses the canonical identity', async () => {
    (Purchases.getAppUserID as jest.Mock).mockResolvedValue(
      'wa_1234567890ab7def8abc1234567890ab'
    );
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce({
      entitlements: { active: { 'OpenLift Pro': {} } },
    });

    await expect(
      reconcileRevenueCatIdentity(
        'public-sdk-key',
        'wa_1234567890ab7def8abc1234567890ab'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        entitlements: { active: { 'OpenLift Pro': {} } },
      })
    );
    expect(Purchases.logIn).not.toHaveBeenCalled();
  });

  it('fails closed when login returns but the SDK identity does not match', async () => {
    (Purchases.getAppUserID as jest.Mock)
      .mockResolvedValueOnce('$RCAnonymousID:abcdefghijklmnop')
      .mockResolvedValueOnce('wa_unexpected');
    (Purchases.logIn as jest.Mock).mockResolvedValueOnce({
      customerInfo: { entitlements: { active: {} } },
      created: false,
    });

    await expect(
      reconcileRevenueCatIdentity(
        'public-sdk-key',
        'wa_1234567890ab7def8abc1234567890ab'
      )
    ).rejects.toThrow('revenuecat_identity_verification_failed');
  });

  it('retries an ambiguous login by verifying the same durable identity', async () => {
    (Purchases.getAppUserID as jest.Mock)
      .mockResolvedValueOnce('$RCAnonymousID:abcdefghijklmnop')
      .mockResolvedValueOnce('wa_1234567890ab7def8abc1234567890ab')
      .mockResolvedValueOnce('wa_1234567890ab7def8abc1234567890ab');
    (Purchases.logIn as jest.Mock).mockRejectedValueOnce(
      new Error('network unavailable')
    );
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValueOnce({
      entitlements: { active: { 'OpenLift Pro': {} } },
    });

    await expect(
      reconcileRevenueCatIdentity(
        'public-sdk-key',
        'wa_1234567890ab7def8abc1234567890ab'
      )
    ).rejects.toThrow('network unavailable');
    await expect(
      reconcileRevenueCatIdentity(
        'public-sdk-key',
        'wa_1234567890ab7def8abc1234567890ab'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        entitlements: { active: { 'OpenLift Pro': {} } },
      })
    );
    expect(Purchases.logIn).toHaveBeenCalledTimes(1);
    expect(Purchases.logOut).not.toHaveBeenCalled();
  });
});
