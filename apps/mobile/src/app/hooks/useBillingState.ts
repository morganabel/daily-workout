import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BillingCapabilities,
  BillingEntitlementsResponse,
} from '@workout-agent/shared';
import {
  createBillingCapabilities,
  resolveBillingCapabilities,
} from '@workout-agent/shared';
import { fetchServerCapabilities, authClient } from '../services/auth-client';
import { fetchBillingEntitlements } from '../services/api';
import {
  createBillingClient,
  type BillingClient,
} from '../services/billing-client';
import type { ApiError } from '../services/api';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
const BILLING_INIT_DEBOUNCE_MS = 150;
const SESSION_ID_INITIAL_RETRY_MS = [0, 250, 750] as const;
const SESSION_ID_FOLLOW_UP_RETRY_MS = [1000, 2000] as const;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const resolveSessionUserIdWithRetry = async (
  retryDelaysMs: readonly number[]
): Promise<string | undefined> => {
  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    try {
      const session = await authClient.getSession();
      const appUserId = session.data?.user.id?.trim();
      if (appUserId) {
        return appUserId;
      }
    } catch {
      // Session hydration can briefly fail during app start; retry below.
    }
  }

  return undefined;
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
    if (!capabilities.enabled) {
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
  }, [capabilities.enabled]);

  const retryEntitlementsAfterSessionHydration = useCallback(async () => {
    const appUserId = await resolveSessionUserIdWithRetry(
      SESSION_ID_FOLLOW_UP_RETRY_MS
    );

    if (!appUserId) {
      return null;
    }

    return refreshEntitlements();
  }, [refreshEntitlements]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const meta = await fetchServerCapabilities();
        if (!active) {
          return;
        }

        const nextCapabilities = resolveBillingCapabilities(meta?.billing);
        setCapabilities(nextCapabilities);

        if (nextCapabilities.enabled) {
          // Wait for the auth session to hydrate before making the
          // authenticated entitlements request.  Without this gate the
          // fetch can race ahead of cookie/token availability → 401.
          await resolveSessionUserIdWithRetry(SESSION_ID_INITIAL_RETRY_MS);
          if (!active) {
            return;
          }

          try {
            const latest = await fetchBillingEntitlements();
            if (!active) {
              return;
            }
            setEntitlements(latest);
          } catch (entitlementsError) {
            if (getApiError(entitlementsError)?.code === 'UNAUTHORIZED') {
              setEntitlements(null);
              setError(null);
              void retryEntitlementsAfterSessionHydration();
              return;
            }

            throw entitlementsError;
          }
        } else {
          setEntitlements(null);
        }
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(getBillingLoadErrorMessage(loadError));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [retryEntitlementsAfterSessionHydration]);

  useEffect(() => {
    let active = true;
    let initTimer: ReturnType<typeof setTimeout> | null = null;

    const initializeBilling = async () => {
      if (client.type !== 'revenuecat') {
        if (active) {
          setClientReady(true);
        }
        return;
      }

      if (!REVENUECAT_API_KEY) {
        if (active) {
          setError(
            'RevenueCat is enabled but EXPO_PUBLIC_REVENUECAT_API_KEY is missing.'
          );
          setClientReady(false);
        }
        return;
      }

      try {
        const appUserId = await resolveSessionUserIdWithRetry(
          SESSION_ID_INITIAL_RETRY_MS
        );

        await client.initialize({
          apiKey: REVENUECAT_API_KEY,
          appUserId,
        });

        if (active) {
          setClientReady(true);
        }

        if (!appUserId) {
          void (async () => {
            try {
              const lateResolvedUserId = await resolveSessionUserIdWithRetry(
                SESSION_ID_FOLLOW_UP_RETRY_MS
              );
              if (!lateResolvedUserId || !active) {
                return;
              }

              await client.initialize({
                apiKey: REVENUECAT_API_KEY,
                appUserId: lateResolvedUserId,
              });
            } catch {
              // Non-fatal: billing can continue with anonymous RevenueCat identity.
            }
          })();
        }
      } catch (initError) {
        if (!active) {
          return;
        }
        setError(
          initError instanceof Error
            ? initError.message
            : 'Failed to initialize billing client'
        );
      }
    };

    initTimer = setTimeout(() => {
      void initializeBilling();
    }, BILLING_INIT_DEBOUNCE_MS);

    return () => {
      active = false;
      if (initTimer) {
        clearTimeout(initTimer);
      }
    };
  }, [client]);

  return {
    capabilities,
    entitlements,
    loading,
    refreshing,
    error,
    client,
    clientReady,
    showUpgradeUi: capabilities.enabled && capabilities.showUpgradeUi,
    refreshEntitlements,
  };
}
