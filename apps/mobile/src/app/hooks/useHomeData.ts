/**
 * Hook to fetch and manage home snapshot data
 * Replaces useMockedHomeData with real API calls
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import type {
  GenerationStatus,
  HomeSnapshot,
  PlannedSlotMetadata,
  TodayPlan,
  QuickActionKey,
  QuickActionPreset,
  UserPreferences,
} from '@workout-agent/shared';
import { plannedSlotMetadataSchema } from '@workout-agent/shared';
import NetInfo from '@react-native-community/netinfo';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { plannedEventRepository } from '../db/repositories/PlannedEventRepository';
import { userRepository } from '../db/repositories/UserRepository';
import type Workout from '../db/models/Workout';
import { formatLocalDate, parseLocalDate } from '../utils/date';

const buildQuickActionsFromPreferences = (
  prefs: UserPreferences
): QuickActionPreset[] => {
  const equipmentLabel =
    prefs.equipment && prefs.equipment.length > 0
      ? prefs.equipment.join(', ')
      : 'Bodyweight';

  const focusLabel =
    prefs.focusBias && prefs.focusBias.length > 0
      ? prefs.focusBias[0]
      : 'Full body';

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

const getCurrentLocalDate = (): string => formatLocalDate(new Date());

const getNextLocalMidnightDelay = (localDate: string): number => {
  const nextDay = parseLocalDate(localDate);
  nextDay.setDate(nextDay.getDate() + 1);
  return Math.max(1000, nextDay.getTime() - Date.now() + 1000);
};

const getLocalDateTimestamp = (localDate: string): number =>
  parseLocalDate(localDate).getTime();

const normalizeEquipmentForComparison = (equipment: string[]): string[] =>
  equipment
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .sort();

const equipmentSelectionsEqual = (left: string[], right: string[]): boolean => {
  const normalizedLeft = normalizeEquipmentForComparison(left);
  const normalizedRight = normalizeEquipmentForComparison(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((item, index) => item === normalizedRight[index])
  );
};

const plansMatchDisplayedContent = (
  left: TodayPlan,
  right: TodayPlan
): boolean =>
  (Boolean(left.responseId) && left.responseId === right.responseId) ||
  (left.focus === right.focus &&
    left.durationMinutes === right.durationMinutes &&
    left.summary === right.summary &&
    equipmentSelectionsEqual(left.equipment, right.equipment));

export type HomeDataState = {
  status: 'loading' | 'ready' | 'error';
  planningDateLocal: string;
  planningDateTimestamp: number;
  plan: TodayPlan | null;
  activePlan: TodayPlan | null;
  planVersions: TodayPlan[];
  activePlanVersions: TodayPlan[];
  pendingPlanSnapshot: TodayPlan | null;
  plannedSlot: PlannedSlotMetadata | null;
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
  selectWorkoutVersionPlan: (version: TodayPlan) => Promise<void>;
  setOptimisticPlanForDate: (plan: TodayPlan, localDate: string) => void;
  setPendingPlanSnapshot: (plan: TodayPlan | null) => void;
  clearTransientPlanState: () => void;
  refreshPlanningDate: () => boolean;
  updateStagedValue: (
    actionKey: QuickActionKey,
    stagedValue: string | null
  ) => void;
  clearStagedValues: () => void;
  setGenerationStatus: (status: GenerationStatus) => void;
} {
  const initialStatus: GenerationStatus = {
    state: 'idle',
    submittedAt: null,
  };
  const initialPlanningDate = getCurrentLocalDate();

  const [state, setState] = useState<HomeDataState>({
    status: 'loading',
    planningDateLocal: initialPlanningDate,
    planningDateTimestamp: getLocalDateTimestamp(initialPlanningDate),
    plan: null,
    activePlan: null,
    planVersions: [],
    activePlanVersions: [],
    pendingPlanSnapshot: null,
    plannedSlot: null,
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
  const planningDateLocalRef = useRef(initialPlanningDate);

  const [optimisticPlan, setOptimisticPlan] = useState<TodayPlan | null>(null);
  const [selectedVersionPlan, setSelectedVersionPlan] =
    useState<TodayPlan | null>(null);
  const [pendingPlanSnapshot, setPendingPlanSnapshot] =
    useState<TodayPlan | null>(null);

  const [stagedValues, setStagedValues] = useState<
    Partial<Record<QuickActionKey, string | null>>
  >({});

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    planningDateLocalRef.current = state.planningDateLocal;
  }, [state.planningDateLocal]);

  const refreshPlanningDate = useCallback((): boolean => {
    const nextDate = getCurrentLocalDate();
    const changed = planningDateLocalRef.current !== nextDate;
    if (!changed) return false;

    planningDateLocalRef.current = nextDate;
    setState((prev) => {
      return {
        ...prev,
        planningDateLocal: nextDate,
        planningDateTimestamp: getLocalDateTimestamp(nextDate),
        plan: null,
        planVersions: [],
        plannedSlot: null,
        status: 'loading',
      };
    });
    setOptimisticPlan(null);
    setSelectedVersionPlan(null);
    setPendingPlanSnapshot(null);
    return true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPlanningDate();
      return undefined;
    }, [refreshPlanningDate])
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      refreshPlanningDate();
    }, getNextLocalMidnightDelay(state.planningDateLocal));

    return () => clearTimeout(timeout);
  }, [refreshPlanningDate, state.planningDateLocal]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshPlanningDate();
      }
    });

    return () => subscription.remove();
  }, [refreshPlanningDate]);

  const hydrateWorkoutVersions = useCallback(async (workouts: Workout[]) => {
    if (!isMountedRef.current) return;

    const selectedWorkout =
      workouts.find((workout) => workout.isSelected === true) ??
      workouts.find((workout) => workout.isSelected !== false);
    const selectedGroupId = selectedWorkout
      ? selectedWorkout.generationGroupId || selectedWorkout.id
      : undefined;

    if (!selectedGroupId) {
      setState((prev) => ({
        ...prev,
        status: 'ready',
        plan: null,
        planVersions: [],
        error: null,
      }));
      return;
    }

    const versionWorkouts = workouts.filter(
      (workout) => (workout.generationGroupId || workout.id) === selectedGroupId
    );

    try {
      const plans = await Promise.all(
        versionWorkouts.map((workout) =>
          workoutRepository.mapWorkoutToPlan(workout)
        )
      );
      const selectedIndex = Math.max(
        0,
        versionWorkouts.findIndex(
          (workout) => workout.id === selectedWorkout?.id
        )
      );
      const selectedPlan = plans[selectedIndex] ?? null;

      if (!isMountedRef.current) return;
      setState((prev) => ({
        ...prev,
        status: 'ready',
        plan: selectedPlan,
        planVersions: plans,
        error: null,
      }));
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Failed to hydrate workout versions', error);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error,
      }));
    }
  }, []);

  useEffect(() => {
    if (!optimisticPlan || !state.plan) return;

    if (plansMatchDisplayedContent(state.plan, optimisticPlan)) {
      setOptimisticPlan(null);
    }
  }, [optimisticPlan, state.plan]);

  useEffect(() => {
    if (!selectedVersionPlan) return;

    if (!state.plan) {
      setSelectedVersionPlan(null);
      return;
    }

    if (
      !state.planVersions.some(
        (version) => version.id === selectedVersionPlan.id
      )
    ) {
      setSelectedVersionPlan(null);
      return;
    }

    if (
      state.plan.id === selectedVersionPlan.id ||
      (Boolean(state.plan.responseId) &&
        state.plan.responseId === selectedVersionPlan.responseId)
    ) {
      setSelectedVersionPlan(null);
    }
  }, [selectedVersionPlan, state.plan, state.planVersions]);

  // Observe planned workout versions for the active local date. The selected
  // workout and version list are derived from the same DB emission.
  useEffect(() => {
    const versionSubscription = workoutRepository
      .observePlannedWorkoutVersionsForDate(state.planningDateLocal)
      .subscribe((workouts) => {
        void hydrateWorkoutVersions(workouts);
      });

    const recentSubscription = workoutRepository
      .observeRecentSessions()
      .subscribe((recentWorkouts) => {
        if (!isMountedRef.current) return;
        const summaries = recentWorkouts.map((workout) =>
          workoutRepository.toSessionSummary(workout)
        );
        setState((prev) => ({
          ...prev,
          recentSessions: summaries,
        }));
      });

    const plannedEventSubscription = plannedEventRepository
      .observeEventsByLocalDate(state.planningDateLocal)
      .subscribe((records) => {
        if (!isMountedRef.current) return;
        const plannedSlot = records
          .map((record) => plannedEventRepository.toPlannedEvent(record))
          .filter((event) => event.status !== 'canceled')
          .map((event) => plannedSlotMetadataSchema.safeParse(event.metadata))
          .find(
            (result) =>
              result.success &&
              result.data.plannedDate === state.planningDateLocal
          );

        setState((prev) => ({
          ...prev,
          plannedSlot: plannedSlot?.success ? plannedSlot.data : null,
        }));
      });

    return () => {
      versionSubscription.unsubscribe();
      recentSubscription.unsubscribe();
      plannedEventSubscription.unsubscribe();
    };
  }, [hydrateWorkoutVersions, state.planningDateLocal]);

  // Offline detection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netInfo) => {
      const isOffline = !(
        netInfo.isConnected && netInfo.isInternetReachable !== false
      );
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
    refreshPlanningDate();
    const planningDateLocal = planningDateLocalRef.current;
    setState((prev) => ({
      ...prev,
      status: 'loading',
    }));
    try {
      const versions =
        await workoutRepository.listPlannedWorkoutVersionsForLocalDate(
          planningDateLocal
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
  }, [hydrateWorkoutVersions, refreshPlanningDate]);

  const selectWorkoutVersion = useCallback(async (workoutId: string) => {
    await workoutRepository.selectWorkoutVersion(workoutId);
  }, []);

  const selectWorkoutVersionPlan = useCallback(async (version: TodayPlan) => {
    setSelectedVersionPlan(version);
    setOptimisticPlan(null);
    await workoutRepository.selectWorkoutVersion(version.id);
  }, []);

  const setOptimisticPlanForDate = useCallback(
    (plan: TodayPlan, localDate: string) => {
      if (planningDateLocalRef.current !== localDate) return;
      setSelectedVersionPlan(null);
      setOptimisticPlan(plan);
    },
    []
  );

  const clearTransientPlanState = useCallback(() => {
    setSelectedVersionPlan(null);
    setOptimisticPlan(null);
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
    []
  );

  const quickActionsWithStaged = useMemo(
    () =>
      state.quickActions.map((action) => ({
        ...action,
        stagedValue: stagedValues[action.key] ?? null,
      })),
    [state.quickActions, stagedValues]
  );

  const activePlanVersions = useMemo(() => {
    if (!optimisticPlan) return state.planVersions;
    const withoutOptimistic = state.planVersions.filter(
      (version) => !plansMatchDisplayedContent(version, optimisticPlan)
    );
    return [...withoutOptimistic, optimisticPlan];
  }, [optimisticPlan, state.planVersions]);

  const activePlan = selectedVersionPlan ?? optimisticPlan ?? state.plan;

  return {
    ...state,
    activePlan,
    activePlanVersions,
    pendingPlanSnapshot,
    quickActions: quickActionsWithStaged,
    refetch: fetchData,
    selectWorkoutVersion,
    selectWorkoutVersionPlan,
    setOptimisticPlanForDate,
    setPendingPlanSnapshot,
    clearTransientPlanState,
    refreshPlanningDate,
    updateStagedValue,
    clearStagedValues,
    setGenerationStatus,
  };
}
