import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';
import { createWorkoutExerciseLogFixture } from '@leveza/shared/testing';
import { Alert } from 'react-native';

const mockReset = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());
const mockWorkout = { id: 'workout-123' };
const mockExerciseLogs = [
  createWorkoutExerciseLogFixture({ id: 'exercise-1', order: 0 }),
];
const mockWorkoutRepository = {
  completeWorkoutById: jest.fn(),
  getWorkoutByPlanId: jest.fn().mockResolvedValue(mockWorkout),
  ensureSetsForWorkout: jest.fn().mockResolvedValue(undefined),
  listExerciseLogsByWorkoutId: jest.fn().mockResolvedValue(mockExerciseLogs),
  getLastExercisePerformance: jest.fn().mockResolvedValue(null),
  updateSetById: jest.fn().mockResolvedValue(mockExerciseLogs[0].sets[0]),
  addSetForExercise: jest.fn().mockResolvedValue(mockExerciseLogs[0].sets[0]),
  removeSetById: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const { createTodayPlanFixture: planMockFactory } = jest.requireActual(
    '@leveza/shared/testing'
  );
  return {
    ...actual,
    useNavigation: () => ({
      reset: mockReset,
      addListener: mockAddListener,
    }),
    useRoute: () => ({
      params: { plan: planMockFactory({ id: 'plan-123' }) },
    }),
  };
});

jest.mock('./db/activeDatabase', () => ({
  getActiveRepositories: () => ({ workout: mockWorkoutRepository }),
}));

describe('ActiveWorkoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset.mockClear();
    mockAddListener.mockReturnValue(jest.fn());
  });

  it('shows confirmation and resets navigation on cancel', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((title, message, buttons) => {
        // Simulate pressing the destructive button
        buttons?.[1]?.onPress?.();
        return undefined as any;
      });

    const { getByText } = render(<ActiveWorkoutScreen />);

    await act(async () => {
      fireEvent.press(getByText('Cancel'));
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Home' }],
    });

    alertSpy.mockRestore();
  });
});
