/**
 * Hook to fetch and manage home snapshot data
 * Replaces useMockedHomeData with real API calls
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { fetchHomeSnapshot, type ApiError } from '../services/api';
import type {
  GenerationStatus,
  HomeSnapshot,
  TodayPlan,
  WorkoutSessionSummary,
  QuickActionKey,
  QuickActionPreset,
} from '@workout-agent/shared';
import NetInfo from '@react-native-community/netinfo';
import { getDeviceToken } from '../storage/deviceToken';

const DEFAULT_QUICK_ACTIONS: QuickActionPreset[] = [
  {
    key: 'time',
    label: 'Time',
    value: '30',
    description: '30 min',
    stagedValue: null,
  },
  {
    key: 'focus',
    label: 'Focus',
    value: 'Upper body',
    description: 'Upper body',
    stagedValue: null,
  },
  {
    key: 'equipment',
    label: 'Equipment',
    value: 'Dumbbells',
    description: 'Dumbbells',
    stagedValue: null,
  },
  {
    key: 'energy',
    label: 'Energy',
    value: 'Moderate',
    description: 'Moderate energy',
    stagedValue: null,
  },
  {
    key: 'backfill',
    label: 'Backfill',
    value: 'Today',
    description: 'Log past session',
    stagedValue: null,
  },
];

export type HomeDataState = {
  status: 'loading' | 'ready' | 'error';
  plan: HomeSnapshot['plan'];
  recentSessions: HomeSnapshot['recentSessions'];
  quickActions: HomeSnapshot['quickActions'];
  offlineHint: HomeSnapshot['offlineHint'];
  isOffline: boolean;
  error: ApiError | null;
  generationStatus: GenerationStatus;
};

/**
 * Hook that fetches home snapshot, caches results, and refetches after mutations
 */
export function useHomeData(): HomeDataState & {
  refetch: () => Promise<void>;
  setPlan: (plan: TodayPlan | null) => void;
  addSession: (session: WorkoutSessionSummary) => void;
  updateStagedValue: (actionKey: QuickActionKey, stagedValue: string | null) => void;
  clearStagedValues: () => void;
} {
  const initialStatus: GenerationStatus = {
    state: 'idle',
    submittedAt: null,
  };

  const [state, setState] = useState<HomeDataState>({
    status: 'loading',
    plan: null,
    recentSessions: [],
    quickActions: DEFAULT_QUICK_ACTIONS,
    offlineHint: {
      offline: false,
      requiresApiKey: false,
    },
    isOffline: false,
    error: null,
    generationStatus: initialStatus,
  });

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [hasDeviceToken, setHasDeviceToken] = useState<boolean | null>(null);
  const [stagedValues, setStagedValues] = useState<
    Partial<Record<QuickActionKey, string | null>>
  >({});

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Monitor DeviceToken state
  useEffect(() => {
    const checkDeviceToken = async () => {
      try {
        const token = await getDeviceToken();
        setHasDeviceToken(!!token);
      } catch (error) {
        console.warn('Failed to check device token:', error);
        setHasDeviceToken(false);
      }
    };

    checkDeviceToken();

    // Check periodically (every 2 seconds) for token changes
    const interval = setInterval(checkDeviceToken, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const fetchData = useCallback(async () => {
    // Check connectivity and DeviceToken
    let connected = false;
    let hasToken = false;
    
    try {
      const state = await NetInfo.fetch();
      connected = state.isConnected ?? false;
    } catch (error) {
      console.warn('Failed to check network:', error);
    }

    try {
      const token = await getDeviceToken();
      hasToken = !!token;
      setHasDeviceToken(hasToken);
    } catch (error) {
      console.warn('Failed to check device token:', error);
      hasToken = false;
      setHasDeviceToken(false);
    }

    // If no DeviceToken, show BYOK warning even if online
    if (!hasToken) {
      setState((prev) => ({
        ...prev,
        status: 'ready',
        isOffline: true,
        offlineHint: {
          offline: true,
          requiresApiKey: true,
          message: 'Device token required. Please configure your API key.',
        },
        generationStatus: initialStatus,
      }));
      return;
    }

    // If offline, show offline warning
    if (!connected) {
      setState((prev) => ({
        ...prev,
        status: 'ready',
        isOffline: true,
        offlineHint: {
          offline: true,
          requiresApiKey: false,
          message: 'No internet connection',
        },
        generationStatus: initialStatus,
      }));
      return;
    }

    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const snapshot = await fetchHomeSnapshot();
      setState((prev) => ({
        ...prev,
        status: 'ready',
        plan: snapshot.plan,
        recentSessions: snapshot.recentSessions,
        offlineHint: snapshot.offlineHint,
        isOffline: snapshot.offlineHint.offline || false,
        error: null,
        generationStatus: snapshot.generationStatus,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: apiError,
        isOffline: apiError.code === 'NETWORK_ERROR' || !connected,
        offlineHint: {
          offline: true,
          requiresApiKey: apiError.code === 'BYOK_REQUIRED' || !hasToken,
          message: apiError.message || (!hasToken ? 'Device token required' : 'Network error'),
        },
        generationStatus: initialStatus,
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearStagedValues = useCallback(() => {
    setStagedValues({});
  }, []);

  const setPlan = useCallback(
    (plan: TodayPlan | null) => {
      setState((prev) => ({
        ...prev,
        plan,
      }));
      if (plan) {
        clearStagedValues();
      }
    },
    [clearStagedValues],
  );

  const addSession = useCallback((session: WorkoutSessionSummary) => {
    setState((prev) => ({
      ...prev,
      plan: null, // Clear the plan after logging
      recentSessions: [session, ...prev.recentSessions].slice(0, 3), // Keep only last 3
    }));
  }, []);

  const updateStagedValue = useCallback(
    (actionKey: QuickActionKey, stagedValue: string | null) => {
      setStagedValues((prev) => {
        const next = { ...prev };
        if (stagedValue === null || stagedValue === '') {
          delete next[actionKey];
        } else {
          next[actionKey] = stagedValue;
        }
        return next;
      });
    },
    [],
  );

  const quickActionsWithStaged = useMemo(
    () =>
      state.quickActions.map((action) => ({
        ...action,
        stagedValue: stagedValues[action.key] ?? null,
      })),
    [state.quickActions, stagedValues],
  );

  return {
    ...state,
    quickActions: quickActionsWithStaged,
    refetch: fetchData,
    setPlan,
    addSession,
    updateStagedValue,
    clearStagedValues,
  };
}
