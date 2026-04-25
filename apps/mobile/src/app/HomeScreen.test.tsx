import React from 'react';
import { Alert } from 'react-native';
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
  planVersions: [],
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
  selectWorkoutVersion: jest.fn(),
  updateStagedValue: jest.fn(),
  clearStagedValues: jest.fn(),
  setGenerationStatus: jest.fn(),
};

const createQuickActions = (
  equipmentValue: string,
  stagedValue: string | null = null
): QuickActionPreset[] => [
  {
    key: 'equipment',
    label: 'Equipment',
    value: equipmentValue,
    description: equipmentValue,
    stagedValue,
  },
];

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
    expect(getByText('FOCUS')).toBeTruthy();
    expect(getByText('Auto')).toBeTruthy();
    expect(getByText(/\d+ min/)).toBeTruthy();
    expect(getByText('Bodyweight')).toBeTruthy();
    expect(getByText("Generate today's workout")).toBeTruthy();
  });

  it('shows profile equipment from quick actions in setup', async () => {
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      quickActions: createQuickActions('Dumbbells, Bench'),
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('Dumbbells, Bench')).toBeTruthy();
  });

  it('does not send profile equipment as a request override on default generation', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanMock());
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      quickActions: createQuickActions('Dumbbells, Bench'),
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.not.objectContaining({ equipment: expect.anything() })
    );
  });

  it('does not send equipment when staged equipment matches profile equipment', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanMock());
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      quickActions: createQuickActions('Dumbbells, Bench', 'Dumbbells, Bench'),
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.not.objectContaining({ equipment: expect.anything() })
    );
  });

  it('keeps profile equipment as fallback after duration-only customization', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanMock());
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      quickActions: createQuickActions('Dumbbells, Bench'),
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Dumbbells, Bench'));
    fireEvent.press(getByText('45'));
    await act(async () => {
      fireEvent.press(getByText('Generate workout'));
    });
    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ timeMinutes: 45 })
    );
    expect(generateWorkout).toHaveBeenCalledWith(
      expect.not.objectContaining({ equipment: expect.anything() })
    );
  });

  it('sends equipment when the setup selection is explicitly customized', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanMock());
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Bodyweight'));
    fireEvent.press(getByText('Cable Machine'));
    await act(async () => {
      fireEvent.press(getByText('Generate workout'));
    });
    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        equipment: ['Bodyweight', 'Cable Machine'],
      })
    );
  });

  it('sends Gym as a compact preset when explicitly selected', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanMock());
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Bodyweight'));
    fireEvent.press(getByText('Gym'));
    await act(async () => {
      fireEvent.press(getByText('Generate workout'));
    });
    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ equipment: ['Gym'] })
    );
  });

  it('keeps Gym mutually exclusive with individual equipment selections', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanMock());
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Bodyweight'));
    fireEvent.press(getByText('Gym'));
    fireEvent.press(getByText('Cable Machine'));
    await act(async () => {
      fireEvent.press(getByText('Generate workout'));
    });
    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ equipment: ['Cable Machine'] })
    );
    expect(generateWorkout).not.toHaveBeenCalledWith(
      expect.objectContaining({ equipment: expect.arrayContaining(['Gym']) })
    );
  });

  it('normalizes mixed Gym equipment from an existing plan during regeneration', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanMock());
    const plan = createTodayPlanMock({
      equipment: ['Gym', 'Dumbbells'],
      responseId: 'resp-mixed-gym',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-mixed-gym',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Customize'));
    await act(async () => {
      fireEvent.press(getByText('Regenerate workout'));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ equipment: ['Gym'] })
    );
  });

  it('shows the shared planner equipment options in customize', async () => {
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Bodyweight'));

    expect(getByText('Gym')).toBeTruthy();
    expect(getByText('Cable Machine')).toBeTruthy();
    expect(getByText('Squat Rack')).toBeTruthy();
    expect(getByText('Rowing Machine')).toBeTruthy();
  });

  it('shows generating state when button is pressed', async () => {
    const { generateWorkout } = require('./services/api');
    // Delays resolution to allow checking loading state
    generateWorkout.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

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

  it('keeps active plan card visible while status is loading', async () => {
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      status: 'loading',
      plan: createTodayPlanMock(),
    });

    const { getByText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('READY TO GO')).toBeTruthy();
    expect(queryByText("Generate today's workout")).toBeNull();
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

  it('shows updating indicator on home while regeneration is in progress', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 200))
    );

    const plan = createTodayPlanMock({
      responseId: 'resp-regen',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-regen',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
    });

    const { getByText, getByLabelText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Customize'));
    fireEvent.press(getByText('Regenerate workout'));

    expect(getByText('Updating your workout…')).toBeTruthy();
    expect(getByLabelText('Updating workout')).toBeTruthy();
    expect(getByText('Updating…')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
  });

  it('keeps rendering prior plan while regeneration is pending and observed plan is temporarily null', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 300))
    );

    const seededPlan = createTodayPlanMock({
      responseId: 'resp-transient',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-transient',
      },
    });

    let currentPlan: ReturnType<typeof createTodayPlanMock> | null = seededPlan;
    mockUseHomeData.mockImplementation(() => ({
      ...baseHookState,
      plan: currentPlan,
    }));

    const { getByText, queryByText, rerender } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Customize'));
    fireEvent.press(getByText('Regenerate workout'));

    // Simulate DB observer transiently emitting no planned workout.
    currentPlan = null;
    rerender(<HomeScreen />);

    expect(getByText('READY TO GO')).toBeTruthy();
    expect(queryByText("Generate today's workout")).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
  });

  it('disables Start and Preview while regeneration is pending', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 500))
    );

    const plan = createTodayPlanMock({
      responseId: 'resp-regen-2',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-regen-2',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
    });

    const { getByText, getByLabelText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Customize'));
    fireEvent.press(getByText('Regenerate workout'));

    const start = getByLabelText('Start Workout');
    const preview = getByLabelText('Preview');
    expect(start.props.accessibilityState?.disabled).toBe(true);
    expect(preview.props.accessibilityState?.disabled).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  });

  it('clears updating state after regeneration completes', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 100))
    );

    const plan = createTodayPlanMock({
      responseId: 'resp-done',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-done',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
    });

    const { getByText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Customize'));
    fireEvent.press(getByText('Regenerate workout'));
    expect(queryByText('Updating your workout…')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(queryByText('Updating your workout…')).toBeNull();
    expect(getByText('Customize')).toBeTruthy();
  });

  it('shows the returned regenerated plan before hook data catches up', async () => {
    const { generateWorkout } = require('./services/api');
    const oldPlan = createTodayPlanMock({
      id: 'old-plan',
      summary: 'Old workout summary',
      responseId: 'resp-old',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-old',
      },
    });
    const newPlan = createTodayPlanMock({
      id: 'new-plan',
      focus: 'Strength',
      durationMinutes: 60,
      equipment: ['Gym'],
      summary: 'New gym strength summary',
      responseId: 'resp-new',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-new',
      },
    });
    generateWorkout.mockResolvedValue(newPlan);

    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan: oldPlan,
      refetch: jest.fn().mockResolvedValue(undefined),
    });

    const { getByText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('Old workout summary')).toBeTruthy();

    fireEvent.press(getByText('Customize'));
    await act(async () => {
      fireEvent.press(getByText('Regenerate workout'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('New gym strength summary')).toBeTruthy();
    expect(queryByText('Old workout summary')).toBeNull();
  });

  it('uses the optimistic regenerated plan as the next regeneration baseline', async () => {
    const { generateWorkout } = require('./services/api');
    const oldPlan = createTodayPlanMock({
      id: 'old-plan',
      responseId: 'resp-old',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-old',
      },
    });
    const newPlan = createTodayPlanMock({
      id: 'new-plan',
      focus: 'Strength',
      responseId: 'resp-new',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-new',
      },
    });
    generateWorkout.mockResolvedValueOnce(newPlan).mockResolvedValueOnce(
      createTodayPlanMock({ id: 'newer-plan' })
    );

    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan: oldPlan,
      refetch: jest.fn().mockResolvedValue(undefined),
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Customize'));
    await act(async () => {
      fireEvent.press(getByText('Regenerate workout'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Customize'));
    await act(async () => {
      fireEvent.press(getByText('Regenerate workout'));
    });

    expect(generateWorkout).toHaveBeenLastCalledWith(
      expect.objectContaining({
        previousResponseId: 'resp-new',
        baselineWorkout: expect.objectContaining({ id: 'new-plan' }),
      })
    );
  });

  it('selects saved workout versions from the active card', async () => {
    const selectedPlan = createTodayPlanMock({
      id: 'version-2',
      summary: 'Selected version',
    });
    const olderPlan = createTodayPlanMock({
      id: 'version-1',
      summary: 'Older version',
    });
    const selectWorkoutVersion = jest.fn().mockResolvedValue(undefined);
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan: selectedPlan,
      planVersions: [olderPlan, selectedPlan],
      selectWorkoutVersion,
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('Workout options')).toBeTruthy();
    fireEvent.press(getByText('1'));

    expect(selectWorkoutVersion).toHaveBeenCalledWith('version-1');
  });

  it('calls setGenerationStatus with error when regeneration fails', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockRejectedValue({ message: 'Regen failed' });

    const setGenerationStatus = jest.fn();
    const plan = createTodayPlanMock({
      responseId: 'resp-err',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-err',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
      setGenerationStatus,
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Customize'));
    await act(async () => {
      fireEvent.press(getByText('Regenerate workout'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(setGenerationStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'error',
        message: 'Regen failed',
      })
    );
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows inline error banner when generation status is error', async () => {
    const plan = createTodayPlanMock({
      responseId: 'resp-ui',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-ui',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
      generationStatus: {
        state: 'error',
        submittedAt: new Date().toISOString(),
        message: 'Could not update workout',
      },
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('Could not update workout')).toBeTruthy();
  });
});
