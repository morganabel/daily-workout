import * as React from 'react';
import { render } from '@testing-library/react-native';
import { useHomeData } from './hooks/useHomeData';
import { createTodayPlanMock, type QuickActionPreset } from '@workout-agent/shared';
import App from './App';

jest.mock('./hooks/useHomeData', () => ({
  useHomeData: jest.fn(),
}));
jest.mock('./db/repositories/WorkoutRepository', () => ({
  workoutRepository: {
    completeWorkoutById: jest.fn(),
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

const mockUseHomeData = useHomeData as jest.MockedFunction<typeof useHomeData>;

const createBaseQuickActions = (): QuickActionPreset[] => [
  { key: 'time', label: 'Time', value: '30', description: '30 min', stagedValue: null },
  { key: 'focus', label: 'Focus', value: 'Upper', description: 'Upper', stagedValue: null },
  { key: 'equipment', label: 'Equipment', value: 'Bodyweight', description: 'Bodyweight', stagedValue: null },
  { key: 'energy', label: 'Energy', value: 'Moderate', description: 'Moderate', stagedValue: null },
  { key: 'backfill', label: 'Backfill', value: 'Today', description: 'Log past session', stagedValue: null },
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
};

describe('App', () => {
  beforeEach(() => {
    mockUseHomeData.mockReturnValue(baseHookState);
  });

  it('renders the home screen shell and hero card', async () => {
    const { getByText, findByText } = render(<App />);

    expect(getByText(/Your workout hub/i)).toBeTruthy();
    expect(getByText(/Quick actions/i)).toBeTruthy();
    expect(getByText(/Workout Agent/i)).toBeTruthy();
    expect(getByText(/Quick log/i)).toBeTruthy();
    await findByText(/Today’s workout/i);
  });
});
