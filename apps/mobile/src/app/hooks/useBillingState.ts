import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BillingCapabilities,
  BillingEntitlementsResponse,
} from '@leveza/shared';
import {
  createBillingCapabilities,
  resolveBillingCapabilities,
} from '@leveza/shared';
import { fetchServerCapabilities, authClient } from '../services/auth-client';
import {
  fetchBillingEntitlements,
  fetchBillingIdentity,
} from '../services/api';
import {
  createBillingClient,
  type BillingClient,
} from '../services/billing-client';
import type { ApiError } from '../services/api';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
const BILLING_INIT_DEBOUNCE_MS = 150;
const SESSION_ID_RETRY_MS = [0, 250, 750, 1000, 2000] as const;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForAuthenticatedSession = async (): Promise<boolean> => {
  for (const delayMs of SESSION_ID_RETRY_MS) {
    if (delayMs > 0) await sleep(delayMs);
    try {
      const session = await authClient.getSession();
      if (session.data?.user.id?.trim()) return true;
    } catch {
      // Session hydration can briefly fail during app start; retry below.
    }
  }
  return false;
};

const getApiError = (error: unknown): ApiError | null => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  const apiError = error as ApiError;
  return typeof apiError.code === 'string' ? apiError : null;
};

const getBillingLoadErrorMessage = (error: unknown): string => {
  const apiError = getApiError(error);
  if (apiError) {
    switch (apiError.code) {
      case 'NOT_FOUND':
        return 'Upgrade options are not available on this server.';
      case 'UNAUTHORIZED':
        return 'Please sign in again to check your plan.';
      case 'BYOK_REQUIRED':
        return 'Add your own AI key to keep generating workouts.';
      case 'QUOTA_EXCEEDED':
        return 'You have used all of your included generated workouts for this period.';
      default:
        return apiError.message || 'We could not load your plan right now.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    if (error.message === 'revenuecat_identity_verification_failed') {
      return 'Preparing your purchase account failed. Please try again.';
    }
    return error.message;
  }
  return 'We could not load your plan right now.';
};

type UseBillingStateResult = {
  capabilities: BillingCapabilities;
  entitlements: BillingEntitlementsResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  client: BillingClient;
  clientReady: boolean;
  showUpgradeUi: boolean;
  refreshEntitlements: () => Promise<BillingEntitlementsResponse | null>;
};

export function useBillingState(): UseBillingStateResult {
  const [capabilities, setCapabilities] = useState<BillingCapabilities>(
    createBillingCapabilities()
  );
  const [entitlements, setEntitlements] =
    useState<BillingEntitlementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);

  const client = useMemo(
    () => createBillingClient(capabilities),
    [capabilities]
  );

  const refreshEntitlements = useCallback(async () => {
    if (!capabilities.enabled || !clientReady) {
      setEntitlements(null);
      return null;
    }

    setRefreshing(true);
    try {
      const latest = await fetchBillingEntitlements();
      setEntitlements(latest);
      return latest;
    } catch {
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [capabilities.enabled, clientReady]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const meta = await fetchServerCapabilities();
        if (!active) return;
        setCapabilities(resolveBillingCapabilities(meta?.billing));
      } catch (loadError) {
        if (active) setError(getBillingLoadErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let initTimer: ReturnType<typeof setTimeout> | null = null;
    setClientReady(false);

    const initializeBilling = async () => {
      if (!capabilities.enabled) {
        if (active) {
          setEntitlements(null);
          setClientReady(true);
        }
        return;
      }

      if (client.type === 'revenuecat' && !REVENUECAT_API_KEY) {
        if (active) {
          setError(
            'RevenueCat is enabled but EXPO_PUBLIC_REVENUECAT_API_KEY is missing.'
          );
        }
        return;
      }

      try {
        if (!(await waitForAuthenticatedSession())) {
          throw new Error(
            'Preparing your account. Please try again in a moment.'
          );
        }

        if (client.type === 'revenuecat') {
          const identity = await fetchBillingIdentity();
          await client.initialize({
            apiKey: REVENUECAT_API_KEY,
            appUserId: identity.appUserId,
          });
        }
        const latest = await fetchBillingEntitlements();

        if (active) {
          setEntitlements(latest);
          setError(null);
          setClientReady(true);
        }
      } catch (initError) {
        if (active) {
          setEntitlements(null);
          setClientReady(false);
          setError(getBillingLoadErrorMessage(initError));
        }
      }
    };

    initTimer = setTimeout(() => {
      void initializeBilling();
    }, BILLING_INIT_DEBOUNCE_MS);

    return () => {
      active = false;
      if (initTimer) clearTimeout(initTimer);
    };
  }, [capabilities.enabled, client]);

  return {
    capabilities,
    entitlements,
    loading,
    refreshing,
    error,
    client,
    clientReady,
    showUpgradeUi:
      capabilities.enabled &&
      capabilities.showUpgradeUi &&
      capabilities.upgradeEntitlementId !== null,
    refreshEntitlements,
  };
}
