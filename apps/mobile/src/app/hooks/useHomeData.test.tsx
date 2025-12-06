import { renderHook, act, waitFor } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { createSessionSummaryMock, createTodayPlanMock } from '@workout-agent/shared';
import { useHomeData } from './useHomeData';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { userRepository } from '../db/repositories/UserRepository';
import type Workout from '../db/models/Workout';

jest.mock('../db/repositories/WorkoutRepository', () => {
  const observeTodayWorkout = jest.fn();
  const observeRecentSessions = jest.fn();
  const getTodayWorkout = jest.fn();
  const listRecentSessions = jest.fn();
  const mapWorkoutToPlan = jest.fn();
  const toSessionSummary = jest.fn();

  return {
    workoutRepository: {
      observeTodayWorkout,
      observeRecentSessions,
      getTodayWorkout,
      listRecentSessions,
      mapWorkoutToPlan,
      toSessionSummary,
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

const mockWorkoutRepository = workoutRepository as jest.Mocked<typeof workoutRepository>;
const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
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
  let planStream: ReturnType<typeof createObservableMock<Workout[]>>;
  let sessionStream: ReturnType<typeof createObservableMock<Workout[]>>;
  let mockPlan: ReturnType<typeof createTodayPlanMock>;
  let userStream: ReturnType<typeof createObservableMock<unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    planStream = createObservableMock<Workout[]>();
    sessionStream = createObservableMock<Workout[]>();
    userStream = createObservableMock<unknown>();
    mockPlan = createTodayPlanMock({ id: 'server-plan' });

    mockWorkoutRepository.observeTodayWorkout.mockReturnValue(planStream.observable as any);
    mockWorkoutRepository.observeRecentSessions.mockReturnValue(sessionStream.observable as any);
    mockWorkoutRepository.getTodayWorkout.mockResolvedValue(null);
    mockWorkoutRepository.mapWorkoutToPlan.mockResolvedValue(mockPlan);
    mockWorkoutRepository.toSessionSummary.mockImplementation((workout) =>
      createSessionSummaryMock({ id: workout.id, name: workout.name || 'Workout' }),
    );
    mockUserRepository.getOrCreateUser.mockResolvedValue(undefined as never);
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: [],
      injuries: [],
      focusBias: [],
      avoid: [],
    });
    mockUserRepository.observeUser.mockReturnValue(userStream.observable as any);
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
      planStream.emit([{ id: 'local-workout' } as unknown as Workout]);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(mockWorkoutRepository.mapWorkoutToPlan).toHaveBeenCalled();
    expect(result.current.plan).toEqual(mockPlan);
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

  it('supports manual refetch by querying the repository', async () => {
    mockWorkoutRepository.getTodayWorkout.mockResolvedValueOnce({ id: 'refetch' } as unknown as Workout);
    mockWorkoutRepository.mapWorkoutToPlan.mockResolvedValueOnce(
      createTodayPlanMock({ id: 'refetched-plan', focus: 'Refetched' }),
    );

    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockWorkoutRepository.getTodayWorkout).toHaveBeenCalled();
    expect(result.current.plan?.focus).toBe('Refetched');
  });

  it('tracks staged quick action values', async () => {
    const { result } = renderHook(() => useHomeData());

    await act(async () => {
      result.current.updateStagedValue('time', '45');
    });

    const timeAction = result.current.quickActions.find((action) => action.key === 'time');
    expect(timeAction?.stagedValue).toBe('45');

    await act(async () => {
      result.current.clearStagedValues();
    });

    const clearedAction = result.current.quickActions.find((action) => action.key === 'time');
    expect(clearedAction?.stagedValue).toBeNull();
  });

  it('reflects offline status emitted by NetInfo', async () => {
    let listener: ((state: { isConnected: boolean; isInternetReachable?: boolean }) => void) | null = null;
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
});
