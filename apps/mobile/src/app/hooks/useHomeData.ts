/**
 * Hook to derive Home data from local app repositories.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import type {
  AdaptivePlanRecommendation,
  AdaptiveTrainingPlan,
  CoachProjection,
  CoachProjectedSession,
  CoachSessionAction,
  GenerationStatus,
  OfflineHint,
  TodayPlan,
  QuickActionKey,
  QuickActionPreset,
  UpcomingEventContext,
  UserPreferences,
  WorkoutSessionSummary,
} from '@workout-agent/shared';
import NetInfo from '@react-native-community/netinfo';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { coachSessionActionRepository } from '../db/repositories/CoachSessionActionRepository';
import { plannedEventRepository } from '../db/repositories/PlannedEventRepository';
import { userRepository } from '../db/repositories/UserRepository';
import type Workout from '../db/models/Workout';
import { formatLocalDate, parseLocalDate } from '../utils/date';
import { resolveAdaptiveTrainingRecommendation } from '../services/adaptiveTrainingPlanResolver';
import { deriveCoachProjection } from '../services/coachProjectionResolver';

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

type StagedQuickActionValues = Partial<Record<QuickActionKey, string | null>>;

const getQuickActionResolvedValue = (
  quickActions: QuickActionPreset[],
  stagedValues: StagedQuickActionValues,
  key: QuickActionKey
): string | undefined => {
  const stagedValue = stagedValues[key];
  if (stagedValue?.trim()) {
    return stagedValue;
  }

  const action = quickActions.find((item) => item.key === key);
  return action?.stagedValue ?? action?.value ?? action?.description;
};

const resolveAvailableTimeMinutes = (
  quickActions: QuickActionPreset[],
  stagedValues: StagedQuickActionValues
): number | undefined => {
  const value = getQuickActionResolvedValue(quickActions, stagedValues, 'time');
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const getCurrentLocalDate = (): string => formatLocalDate(new Date());

const getNextLocalMidnightDelay = (localDate: string): number => {
  const nextDay = parseLocalDate(localDate);
  nextDay.setDate(nextDay.getDate() + 1);
  return Math.max(1000, nextDay.getTime() - Date.now() + 1000);
};

const getLocalDateTimestamp = (localDate: string): number =>
  parseLocalDate(localDate).getTime();

// Identity keys repeat across cycles (ordinals reset each cycle), and a
// 14-day window spans cycle boundaries, so derived pin ids must include the
// cycle index to keep pins in adjacent cycles from overwriting each other.
const getCoachPinId = (session: CoachProjectedSession): string =>
  session.sessionIdentityKey.startsWith('pin:')
    ? session.sessionIdentityKey.slice('pin:'.length)
    : `pin:${session.cycleIndex}:${session.sessionIdentityKey}`;

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
  adaptivePlan: AdaptiveTrainingPlan | null;
  adaptiveRecommendation: AdaptivePlanRecommendation | null;
  coachProjection: CoachProjection | null;
  recentSessions: WorkoutSessionSummary[];
  quickActions: QuickActionPreset[];
  offlineHint: OfflineHint;
  isOffline: boolean;
  error: unknown | null;
  generationStatus: GenerationStatus;
};

/**
 * Hook that observes local Home data and refetches repository-backed values after mutations.
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
  skipCoachProjectionSession: (projectionId: string) => Promise<void>;
  pinCoachProjectionSession: (projectionId: string) => Promise<void>;
  unpinCoachProjectionSession: (projectionId: string) => Promise<void>;
  moveCoachProjectionSession: (
    projectionId: string,
    localDate: string
  ) => Promise<void>;
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
    adaptivePlan: null,
    adaptiveRecommendation: null,
    coachProjection: null,
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
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEventContext[]>(
    []
  );
  const [coachSessionActions, setCoachSessionActions] = useState<
    CoachSessionAction[]
  >([]);

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
        adaptiveRecommendation: null,
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

    return () => {
      versionSubscription.unsubscribe();
      recentSubscription.unsubscribe();
    };
  }, [hydrateWorkoutVersions, state.planningDateLocal]);

  useEffect(() => {
    const adaptivePlan = state.adaptivePlan;
    if (!adaptivePlan || adaptivePlan.status !== 'active') {
      setUpcomingEvents([]);
      return;
    }

    const subscription = plannedEventRepository
      .observeUpcomingEventContext({
        startLocalDate: state.planningDateLocal,
        daysAhead: 14,
      })
      .subscribe((events) => {
        if (!isMountedRef.current) return;
        setUpcomingEvents(events);
      });

    return () => subscription.unsubscribe();
  }, [state.adaptivePlan, state.planningDateLocal]);

  useEffect(() => {
    const adaptivePlan = state.adaptivePlan;
    if (!adaptivePlan || adaptivePlan.status !== 'active') {
      setCoachSessionActions([]);
      return;
    }

    const subscription = coachSessionActionRepository
      .observeActionsForProgram(adaptivePlan.id)
      .subscribe((actions) => {
        if (!isMountedRef.current) return;
        setCoachSessionActions(actions);
      });

    return () => subscription.unsubscribe();
  }, [state.adaptivePlan]);

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

      const initialPrefs = await userRepository.getPreferences();
      if (!isMountedRef.current || cancelled) return;
      setState((prev) => ({
        ...prev,
        quickActions: buildQuickActionsFromPreferences(initialPrefs),
        adaptivePlan: initialPrefs.adaptiveTrainingPlan ?? null,
      }));

      const sub = userRepository.observeUser().subscribe(() => {
        void (async () => {
          const prefs = await userRepository.getPreferences();
          if (!isMountedRef.current || cancelled) return;
          setState((prev) => ({
            ...prev,
            quickActions: buildQuickActionsFromPreferences(prefs),
            adaptivePlan: prefs.adaptiveTrainingPlan ?? null,
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

  // Only the resolved time value feeds the resolvers, so depend on the
  // derived number instead of the raw staging state — staging focus,
  // equipment, or energy should not recompute the recommendation/projection.
  const availableTimeMinutes = useMemo(
    () => resolveAvailableTimeMinutes(state.quickActions, stagedValues),
    [state.quickActions, stagedValues]
  );

  useEffect(() => {
    const adaptivePlan = state.adaptivePlan;

    if (!adaptivePlan || adaptivePlan.status !== 'active') {
      setState((prev) =>
        prev.adaptiveRecommendation === null && prev.coachProjection === null
          ? prev
          : { ...prev, adaptiveRecommendation: null, coachProjection: null }
      );
      return;
    }

    try {
      const recommendation = resolveAdaptiveTrainingRecommendation({
        plan: adaptivePlan,
        planningDateLocal: state.planningDateLocal,
        recentSessions: state.recentSessions,
        upcomingEvents,
        availableTimeMinutes,
      });
      const coachProjection = deriveCoachProjection({
        plan: adaptivePlan,
        planningDateLocal: state.planningDateLocal,
        recentSessions: state.recentSessions,
        sessionActions: coachSessionActions,
        upcomingEvents,
        availableTimeMinutes,
        windowDays: 14,
      });

      setState((prev) => ({
        ...prev,
        adaptiveRecommendation: recommendation,
        coachProjection,
      }));
    } catch (error) {
      console.error('Failed to resolve adaptive recommendation', error);
      setState((prev) => ({
        ...prev,
        adaptiveRecommendation: null,
        coachProjection: null,
      }));
    }
  }, [
    availableTimeMinutes,
    coachSessionActions,
    state.adaptivePlan,
    state.planningDateLocal,
    state.recentSessions,
    upcomingEvents,
  ]);

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

  const getProjectionSession = useCallback(
    (projectionId: string): CoachProjectedSession | undefined =>
      state.coachProjection?.sessions.find(
        (session) => session.id === projectionId
      ),
    [state.coachProjection]
  );

  const upsertPinnedSessionPreference = useCallback(
    async (session: CoachProjectedSession, localDate: string) => {
      const adaptivePlan = state.adaptivePlan;
      if (!adaptivePlan || !session.sourceBlockId) {
        return;
      }

      const pinId = getCoachPinId(session);
      const nextSessionPreference = {
        id: pinId,
        localDate,
        blockIds: [session.sourceBlockId, ...session.addOnBlockIds],
        status: 'pinned' as const,
        note: 'Pinned from coach projection.',
      };

      await userRepository.updateAdaptiveTrainingPlan({
        sessionPreferences: [
          ...adaptivePlan.sessionPreferences.filter(
            (preference) => preference.id !== pinId
          ),
          nextSessionPreference,
        ],
      });
    },
    [state.adaptivePlan]
  );

  const skipCoachProjectionSession = useCallback(
    async (projectionId: string) => {
      const adaptivePlan = state.adaptivePlan;
      const session = getProjectionSession(projectionId);
      if (!adaptivePlan || !session) {
        return;
      }

      const linkedWorkout = session.workoutId
        ? null
        : await workoutRepository.findPlannedWorkoutByCoachProjectionId(
            session.id
          );
      const workoutId = session.workoutId ?? linkedWorkout?.id;
      if (workoutId) {
        await workoutRepository.skipWorkoutById(workoutId);
      }

      await coachSessionActionRepository.recordSkipAction({
        programId: adaptivePlan.id,
        programVersion: adaptivePlan.programVersion ?? 1,
        strategy: adaptivePlan.scheduleStrategy ?? 'weekly-target-balance',
        cycleIndex: session.cycleIndex,
        sessionIdentityKey: session.sessionIdentityKey,
        projectionId: session.id,
        sourceBlockId: session.sourceBlockId,
        projectedLocalDate: session.localDate,
        actionLocalDate: state.planningDateLocal,
        workoutId,
      });
    },
    [getProjectionSession, state.adaptivePlan, state.planningDateLocal]
  );

  const pinCoachProjectionSession = useCallback(
    async (projectionId: string) => {
      const session = getProjectionSession(projectionId);
      if (!session) {
        return;
      }

      await upsertPinnedSessionPreference(session, session.localDate);
    },
    [getProjectionSession, upsertPinnedSessionPreference]
  );

  const unpinCoachProjectionSession = useCallback(
    async (projectionId: string) => {
      const adaptivePlan = state.adaptivePlan;
      const session = getProjectionSession(projectionId);
      if (!adaptivePlan || !session) {
        return;
      }

      const pinId = getCoachPinId(session);

      await userRepository.updateAdaptiveTrainingPlan({
        sessionPreferences: adaptivePlan.sessionPreferences.filter(
          (preference) => preference.id !== pinId
        ),
      });
    },
    [getProjectionSession, state.adaptivePlan]
  );

  const moveCoachProjectionSession = useCallback(
    async (projectionId: string, localDate: string) => {
      const session = getProjectionSession(projectionId);
      if (!session) {
        return;
      }

      await upsertPinnedSessionPreference(session, localDate);
    },
    [getProjectionSession, upsertPinnedSessionPreference]
  );

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
    skipCoachProjectionSession,
    pinCoachProjectionSession,
    unpinCoachProjectionSession,
    moveCoachProjectionSession,
  };
}
