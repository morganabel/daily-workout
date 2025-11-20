/**
 * Hook to fetch and manage home snapshot data
 * Replaces useMockedHomeData with real API calls
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type {
  GenerationStatus,
  HomeSnapshot,
  TodayPlan,
  WorkoutSessionSummary,
  QuickActionKey,
  QuickActionPreset,
} from '@workout-agent/shared';
import NetInfo from '@react-native-community/netinfo';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { userRepository } from '../db/repositories/UserRepository';
import type Workout from '../db/models/Workout';

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
  plan: TodayPlan | null;
  recentSessions: HomeSnapshot['recentSessions'];
  quickActions: HomeSnapshot['quickActions'];
  offlineHint: HomeSnapshot['offlineHint'];
  isOffline: boolean;
  error: any | null;
  generationStatus: GenerationStatus;
};

/**
 * Hook that fetches home snapshot, caches results, and refetches after mutations
 */
export function useHomeData(): HomeDataState & {
  refetch: () => Promise<void>;
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
  const isMountedRef = useRef(true);

  const [stagedValues, setStagedValues] = useState<
    Partial<Record<QuickActionKey, string | null>>
  >({});

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const hydrateWorkoutPlan = useCallback(
    async (workout: Workout | null) => {
      if (!isMountedRef.current) return;

      if (!workout) {
        setState((prev) => ({
          ...prev,
          status: 'ready',
          plan: null,
          error: null,
        }));
        return;
      }

      try {
        const plan = await workoutRepository.mapWorkoutToPlan(workout);
        if (!isMountedRef.current) return;
        setState((prev) => ({
          ...prev,
          status: 'ready',
          plan,
          error: null,
        }));
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error('Failed to hydrate workout plan', error);
        setState((prev) => ({
          ...prev,
          status: 'error',
          error,
        }));
      }
    },
    [],
  );

  // Observe today's workout from DB
  useEffect(() => {
    const subscription = workoutRepository.observeTodayWorkout().subscribe((workouts) => {
      const workout = workouts.length > 0 ? workouts[0] : null;
      void hydrateWorkoutPlan(workout);
    });

    const recentSubscription = workoutRepository
      .observeRecentSessions()
      .subscribe((recentWorkouts) => {
        if (!isMountedRef.current) return;
        const summaries = recentWorkouts.map((workout) =>
          workoutRepository.toSessionSummary(workout),
        );
        setState((prev) => ({
          ...prev,
          recentSessions: summaries,
        }));
      });

    return () => {
      subscription.unsubscribe();
      recentSubscription.unsubscribe();
    };
  }, [hydrateWorkoutPlan]);

  // Offline detection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netInfo) => {
      const isOffline = !(netInfo.isConnected && netInfo.isInternetReachable !== false);
      if (!isMountedRef.current) return;
      setState((prev) => ({
        ...prev,
        isOffline,
        offlineHint: {
          ...prev.offlineHint,
          offline: isOffline,
        },
      }));
    });

    return () => unsubscribe();
  }, []);

  // Ensure user exists
  useEffect(() => {
    void userRepository.getOrCreateUser();
  }, []);

  const fetchData = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: 'loading',
    }));
    try {
      const workout = await workoutRepository.getTodayWorkout();
      await hydrateWorkoutPlan(workout);
    } catch (error) {
      if (!isMountedRef.current) return;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error,
      }));
    }
  }, [hydrateWorkoutPlan]);

  const clearStagedValues = useCallback(() => {
    setStagedValues({});
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
    updateStagedValue,
    clearStagedValues,
  };
}
