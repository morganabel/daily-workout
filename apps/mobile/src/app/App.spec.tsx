import * as React from 'react';
import { render } from '@testing-library/react-native';
import { useHomeData } from './hooks/useHomeData';
import type { QuickActionPreset } from '@workout-agent/shared';
import { createTodayPlanFixture } from '@workout-agent/shared/testing';
import App from './App';

jest.mock('./hooks/useHomeData', () => ({
  useHomeData: jest.fn(),
}));
jest.mock('./hooks/useBillingState', () => ({
  useBillingState: () => ({
    capabilities: {
      enabled: false,
      showUpgradeUi: false,
      purchaseMethod: 'none',
      allowByok: true,
    },
    entitlements: null,
    loading: false,
    refreshing: false,
    error: null,
    client: {
      type: 'noop',
      initialize: jest.fn(),
      getAvailablePackages: jest.fn().mockResolvedValue([]),
      presentPaywall: jest.fn().mockResolvedValue('not_presented'),
      restorePurchases: jest.fn().mockResolvedValue(null),
      getCustomerInfo: jest.fn().mockResolvedValue(null),
      presentCustomerCenter: jest.fn().mockResolvedValue(undefined),
    },
    clientReady: true,
    showUpgradeUi: false,
    refreshEntitlements: jest.fn().mockResolvedValue(null),
  }),
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
  createNavigationContainerRef: jest.fn(() => ({
    isReady: jest.fn(() => true),
    getCurrentRoute: jest.fn(() => ({ name: 'Home' })),
    navigate: jest.fn(),
  })),
}));
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const MockNavigator = ({ children }: { children: React.ReactNode }) =>
    children;
  const MockScreen = ({
    component: Component,
  }: {
    component: React.ComponentType<Record<string, never>>;
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
    hasCompletedOrSkippedOnboarding: jest.fn().mockResolvedValue(false),
  },
}));
jest.mock('./services/api', () => ({
  generateWorkout: jest.fn(),
}));
jest.mock('./hooks/useDeviceToken', () => ({
  useDeviceToken: jest.fn(),
}));
jest.mock('./debug/DebugMcpBridge', () => ({
  DebugMcpBridge: () => null,
}));
jest.mock('./debug/debugMcpConfig', () => ({
  isDebugMcpBridgeEnabled: jest.fn(() => false),
}));
jest.mock('./debug/debugState', () => ({
  setDebugCurrentRoute: jest.fn(),
  setDebugHomeUiState: jest.fn(),
  setDebugSelectedPlan: jest.fn(),
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
jest.mock('./PaywallScreen', () => ({
  PaywallScreen: () => null,
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

const basePlan = createTodayPlanFixture();

const baseHookState = {
  status: 'ready' as const,
  planningDateLocal: '2026-04-28',
  planningDateTimestamp: 1777334400000,
  plan: basePlan,
  activePlan: basePlan,
  planVersions: [],
  activePlanVersions: [basePlan],
  pendingPlanSnapshot: null,
  adaptivePlan: null,
  adaptiveRecommendation: null,
  coachProjection: null,
  coachPlan: null,
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
  selectWorkoutVersion: jest.fn(),
  selectWorkoutVersionPlan: jest.fn(),
  setOptimisticPlanForDate: jest.fn(),
  setPendingPlanSnapshot: jest.fn(),
  clearTransientPlanState: jest.fn(),
  refreshPlanningDate: jest.fn(),
  updateStagedValue: jest.fn(),
  clearStagedValues: jest.fn(),
  setGenerationStatus: jest.fn(),
  skipCoachProjectionSession: jest.fn(),
  pinCoachProjectionSession: jest.fn(),
  unpinCoachProjectionSession: jest.fn(),
  moveCoachProjectionSession: jest.fn(),
  buildCoachProjectionGenerationRequest: jest.fn(() => null),
};

describe('App', () => {
  beforeEach(() => {
    mockUseHomeData.mockReturnValue(baseHookState);
  });

  it('renders the home screen with active plan', async () => {
    const { findByText } = render(<App />);

    await findByText("Today's Workout");
    await findByText("TODAY'S WORKOUT");
    await findByText(/Start Workout/i);
  });
});
