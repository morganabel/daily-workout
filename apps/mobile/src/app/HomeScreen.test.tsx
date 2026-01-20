import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import { useHomeData } from './hooks/useHomeData';
import {
  createTodayPlanMock,
  type QuickActionPreset,
} from '@workout-agent/shared';

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
    useRoute: () => ({ name: 'Home' }),
  };
});
jest.mock('./db/repositories/WorkoutRepository', () => ({
  workoutRepository: {
    completeWorkoutById: jest.fn(),
    archiveWorkoutById: jest.fn(),
    deleteWorkoutById: jest.fn(),
    quickLogManualSession: jest.fn(),
    discardPlannedWorkout: jest.fn(),
  },
}));
jest.mock('./db/repositories/UserRepository', () => ({
  userRepository: {
    hasConfiguredProfile: jest.fn().mockResolvedValue(false),
  },
}));
// Mock vector icons locally to ensure it takes precedence
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockUseHomeData = useHomeData as jest.MockedFunction<typeof useHomeData>;

const baseHookState = {
  status: 'ready' as const,
  plan: null, // Empty state by default for new tests
  recentSessions: [],
  quickActions: [],
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

  it('renders setup view when no plan exists', async () => {
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText(/Today's Setup/i)).toBeTruthy();
    expect(getByText('DURATION')).toBeTruthy();
    expect(getByText('EQUIPMENT')).toBeTruthy();
    expect(getByText("Generate today's workout")).toBeTruthy();
  });

  it('shows generating state when button is pressed', async () => {
    const { generateWorkout } = require('./services/api');
    // Delays resolution to allow checking loading state
    generateWorkout.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    const generateBtn = getByText("Generate today's workout");
    // Don't await the press fully, just trigger it
    fireEvent.press(generateBtn);

    // Should be loading now
    expect(getByText('Generating...')).toBeTruthy();

    // Fast-forward time to complete the action
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  });

  it('renders active plan view when plan exists', async () => {
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan: createTodayPlanMock(),
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('READY TO GO')).toBeTruthy();
    expect(getByText('Start Workout')).toBeTruthy();
  });

  it('navigates to ActiveWorkout when Start Workout is pressed', async () => {
    const plan = createTodayPlanMock();
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    const startBtn = getByText('Start Workout');
    await act(async () => {
      fireEvent.press(startBtn);
    });

    expect(mockNavigate).toHaveBeenCalledWith('ActiveWorkout', { plan });
  });
});
