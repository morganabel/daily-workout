import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import type {
  BillingCapabilities,
  BillingPurchaseMethod,
} from '@workout-agent/shared';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

type BillingPackageSummary = {
  id: string;
  title: string;
  price: string;
  rcPackage: PurchasesPackage;
};

export type BillingPaywallResult =
  | 'not_presented'
  | 'cancelled'
  | 'purchased'
  | 'restored'
  | 'error';

export interface BillingClient {
  readonly type: 'noop' | 'revenuecat';
  initialize(args: { apiKey: string; appUserId?: string }): Promise<void>;
  getAvailablePackages(): Promise<BillingPackageSummary[]>;
  presentPaywall(requiredEntitlementId: string): Promise<BillingPaywallResult>;
  restorePurchases(): Promise<CustomerInfo | null>;
  getCustomerInfo(): Promise<CustomerInfo | null>;
  presentCustomerCenter(): Promise<void>;
}

const purchaseMethodUsesRevenueCat = (
  purchaseMethod: BillingPurchaseMethod
): boolean => purchaseMethod === 'iap';

let revenueCatConfigurePromise: Promise<void> | null = null;
let revenueCatConfiguredApiKey: string | null = null;

const ensureRevenueCatConfigured = async (apiKey: string): Promise<void> => {
  if (revenueCatConfiguredApiKey) {
    if (revenueCatConfiguredApiKey !== apiKey) {
      throw new Error(
        'RevenueCat SDK already configured with a different API key.'
      );
    }
    return;
  }

  if (!revenueCatConfigurePromise) {
    revenueCatConfigurePromise = (async () => {
      Purchases.configure({ apiKey });
      await Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
      revenueCatConfiguredApiKey = apiKey;
    })().catch((error) => {
      revenueCatConfigurePromise = null;
      throw error;
    });
  }

  await revenueCatConfigurePromise;
};

const resetRevenueCatLogin = async (): Promise<void> => {
  await Purchases.logOut();
};

const redactPurchaseSecrets = (input: string): string =>
  input
    .replace(/(receipt|token)=([^\s]+)/gi, '$1=[REDACTED]')
    .replace(/(sk-[a-z0-9_-]+)/gi, '[REDACTED]')
    .replace(/(AIza[0-9A-Za-z_-]+)/g, '[REDACTED]');

const formatBillingError = (error: unknown): Error => {
  if (error instanceof Error) {
    return new Error(redactPurchaseSecrets(error.message));
  }

  return new Error('Unexpected billing error');
};

const isPurchaseCancellation = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const maybeError = error as {
    userCancelled?: boolean;
    code?: string;
  };

  return (
    maybeError.userCancelled === true ||
    maybeError.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
};

export const customerInfoHasActiveEntitlement = (
  customerInfo: CustomerInfo | null,
  entitlementId: string
): boolean => Boolean(customerInfo?.entitlements.active[entitlementId]);

class NoOpBillingClient implements BillingClient {
  readonly type = 'noop' as const;

  async initialize(): Promise<void> {
    return;
  }

  async getAvailablePackages(): Promise<BillingPackageSummary[]> {
    return [];
  }

  async presentPaywall(): Promise<BillingPaywallResult> {
    return 'not_presented';
  }

  async restorePurchases(): Promise<CustomerInfo | null> {
    return null;
  }

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    return null;
  }

  async presentCustomerCenter(): Promise<void> {
    return;
  }
}

class RevenueCatBillingClient implements BillingClient {
  readonly type = 'revenuecat' as const;

  async initialize(args: {
    apiKey: string;
    appUserId?: string;
  }): Promise<void> {
    if (!args.appUserId?.trim()) {
      throw new Error('revenuecat_identity_missing');
    }
    await reconcileRevenueCatIdentity(args.apiKey, args.appUserId);
  }

  async getAvailablePackages(): Promise<BillingPackageSummary[]> {
    try {
      const offerings = await Purchases.getOfferings();
      const availablePackages = offerings.current?.availablePackages ?? [];
      return availablePackages.map((item) => ({
        id: item.identifier,
        title: item.product.title,
        price: item.product.priceString,
        rcPackage: item,
      }));
    } catch (error) {
      throw formatBillingError(error);
    }
  }

  async presentPaywall(
    requiredEntitlementId: string
  ): Promise<BillingPaywallResult> {
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: requiredEntitlementId,
      });

      switch (result) {
        case PAYWALL_RESULT.PURCHASED:
          return 'purchased';
        case PAYWALL_RESULT.RESTORED:
          return 'restored';
        case PAYWALL_RESULT.CANCELLED:
          return 'cancelled';
        case PAYWALL_RESULT.NOT_PRESENTED:
          return 'not_presented';
        default:
          return 'error';
      }
    } catch (error) {
      if (isPurchaseCancellation(error)) {
        return 'cancelled';
      }
      throw formatBillingError(error);
    }
  }

  async restorePurchases(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.restorePurchases();
    } catch (error) {
      throw formatBillingError(error);
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      throw formatBillingError(error);
    }
  }

  async presentCustomerCenter(): Promise<void> {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (error) {
      throw formatBillingError(error);
    }
  }
}

export const createBillingClient = (
  billingCapabilities: BillingCapabilities
): BillingClient => {
  if (
    !billingCapabilities.enabled ||
    !purchaseMethodUsesRevenueCat(billingCapabilities.purchaseMethod)
  ) {
    return new NoOpBillingClient();
  }

  return new RevenueCatBillingClient();
};

export async function reconcileRevenueCatIdentity(
  apiKey: string,
  expectedAppUserId: string
): Promise<CustomerInfo> {
  const expected = expectedAppUserId.trim();
  if (!expected) {
    throw new Error('revenuecat_identity_missing');
  }
  await ensureRevenueCatConfigured(apiKey);
  let customerInfo: CustomerInfo | null = null;
  const current = await Purchases.getAppUserID();
  if (current !== expected) {
    const result = await Purchases.logIn(expected);
    customerInfo = result.customerInfo;
  }

  const verified = await Purchases.getAppUserID();
  if (verified !== expected) {
    throw new Error('revenuecat_identity_verification_failed');
  }

  return customerInfo ?? Purchases.getCustomerInfo();
}

export { resetRevenueCatLogin };
export type { BillingPackageSummary };
