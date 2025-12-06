import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';
import { createTodayPlanMock } from '@workout-agent/shared';
import { Alert } from 'react-native';

const mockReset = jest.fn();
const mockAddListener = jest.fn(() => jest.fn());

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const { createTodayPlanMock: planMockFactory } = jest.requireActual('@workout-agent/shared');
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

jest.mock('./db/repositories/WorkoutRepository', () => ({
  workoutRepository: {
    completeWorkoutById: jest.fn(),
  },
}));

describe('ActiveWorkoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset.mockClear();
    mockAddListener.mockReturnValue(jest.fn());
  });

  it('shows confirmation and resets navigation on cancel', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
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

