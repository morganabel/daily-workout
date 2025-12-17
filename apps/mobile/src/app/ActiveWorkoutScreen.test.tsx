import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';

const plan = {
  id: 'plan-123',
  focus: 'Upper Body',
  durationMinutes: 30,
  blocks: [
    {
      id: 'block-1',
      title: 'Block 1',
      focus: 'Push',
      durationMinutes: 30,
      exercises: [
        {
          id: 'ex-1',
          name: 'Bench Press',
          prescription: '3 x 8',
        },
      ],
    },
  ],
};

const mockReset = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());

const mockReplaceSetsForExercise = jest.fn();
const mockCompleteWorkoutById = jest.fn();
const mockStartWorkoutTimer = jest.fn();
const mockFindLastCompletedExerciseByName = jest.fn();
const mockMarkSyncPending = jest.fn();
const mockLogWorkout = jest.fn();
const mockGetPreferences = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      reset: mockReset,
      addListener: mockAddListener,
    }),
    useRoute: () => ({
      params: { plan },
    }),
  };
});

jest.mock('./db/repositories/WorkoutRepository', () => ({
  workoutRepository: {
    getWorkoutDetail: jest.fn().mockResolvedValue(undefined),
    startWorkoutTimer: (...args: any[]) => mockStartWorkoutTimer(...args),
    replaceSetsForExercise: (...args: any[]) => mockReplaceSetsForExercise(...args),
    findLastCompletedExerciseByName: (...args: any[]) => mockFindLastCompletedExerciseByName(...args),
    completeWorkoutById: (...args: any[]) => mockCompleteWorkoutById(...args),
    markSyncPending: (...args: any[]) => mockMarkSyncPending(...args),
  },
}));

jest.mock('./db/repositories/UserRepository', () => ({
  userRepository: {
    getPreferences: (...args: any[]) => mockGetPreferences(...args),
  },
}));

jest.mock('./services/api', () => ({
  logWorkout: (...args: any[]) => mockLogWorkout(...args),
}));

describe('ActiveWorkoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddListener.mockReturnValue(jest.fn());
    mockGetPreferences.mockResolvedValue({ preferredWeightUnit: 'kg' });
    mockFindLastCompletedExerciseByName.mockResolvedValue(null);
    mockStartWorkoutTimer.mockResolvedValue(undefined);
    mockReplaceSetsForExercise.mockResolvedValue(undefined);
    mockCompleteWorkoutById.mockResolvedValue(undefined);
    mockMarkSyncPending.mockResolvedValue(undefined);
    mockLogWorkout.mockResolvedValue({ recentSessions: [], loggedSession: { id: 'logged-1' } });
  });

  it('persists set edits when reps change', async () => {
    const { getAllByPlaceholderText, queryByText } = render(<ActiveWorkoutScreen />);

    // Wait for loading to finish and the screen to render content
    await waitFor(() => expect(queryByText('Complete Workout')).toBeTruthy());

    const repsInput = getAllByPlaceholderText('0')[0];

    act(() => {
      fireEvent.changeText(repsInput, '8');
    });

    await waitFor(() => {
      expect(mockReplaceSetsForExercise).toHaveBeenCalledWith('ex-1', [
        {
          order: 0,
          reps: 8,
          weight: undefined,
          weightUnit: undefined,
          rpe: undefined,
          completed: false,
        },
      ]);
    });
  });

  it('finishes workout and calls logWorkout', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      // Simulate pressing "Finish"
      buttons?.[1]?.onPress?.();
      return undefined as any;
    });

    const { getAllByPlaceholderText, getByText, queryByText } = render(<ActiveWorkoutScreen />);

    await waitFor(() => expect(queryByText('Complete Workout')).toBeTruthy());

    // Fill minimal data to build payload
    fireEvent.changeText(getAllByPlaceholderText('0')[0], '5');

    await act(async () => {
      fireEvent.press(getByText('Complete Workout'));
    });

    await waitFor(() => expect(mockCompleteWorkoutById).toHaveBeenCalled());
    expect(mockLogWorkout).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });
});

