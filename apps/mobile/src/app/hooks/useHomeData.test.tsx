import { renderHook, act, waitFor } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  createAdaptiveTrainingPlanFromTemplate,
  type QuickActionPreset,
  type TodayPlan,
} from '@workout-agent/shared';
import {
  createSessionSummaryFixture,
  createTodayPlanFixture,
} from '@workout-agent/shared/testing';
import { useHomeData } from './useHomeData';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { plannedEventRepository } from '../db/repositories/PlannedEventRepository';
import { userRepository } from '../db/repositories/UserRepository';
import type Workout from '../db/models/Workout';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn((callback) => callback()),
}));

jest.mock('../db/repositories/WorkoutRepository', () => {
  const observePlannedWorkoutVersionsForDate = jest.fn();
  const observeRecentSessions = jest.fn();
  const listPlannedWorkoutVersionsForLocalDate = jest.fn();
  const listRecentSessions = jest.fn();
  const mapWorkoutToPlan = jest.fn();
  const toSessionSummary = jest.fn();
  const selectWorkoutVersion = jest.fn();

  return {
    workoutRepository: {
      observePlannedWorkoutVersionsForDate,
      observeRecentSessions,
      listPlannedWorkoutVersionsForLocalDate,
      listRecentSessions,
      mapWorkoutToPlan,
      toSessionSummary,
      selectWorkoutVersion,
      archiveWorkoutById: jest.fn(),
      unarchiveWorkoutById: jest.fn(),
      deleteWorkoutById: jest.fn(),
    },
  };
});

jest.mock('../db/repositories/UserRepository', () => ({
  userRepository: {
    getOrCreateUser: jest.fn(),
    getPreferences: jest.fn(),
    observeUser: jest.fn(),
  },
}));

jest.mock('../db/repositories/PlannedEventRepository', () => ({
  plannedEventRepository: {
    observeEvents: jest.fn(),
    observeEventsByLocalDate: jest.fn(),
    observeUpcomingEventContext: jest.fn(),
    listUpcomingEventContext: jest.fn(),
    toPlannedEvent: jest.fn((record) => record),
  },
}));

const mockWorkoutRepository = workoutRepository as jest.Mocked<
  typeof workoutRepository
>;
const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockPlannedEventRepository = plannedEventRepository as jest.Mocked<
  typeof plannedEventRepository
>;
const mockNetInfo = NetInfo as unknown as {
  addEventListener: jest.Mock;
};

const createObservableMock = <T,>() => {
  let handler: ((value: T) => void) | null = null;
  return {
    observable: {
      subscribe: (callback: (value: T) => void) => {
        handler = callback;
        return {
          unsubscribe: () => {
            handler = null;
          },
        };
      },
    },
    emit: (value: T) => handler?.(value),
  };
};

describe('useHomeData', () => {
  let versionStream: ReturnType<typeof createObservableMock<Workout[]>>;
  let sessionStream: ReturnType<typeof createObservableMock<Workout[]>>;
  let upcomingEventStream: ReturnType<typeof createObservableMock<unknown[]>>;
  let mockPlan: ReturnType<typeof createTodayPlanFixture>;
  let userStream: ReturnType<typeof createObservableMock<unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    versionStream = createObservableMock<Workout[]>();
    sessionStream = createObservableMock<Workout[]>();
    upcomingEventStream = createObservableMock<unknown[]>();
    userStream = createObservableMock<unknown>();
    mockPlan = createTodayPlanFixture({ id: 'server-plan' });

    mockWorkoutRepository.observePlannedWorkoutVersionsForDate.mockReturnValue(
      versionStream.observable as any
    );
    mockWorkoutRepository.observeRecentSessions.mockReturnValue(
      sessionStream.observable as any
    );
    mockWorkoutRepository.listPlannedWorkoutVersionsForLocalDate.mockResolvedValue(
      []
    );
    mockWorkoutRepository.mapWorkoutToPlan.mockResolvedValue(mockPlan);
    mockWorkoutRepository.toSessionSummary.mockImplementation(
      (workout: Workout) =>
        createSessionSummaryFixture({
          id: workout.id,
          name: workout.name || 'Workout',
        })
    );
    mockUserRepository.getOrCreateUser.mockResolvedValue(undefined as never);
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: [],
      injuries: [],
      focusBias: [],
      avoid: [],
    });
    mockUserRepository.observeUser.mockReturnValue(
      userStream.observable as any
    );
    mockPlannedEventRepository.observeUpcomingEventContext.mockReturnValue(
      upcomingEventStream.observable as any
    );
    mockPlannedEventRepository.listUpcomingEventContext.mockResolvedValue([]);
    mockNetInfo.addEventListener = jest.fn().mockImplementation((callback) => {
      callback({ isConnected: true, isInternetReachable: true });
      return () => {
        // Cleanup
      };
    });
  });

  it('hydrates plan emitted from repository', async () => {
    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      versionStream.emit([
        { id: 'local-workout', isSelected: true } as unknown as Workout,
      ]);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(mockWorkoutRepository.mapWorkoutToPlan).toHaveBeenCalled();
    expect(result.current.plan).toEqual(mockPlan);
    expect(result.current.activePlan).toEqual(mockPlan);
  });

  it('updates recent sessions when repository emits completed workouts', async () => {
    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      sessionStream.emit([
        { id: 'session-1', name: 'Session One' } as unknown as Workout,
        { id: 'session-2', name: 'Session Two' } as unknown as Workout,
      ]);
    });

    await waitFor(() => {
      expect(result.current.recentSessions).toHaveLength(2);
    });
    expect(mockWorkoutRepository.toSessionSummary).toHaveBeenCalledTimes(2);
  });

  it('loads adaptive plan state and resolves a Home recommendation', async () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Gym'],
      injuries: [],
      focusBias: [],
      avoid: [],
      adaptiveTrainingPlan: plan,
    });

    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      userStream.emit({});
    });

    await waitFor(() => {
      expect(result.current.adaptivePlan?.id).toBe('plan-ppl');
      expect(result.current.adaptiveRecommendation?.primaryBlockId).toBe(
        'push'
      );
    });
    expect(
      mockPlannedEventRepository.observeUpcomingEventContext
    ).toHaveBeenCalledWith({ startLocalDate: expect.any(String) });
  });

  it('uses staged available time when resolving adaptive add-ons', async () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Gym'],
      injuries: [],
      focusBias: [],
      avoid: [],
      adaptiveTrainingPlan: plan,
    });

    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      userStream.emit({});
    });

    await waitFor(() => {
      expect(result.current.adaptiveRecommendation?.addOnBlockIds).toEqual([]);
    });

    await act(async () => {
      result.current.updateStagedValue('time', '75');
    });

    await waitFor(() => {
      expect(result.current.adaptiveRecommendation?.addOnBlockIds).toContain(
        'easy-cardio'
      );
    });
  });

  it('refreshes adaptive recommendations when upcoming events change', async () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Gym'],
      injuries: [],
      focusBias: [],
      avoid: [],
      adaptiveTrainingPlan: plan,
    });

    renderHook(() => useHomeData());

    await act(async () => {
      userStream.emit({});
    });

    await waitFor(() => {
      expect(
        mockPlannedEventRepository.observeUpcomingEventContext
      ).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      upcomingEventStream.emit([
        {
          kind: 'run',
          title: 'Same-day run',
          localDate: new Date().toISOString().slice(0, 10),
          intensity: 'high',
        },
      ]);
    });

    await waitFor(() => {
      expect(
        mockPlannedEventRepository.observeUpcomingEventContext
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('hydrates planned workout versions from the selected group', async () => {
    const selectedPlan = createTodayPlanFixture({ id: 'selected-version' });
    const oldPlan = createTodayPlanFixture({ id: 'old-version' });
    mockWorkoutRepository.mapWorkoutToPlan
      .mockResolvedValueOnce(selectedPlan)
      .mockResolvedValueOnce(oldPlan);

    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      versionStream.emit([
        {
          id: 'selected-version',
          generationGroupId: 'group-1',
          isSelected: true,
        } as unknown as Workout,
        {
          id: 'old-version',
          generationGroupId: 'group-1',
          isSelected: false,
        } as unknown as Workout,
      ]);
    });

    await waitFor(() => {
      expect(result.current.planVersions).toHaveLength(2);
    });
    expect(
      result.current.planVersions.map((plan: TodayPlan) => plan.id)
    ).toEqual(['selected-version', 'old-version']);
  });

  it('supports manual refetch by querying the repository', async () => {
    mockWorkoutRepository.listPlannedWorkoutVersionsForLocalDate.mockResolvedValueOnce(
      [{ id: 'refetch', isSelected: true } as unknown as Workout]
    );
    mockWorkoutRepository.mapWorkoutToPlan.mockResolvedValueOnce(
      createTodayPlanFixture({ id: 'refetched-plan', focus: 'Refetched' })
    );

    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      await result.current.refetch();
    });

    expect(
      mockWorkoutRepository.listPlannedWorkoutVersionsForLocalDate
    ).toHaveBeenCalledWith(result.current.planningDateLocal);
    expect(result.current.plan?.focus).toBe('Refetched');
  });

  it('delegates workout version selection to the repository', async () => {
    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      await result.current.selectWorkoutVersion('version-2');
    });

    expect(mockWorkoutRepository.selectWorkoutVersion).toHaveBeenCalledWith(
      'version-2'
    );
  });

  it('optimistically selects a workout version before the repository emits', async () => {
    const selectedPlan = createTodayPlanFixture({ id: 'selected-version' });
    const version = createTodayPlanFixture({ id: 'version-optimistic' });
    mockWorkoutRepository.mapWorkoutToPlan
      .mockResolvedValueOnce(selectedPlan)
      .mockResolvedValueOnce(version);
    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      versionStream.emit([
        {
          id: 'selected-version',
          generationGroupId: 'group-1',
          isSelected: true,
        } as unknown as Workout,
        {
          id: 'version-optimistic',
          generationGroupId: 'group-1',
          isSelected: false,
        } as unknown as Workout,
      ]);
    });

    await waitFor(() => {
      expect(result.current.planVersions).toHaveLength(2);
    });

    await act(async () => {
      await result.current.selectWorkoutVersionPlan(version);
    });

    expect(mockWorkoutRepository.selectWorkoutVersion).toHaveBeenCalledWith(
      'version-optimistic'
    );
    expect(result.current.activePlan?.id).toBe('version-optimistic');
  });

  it('appends optimistic generated plan to active versions for the same date', async () => {
    const persistedPlan = createTodayPlanFixture({
      id: 'persisted-plan',
      summary: 'Persisted workout',
    });
    const optimisticPlan = createTodayPlanFixture({
      id: 'optimistic-plan',
      summary: 'Optimistic workout',
    });
    mockWorkoutRepository.mapWorkoutToPlan.mockResolvedValueOnce(persistedPlan);
    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      versionStream.emit([
        { id: 'persisted-plan', isSelected: true } as unknown as Workout,
      ]);
    });

    await waitFor(() => {
      expect(result.current.planVersions).toHaveLength(1);
    });

    act(() => {
      result.current.setOptimisticPlanForDate(
        optimisticPlan,
        result.current.planningDateLocal
      );
    });

    expect(result.current.activePlan?.id).toBe('optimistic-plan');
    expect(
      result.current.activePlanVersions.map((plan: TodayPlan) => plan.id)
    ).toEqual(['persisted-plan', 'optimistic-plan']);
  });

  it('tracks staged quick action values', async () => {
    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      result.current.updateStagedValue('time', '45');
    });

    const timeAction = result.current.quickActions.find(
      (action: QuickActionPreset) => action.key === 'time'
    );
    expect(timeAction?.stagedValue).toBe('45');

    await act(async () => {
      result.current.clearStagedValues();
    });

    const clearedAction = result.current.quickActions.find(
      (action: QuickActionPreset) => action.key === 'time'
    );
    expect(clearedAction?.stagedValue).toBeNull();
  });

  it('reflects offline status emitted by NetInfo', async () => {
    let listener:
      | ((state: {
          isConnected: boolean;
          isInternetReachable?: boolean;
        }) => void)
      | null = null;
    mockNetInfo.addEventListener.mockImplementation((callback) => {
      listener = callback;
      callback({ isConnected: true, isInternetReachable: true });
      return () => {
        listener = null;
      };
    });

    const { result } = renderHook(() => useHomeData());

    act(() => {
      listener?.({ isConnected: false, isInternetReachable: false });
    });

    await waitFor(() => {
      expect(result.current.isOffline).toBe(true);
      expect(result.current.offlineHint.offline).toBe(true);
    });
  });

  it('moves to the new local date and clears stale plans when refreshed after midnight', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-26T23:59:00'));
    try {
      const { result } = renderHook(() => useHomeData());

      expect(result.current.planningDateLocal).toBe('2026-04-26');
      expect(
        mockWorkoutRepository.observePlannedWorkoutVersionsForDate
      ).toHaveBeenCalledWith('2026-04-26');

      jest.setSystemTime(new Date('2026-04-27T00:01:00'));
      act(() => {
        result.current.refreshPlanningDate();
      });

      expect(result.current.planningDateLocal).toBe('2026-04-27');
      expect(result.current.plan).toBeNull();
      expect(result.current.planVersions).toEqual([]);
      await waitFor(() => {
        expect(
          mockWorkoutRepository.observePlannedWorkoutVersionsForDate
        ).toHaveBeenCalledWith('2026-04-27');
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
