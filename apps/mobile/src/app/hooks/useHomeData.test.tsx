import { renderHook, act, waitFor } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  createAdaptiveTrainingPlanFromTemplate,
  type CoachSessionAction,
  type QuickActionPreset,
  type TodayPlan,
} from '@workout-agent/shared';
import {
  createSessionSummaryFixture,
  createTodayPlanFixture,
} from '@workout-agent/shared/testing';
import { useHomeData } from './useHomeData';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { coachSessionActionRepository } from '../db/repositories/CoachSessionActionRepository';
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
  const findPlannedWorkoutByCoachProjectionId = jest.fn();
  const skipWorkoutById = jest.fn();

  return {
    workoutRepository: {
      observePlannedWorkoutVersionsForDate,
      observeRecentSessions,
      listPlannedWorkoutVersionsForLocalDate,
      listRecentSessions,
      mapWorkoutToPlan,
      toSessionSummary,
      selectWorkoutVersion,
      findPlannedWorkoutByCoachProjectionId,
      skipWorkoutById,
      archiveWorkoutById: jest.fn(),
      unarchiveWorkoutById: jest.fn(),
      deleteWorkoutById: jest.fn(),
    },
  };
});

jest.mock('../db/repositories/CoachSessionActionRepository', () => ({
  coachSessionActionRepository: {
    observeActionsForProgram: jest.fn(),
    listActionsForProgram: jest.fn(),
    recordSkipAction: jest.fn(),
  },
}));

jest.mock('../db/repositories/UserRepository', () => ({
  userRepository: {
    getOrCreateUser: jest.fn(),
    getPreferences: jest.fn(),
    observeUser: jest.fn(),
    updateAdaptiveTrainingPlan: jest.fn(),
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
const mockCoachSessionActionRepository =
  coachSessionActionRepository as jest.Mocked<
    typeof coachSessionActionRepository
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

const asMockObservable = <T,>(
  observable: ReturnType<typeof createObservableMock<T>>['observable']
) => observable as never;

describe('useHomeData', () => {
  let versionStream: ReturnType<typeof createObservableMock<Workout[]>>;
  let sessionStream: ReturnType<typeof createObservableMock<Workout[]>>;
  let upcomingEventStream: ReturnType<typeof createObservableMock<unknown[]>>;
  let coachSessionActionStream: ReturnType<
    typeof createObservableMock<unknown[]>
  >;
  let mockPlan: ReturnType<typeof createTodayPlanFixture>;
  let userStream: ReturnType<typeof createObservableMock<unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    versionStream = createObservableMock<Workout[]>();
    sessionStream = createObservableMock<Workout[]>();
    upcomingEventStream = createObservableMock<unknown[]>();
    coachSessionActionStream = createObservableMock<unknown[]>();
    userStream = createObservableMock<unknown>();
    mockPlan = createTodayPlanFixture({ id: 'server-plan' });

    mockWorkoutRepository.observePlannedWorkoutVersionsForDate.mockReturnValue(
      asMockObservable(versionStream.observable)
    );
    mockWorkoutRepository.observeRecentSessions.mockReturnValue(
      asMockObservable(sessionStream.observable)
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
    mockWorkoutRepository.findPlannedWorkoutByCoachProjectionId.mockResolvedValue(
      null
    );
    mockWorkoutRepository.skipWorkoutById.mockResolvedValue(undefined);
    mockUserRepository.getOrCreateUser.mockResolvedValue(undefined as never);
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: [],
      injuries: [],
      focusBias: [],
      avoid: [],
      aiFeaturesEnabled: true,
    });
    mockUserRepository.observeUser.mockReturnValue(
      asMockObservable(userStream.observable)
    );
    mockUserRepository.updateAdaptiveTrainingPlan.mockResolvedValue(
      undefined as never
    );
    mockCoachSessionActionRepository.observeActionsForProgram.mockReturnValue(
      asMockObservable(coachSessionActionStream.observable)
    );
    mockCoachSessionActionRepository.recordSkipAction.mockImplementation(
      async (input) =>
        ({
          id: 'skip-record',
          actionKind: 'skip',
          createdAt: '2026-04-15T12:00:00.000Z',
          ...input,
        } as never)
    );
    mockPlannedEventRepository.observeUpcomingEventContext.mockReturnValue(
      asMockObservable(upcomingEventStream.observable)
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
      aiFeaturesEnabled: true,
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
      expect(
        result.current.coachProjection?.sessions[0]?.sourceBlockId
      ).toEqual(expect.any(String));
    });
    expect(
      mockPlannedEventRepository.observeUpcomingEventContext
    ).toHaveBeenCalledWith({
      startLocalDate: expect.any(String),
      daysAhead: 14,
    });
    expect(
      mockCoachSessionActionRepository.observeActionsForProgram
    ).toHaveBeenCalledWith('plan-ppl');
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
      aiFeaturesEnabled: true,
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

  it('builds projected-session requests from the projected duration, not available time', async () => {
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
      aiFeaturesEnabled: true,
      adaptiveTrainingPlan: plan,
    });

    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      userStream.emit({});
    });

    await waitFor(() => {
      expect(result.current.coachPlan?.nextSession?.id).toEqual(
        expect.any(String)
      );
    });

    await act(async () => {
      result.current.updateStagedValue('time', '75');
    });

    await waitFor(() => {
      const session = result.current.coachPlan?.nextSession;
      const request = session
        ? result.current.buildCoachProjectionGenerationRequest(session.id)
        : null;

      expect(session?.durationMinutes).toBe(50);
      expect(request?.timeMinutes).toBe(50);
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
      aiFeaturesEnabled: true,
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

  it('records a durable skip and updates a generated workout when present', async () => {
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
      aiFeaturesEnabled: true,
      adaptiveTrainingPlan: plan,
    });
    mockWorkoutRepository.findPlannedWorkoutByCoachProjectionId.mockResolvedValue(
      { id: 'generated-workout' } as Workout
    );

    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      userStream.emit({});
    });

    await waitFor(() => {
      expect(result.current.coachProjection?.sessions[0]?.id).toBeTruthy();
    });

    const projectedSession = result.current.coachProjection?.sessions[0];
    if (!projectedSession) {
      throw new Error('Expected projected session');
    }
    const projectionId = projectedSession.id;
    await act(async () => {
      await result.current.skipCoachProjectionSession(projectionId);
    });

    expect(mockWorkoutRepository.skipWorkoutById).toHaveBeenCalledWith(
      'generated-workout'
    );
    expect(
      mockCoachSessionActionRepository.recordSkipAction
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        programId: 'plan-ppl',
        sourceBlockId: projectedSession.sourceBlockId,
        sessionIdentityKey: projectedSession.sessionIdentityKey,
        projectionId,
        workoutId: 'generated-workout',
      })
    );
  });

  it('records pin and move actions as adaptive plan session preferences', async () => {
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
      aiFeaturesEnabled: true,
      adaptiveTrainingPlan: plan,
    });

    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      userStream.emit({});
    });

    await waitFor(() => {
      expect(result.current.coachProjection?.sessions[0]?.id).toBeTruthy();
    });

    const projectedSession = result.current.coachProjection?.sessions[0];
    if (!projectedSession) {
      throw new Error('Expected projected session');
    }
    const projectionId = projectedSession.id;
    await act(async () => {
      await result.current.pinCoachProjectionSession(projectionId);
      await result.current.moveCoachProjectionSession(
        projectionId,
        '2026-04-20'
      );
    });

    expect(
      mockUserRepository.updateAdaptiveTrainingPlan
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionPreferences: [
          expect.objectContaining({
            id: `pin:${projectedSession.cycleIndex}:${projectedSession.sessionIdentityKey}`,
            localDate: '2026-04-20',
            blockIds: [projectedSession.sourceBlockId],
            status: 'pinned',
          }),
        ],
      })
    );
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

  describe('coach plan (local-first)', () => {
    const loadActivePlan = async () => {
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
        aiFeaturesEnabled: true,
        adaptiveTrainingPlan: plan,
      });

      const view = renderHook(() => useHomeData());
      await act(async () => {
        userStream.emit({});
      });
      await waitFor(() => {
        expect(view.result.current.coachProjection?.planId).toBe('plan-ppl');
      });
      return view;
    };

    it('derives a UI-ready coach plan from local data without a backend snapshot', async () => {
      const originalFetch = global.fetch;
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as never;

      try {
        const { result } = await loadActivePlan();

        expect(result.current.coachPlan).not.toBeNull();
        expect(result.current.coachPlan?.nextSession).not.toBeNull();
        expect(
          result.current.coachPlan?.upcomingSessions.length
        ).toBeGreaterThan(0);
        // Local repositories/selectors only — no authoritative backend snapshot.
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(
          mockCoachSessionActionRepository.observeActionsForProgram
        ).toHaveBeenCalledWith('plan-ppl');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('keeps skipped sessions out of the Home coach preview', async () => {
      const { result } = await loadActivePlan();
      const sessionToSkip = result.current.coachProjection?.sessions.find(
        (session) => session.sourceBlockId
      );
      if (!sessionToSkip) {
        throw new Error('Expected a skippable projected session');
      }

      const skipAction: CoachSessionAction = {
        id: 'skip-action',
        actionKind: 'skip',
        programId: 'plan-ppl',
        programVersion: sessionToSkip.programVersion,
        strategy: sessionToSkip.strategy,
        cycleIndex: sessionToSkip.cycleIndex,
        sessionIdentityKey: sessionToSkip.sessionIdentityKey,
        projectionId: sessionToSkip.id,
        sourceBlockId: sessionToSkip.sourceBlockId,
        projectedLocalDate: sessionToSkip.localDate,
        actionLocalDate: result.current.planningDateLocal,
        createdAt: '2026-04-15T12:00:00.000Z',
      };

      await act(async () => {
        coachSessionActionStream.emit([skipAction]);
      });

      await waitFor(() => {
        expect(
          result.current.coachProjection?.sessions.some(
            (session) => session.status === 'skipped'
          )
        ).toBe(true);
      });
      expect(result.current.coachPlan?.nextSession?.status).not.toBe('skipped');
      expect(
        result.current.coachPlan?.upcomingSessions.every(
          (session) => session.status !== 'skipped'
        )
      ).toBe(true);
    });

    it('builds a generation request that carries the projected session coach intent', async () => {
      const { result } = await loadActivePlan();

      const session = result.current.coachProjection?.sessions.find(
        (entry) =>
          entry.sourceBlockId &&
          entry.localDate !== result.current.planningDateLocal
      );
      if (!session) {
        throw new Error('Expected a future generatable projected session');
      }

      const request = result.current.buildCoachProjectionGenerationRequest(
        session.id
      );
      expect(request?.adaptivePlanIntent?.projectionId).toBe(session.id);
      expect(request?.adaptivePlanIntent?.primaryBlock.blockId).toBe(
        session.sourceBlockId
      );
      expect(request?.planningDateLocal).toBe(session.localDate);
      expect(request?.adaptivePlanIntent?.planningDateLocal).toBe(
        session.localDate
      );
    });
  });
});
