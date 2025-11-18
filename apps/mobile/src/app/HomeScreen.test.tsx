import React from 'react';
import { render, act } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import { useHomeData } from './hooks/useHomeData';
import { createTodayPlanMock, type QuickActionPreset } from '@workout-agent/shared';

jest.mock('./hooks/useHomeData');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
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
  setPlan: jest.fn(),
  addSession: jest.fn(),
  updateStagedValue: jest.fn(),
  clearStagedValues: jest.fn(),
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

    expect(getByText('45')).toBeTruthy();
    expect(getByText('Reset')).toBeTruthy();
  });
});
