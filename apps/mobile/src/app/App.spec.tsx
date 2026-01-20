import * as React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useHomeData } from './hooks/useHomeData';
import {
  createTodayPlanMock,
  type QuickActionPreset,
} from '@workout-agent/shared';
import App from './App';

jest.mock('./hooks/useHomeData', () => ({
  useHomeData: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useFocusEffect: jest.fn((callback) => {
    // Defer callback execution to allow component to mount
    setTimeout(() => callback(), 0);
  }),
  useRoute: () => ({
    params: {},
    key: 'test-route',
    name: 'Home',
  }),
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const MockNavigator = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  const MockScreen = ({
    component: Component,
  }: {
    component: React.ComponentType<any>;
  }) => (Component ? <Component /> : null);
  return {
    createNativeStackNavigator: jest.fn(() => ({
      Navigator: MockNavigator,
      Screen: MockScreen,
    })),
  };
});
jest.mock('./db/repositories/WorkoutRepository', () => ({
  workoutRepository: {
    completeWorkoutById: jest.fn(),
    archiveWorkoutById: jest.fn(),
    deleteWorkoutById: jest.fn(),
  },
}));
jest.mock('./db/repositories/UserRepository', () => ({
  userRepository: {
    hasConfiguredProfile: jest.fn().mockResolvedValue(false),
  },
}));
jest.mock('./services/api', () => ({
  generateWorkout: jest.fn(),
}));
jest.mock('./SettingsScreen', () => ({
  SettingsScreen: () => null,
}));
jest.mock('./HistoryScreen', () => ({
  HistoryScreen: () => null,
}));
jest.mock('./WorkoutSessionDetailScreen', () => ({
  WorkoutSessionDetailScreen: () => null,
}));
jest.mock('./WorkoutPreviewScreen', () => ({
  WorkoutPreviewScreen: () => null,
}));
jest.mock('./ActiveWorkoutScreen', () => ({
  ActiveWorkoutScreen: () => null,
}));
jest.mock('./LaunchScreen', () => ({
  LaunchScreen: () => null,
}));
jest.mock('./SignInScreen', () => ({
  SignInScreen: () => null,
}));
jest.mock('./SignUpScreen', () => ({
  SignUpScreen: () => null,
}));

// Mock vector icons locally to ensure it takes precedence
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockUseHomeData = useHomeData as jest.MockedFunction<typeof useHomeData>;

const createBaseQuickActions = (): QuickActionPreset[] => [
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
    value: 'Upper',
    description: 'Upper',
    stagedValue: null,
  },
  {
    key: 'equipment',
    label: 'Equipment',
    value: 'Bodyweight',
    description: 'Bodyweight',
    stagedValue: null,
  },
  {
    key: 'energy',
    label: 'Energy',
    value: 'Moderate',
    description: 'Moderate',
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

describe('App', () => {
  beforeEach(() => {
    mockUseHomeData.mockReturnValue(baseHookState);
  });

  it('renders the home screen with active plan', async () => {
    const { findByText } = render(<App />);

    await findByText(/Today's Setup/i);
    await findByText(/READY TO GO/i);
    // The mock plan focus might vary but let's check for standard text
    await findByText(/Start Workout/i);
  });
});
