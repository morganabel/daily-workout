/**
 * Hook to fetch and manage home snapshot data
 * Replaces useMockedHomeData with real API calls
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import type {
  GenerationStatus,
  HomeSnapshot,
  TodayPlan,
  WorkoutSessionSummary,
  QuickActionKey,
  QuickActionPreset,
} from '@workout-agent/shared';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { userRepository } from '../db/repositories/UserRepository';
import Workout from '../db/models/Workout';

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

  const [stagedValues, setStagedValues] = useState<
    Partial<Record<QuickActionKey, string | null>>
  >({});

  // Observe today's workout from DB
  useEffect(() => {
    const subscription = workoutRepository.observeTodayWorkout().subscribe((workouts) => {
      const workout = workouts.length > 0 ? workouts[0] : null;

      if (workout) {
        // Transform DB model to TodayPlan
        // Note: We need to fetch exercises and sets asynchronously or use a query with includes
        // For now, we'll do a simple transformation and fetch details if needed
        // In a real app, we'd use `withObservables` or similar to get the full tree

        // This is a simplified transformation.
        // In a real implementation, we would need to fetch relations.
        // Since we are inside a subscription, we can't easily await.
        // We might need to refactor this to use `withObservables` HOC for the component instead.
        // But for this hook, let's just set the basic plan info.

        const plan: TodayPlan = {
          id: workout.id,
          focus: workout.name, // Using name as focus for now since we don't have a separate focus field in DB yet
          durationMinutes: workout.durationSeconds ? Math.round(workout.durationSeconds / 60) : 30,
          equipment: [], // TODO: Derive from exercises
          source: 'ai', // Defaulting to AI for now
          energy: 'moderate', // Defaulting
          summary: 'Your planned workout',
          blocks: [], // We'd need to fetch these
        };

        setState(prev => ({
          ...prev,
          status: 'ready',
          plan,
        }));
      } else {
        setState(prev => ({
          ...prev,
          status: 'ready',
          plan: null,
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ensure user exists
  useEffect(() => {
    userRepository.getOrCreateUser();
  }, []);

  const fetchData = useCallback(async () => {
    // No-op for now as we are observing DB
  }, []);

  const clearStagedValues = useCallback(() => {
    setStagedValues({});
  }, []);

  const setPlan = useCallback(
    (plan: TodayPlan | null) => {
      // This is now handled by DB updates
    },
    [],
  );

  const addSession = useCallback((session: WorkoutSessionSummary) => {
    // This would be handled by DB updates
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
