import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import { useHomeData } from './hooks/useHomeData';
import { createTodayPlanMock, type QuickActionPreset } from '@workout-agent/shared';

jest.mock('./hooks/useHomeData', () => ({
  useHomeData: jest.fn(),
}));
jest.mock('./services/api', () => ({
  generateWorkout: jest.fn(),
  quickLogWorkout: jest.fn(),
}));
jest.mock('./storage/byokKey', () => ({
  getByokApiKey: jest.fn().mockResolvedValue(null),
  setByokApiKey: jest.fn(),
  removeByokApiKey: jest.fn(),
}));
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useFocusEffect: jest.fn((callback) => callback()),
  };
});
jest.mock('./db/repositories/WorkoutRepository', () => ({
  workoutRepository: {
    completeWorkoutById: jest.fn(),
    archiveWorkoutById: jest.fn(),
    deleteWorkoutById: jest.fn(),
    quickLogManualSession: jest.fn(),
  },
}));
jest.mock('./db/repositories/UserRepository', () => ({
  userRepository: {
    hasConfiguredProfile: jest.fn().mockResolvedValue(false),
  },
}));
jest.mock('react-native-root-toast', () => ({
  show: jest.fn(),
  durations: { SHORT: 2000, LONG: 3500 },
  positions: { BOTTOM: -20 },
}));

const mockUseHomeData = useHomeData as jest.MockedFunction<typeof useHomeData>;

const createBaseQuickActions = (): QuickActionPreset[] => [
  { key: 'time', label: 'Time', value: '30', description: '30 min', stagedValue: null },
  { key: 'focus', label: 'Focus', value: 'Upper', description: 'Upper', stagedValue: null },
  { key: 'equipment', label: 'Equipment', value: 'Bodyweight', description: 'Bodyweight', stagedValue: null },
  { key: 'energy', label: 'Energy', value: 'Moderate', description: 'Moderate', stagedValue: null },
];

const baseHookState = {
  status: 'ready' as const,
  plan: createTodayPlanMock(),
  recentSessions: [],
  quickActions: createBaseQuickActions(),
  offlineHint: { offline: false, requiresApiKey: false },
  isOffline: false,
  error: null,
  generationStatus: {
    state: 'idle' as const,
    submittedAt: null,
  },
  refetch: jest.fn(),
  updateStagedValue: jest.fn(),
  clearStagedValues: jest.fn(),
  setGenerationStatus: jest.fn(),
};

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows pending overlay when generationStatus is pending', async () => {
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      generationStatus: {
        state: 'pending',
        submittedAt: new Date().toISOString(),
        etaSeconds: 18,
      },
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      // Flush microtasks triggered by effects (e.g., profile/BYOK checks)
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(getByText(/Crafting your workout/i)).toBeTruthy();
  });

  it('renders staged quick action value and reset control', async () => {
    const quickActions = createBaseQuickActions();
    quickActions[0] = { ...quickActions[0], stagedValue: '45' };

    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      quickActions,
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('45')).toBeTruthy();
    expect(getByText('Reset')).toBeTruthy();
  });

  it('opens Quick Log sheet when Quick log button is pressed', async () => {
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    // Quick Log sheet should not be visible initially
    expect(queryByText(/Tap a category and save/)).toBeNull();

    // Tap the Quick log button in the bottom bar
    const quickLogButton = getByText('Quick log');
    await act(async () => {
      fireEvent.press(quickLogButton);
    });

    // Quick Log sheet should now be visible
    expect(getByText(/Tap a category and save/)).toBeTruthy();
  });

  it('does not show Backfill chip in quick actions rail', async () => {
    mockUseHomeData.mockReturnValue(baseHookState);

    const { queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    // Backfill chip should not be rendered (removed in favor of Quick Log sheet)
    expect(queryByText('Backfill')).toBeNull();
  });

  it('navigates to ActiveWorkout when Start workout is pressed', async () => {
    const plan = createTodayPlanMock({ id: 'plan-123' });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    const startButton = getByText('Start workout');
    await act(async () => {
      fireEvent.press(startButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('ActiveWorkout', { plan });
  });
});
