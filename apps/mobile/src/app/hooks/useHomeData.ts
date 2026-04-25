/**
 * Hook to fetch and manage home snapshot data
 * Replaces useMockedHomeData with real API calls
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type {
  GenerationStatus,
  HomeSnapshot,
  TodayPlan,
  QuickActionKey,
  QuickActionPreset,
  UserPreferences,
} from '@workout-agent/shared';
import NetInfo from '@react-native-community/netinfo';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { userRepository } from '../db/repositories/UserRepository';
import type Workout from '../db/models/Workout';

const buildQuickActionsFromPreferences = (prefs: UserPreferences): QuickActionPreset[] => {
  const equipmentLabel =
    prefs.equipment && prefs.equipment.length > 0 ? prefs.equipment.join(', ') : 'Bodyweight';

  const focusLabel =
    prefs.focusBias && prefs.focusBias.length > 0 ? prefs.focusBias[0] : 'Full body';

  return [
    {
      key: 'time',
      label: 'Time',
      value: '60',
      description: '60 min',
      stagedValue: null,
    },
    {
      key: 'focus',
      label: 'Focus',
      value: focusLabel,
      description: focusLabel,
      stagedValue: null,
    },
    {
      key: 'equipment',
      label: 'Equipment',
      value: equipmentLabel,
      description: equipmentLabel,
      stagedValue: null,
    },
    {
      key: 'energy',
      label: 'Energy',
      value: 'Moderate',
      description: 'Moderate energy',
      stagedValue: null,
    },
  ];
};

const FALLBACK_QUICK_ACTIONS = buildQuickActionsFromPreferences({
  equipment: [],
  injuries: [],
  focusBias: [],
  avoid: [],
});

export type HomeDataState = {
  status: 'loading' | 'ready' | 'error';
  plan: TodayPlan | null;
  planVersions: TodayPlan[];
  recentSessions: HomeSnapshot['recentSessions'];
  quickActions: HomeSnapshot['quickActions'];
  offlineHint: HomeSnapshot['offlineHint'];
  isOffline: boolean;
  error: unknown | null;
  generationStatus: GenerationStatus;
};

/**
 * Hook that fetches home snapshot, caches results, and refetches after mutations
 */
export function useHomeData(): HomeDataState & {
  refetch: () => Promise<void>;
  selectWorkoutVersion: (workoutId: string) => Promise<void>;
  updateStagedValue: (actionKey: QuickActionKey, stagedValue: string | null) => void;
  clearStagedValues: () => void;
  setGenerationStatus: (status: GenerationStatus) => void;
} {
  const initialStatus: GenerationStatus = {
    state: 'idle',
    submittedAt: null,
  };

  const [state, setState] = useState<HomeDataState>({
    status: 'loading',
    plan: null,
    planVersions: [],
    recentSessions: [],
    quickActions: FALLBACK_QUICK_ACTIONS,
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

  const hydrateWorkoutVersions = useCallback(async (workouts: Workout[]) => {
    if (!isMountedRef.current) return;

    const selectedWorkout =
      workouts.find((workout) => workout.isSelected === true) ??
      workouts.find((workout) => workout.isSelected !== false);
    const selectedGroupId = selectedWorkout
      ? selectedWorkout.generationGroupId || selectedWorkout.id
      : undefined;

    if (!selectedGroupId) {
      setState((prev) => ({ ...prev, planVersions: [] }));
      return;
    }

    const versionWorkouts = workouts.filter(
      (workout) => (workout.generationGroupId || workout.id) === selectedGroupId,
    );
    const plans = await Promise.all(
      versionWorkouts.map((workout) => workoutRepository.mapWorkoutToPlan(workout)),
    );

    if (!isMountedRef.current) return;
    setState((prev) => ({
      ...prev,
      planVersions: plans,
    }));
  }, []);

  // Observe today's workout from DB
  useEffect(() => {
    const subscription = workoutRepository.observeTodayWorkout().subscribe((workouts) => {
      const workout = workouts.length > 0 ? workouts[0] : null;
      void hydrateWorkoutPlan(workout);
    });

    const versionSubscription = workoutRepository
      .observeTodayWorkoutVersions()
      .subscribe((workouts) => {
        void hydrateWorkoutVersions(workouts);
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
      versionSubscription.unsubscribe();
      recentSubscription.unsubscribe();
    };
  }, [hydrateWorkoutPlan, hydrateWorkoutVersions]);

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

  // Ensure user exists and keep quick actions in sync with profile changes
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    const setup = async () => {
      await userRepository.getOrCreateUser();
      if (!isMountedRef.current || cancelled) return;

      const sub = userRepository.observeUser().subscribe(() => {
        void (async () => {
          const prefs = await userRepository.getPreferences();
          if (!isMountedRef.current || cancelled) return;
          setState((prev) => ({
            ...prev,
            quickActions: buildQuickActionsFromPreferences(prefs),
          }));
        })();
      });
      if (cancelled) {
        sub.unsubscribe();
        return;
      }
      subscription = sub;
    };

    void setup();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const fetchData = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: 'loading',
    }));
    try {
      const workout = await workoutRepository.getTodayWorkout();
      await hydrateWorkoutPlan(workout);
      const versions = await workoutRepository.listPlannedWorkoutVersionsForDate(
        Date.now(),
      );
      await hydrateWorkoutVersions(versions);
    } catch (error) {
      if (!isMountedRef.current) return;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error,
      }));
    }
  }, [hydrateWorkoutPlan, hydrateWorkoutVersions]);

  const selectWorkoutVersion = useCallback(async (workoutId: string) => {
    await workoutRepository.selectWorkoutVersion(workoutId);
  }, []);

  const clearStagedValues = useCallback(() => {
    setStagedValues({});
  }, []);

  const setGenerationStatus = useCallback((status: GenerationStatus) => {
    if (!isMountedRef.current) return;
    setState((prev) => ({
      ...prev,
      generationStatus: status,
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
    selectWorkoutVersion,
    updateStagedValue,
    clearStagedValues,
    setGenerationStatus,
  };
}
