import React from 'react';
import { Alert } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import { useHomeData } from './hooks/useHomeData';
import { userRepository } from './db/repositories/UserRepository';
import {
  createAdaptiveTrainingPlanFromTemplate,
  type AdaptivePlanRecommendation,
  type CoachProjectedSession,
  type GenerationRequest,
  type QuickActionPreset,
  type TodayPlan,
} from '@workout-agent/shared';
import type { HomeCoachPlanView } from './hooks/useHomeData';
import { createTodayPlanFixture } from '@workout-agent/shared/testing';

jest.mock('./hooks/useHomeData', () => ({
  useHomeData: jest.fn(),
}));
const mockUseBillingState = jest.fn();
jest.mock('./hooks/useBillingState', () => ({
  useBillingState: () => mockUseBillingState(),
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
    hasCompletedOrSkippedOnboarding: jest.fn().mockResolvedValue(false),
  },
}));
// Mock vector icons locally to ensure it takes precedence
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const mockUseHomeData = useHomeData as jest.MockedFunction<typeof useHomeData>;
const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;

const baseHookState = {
  status: 'ready' as const,
  plan: null, // Empty state by default for new tests
  activePlan: null,
  planVersions: [],
  activePlanVersions: [],
  pendingPlanSnapshot: null,
  adaptivePlan: null,
  adaptiveRecommendation: null,
  coachProjection: null,
  coachPlan: null,
  planningDateLocal: '2026-04-27',
  planningDateTimestamp: new Date('2026-04-27T00:00:00').getTime(),
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
  selectWorkoutVersionPlan: jest.fn(),
  setOptimisticPlanForDate: jest.fn(),
  setPendingPlanSnapshot: jest.fn(),
  clearTransientPlanState: jest.fn(),
  refreshPlanningDate: jest.fn(() => false),
  updateStagedValue: jest.fn(),
  clearStagedValues: jest.fn(),
  setGenerationStatus: jest.fn(),
  skipCoachProjectionSession: jest.fn(),
  pinCoachProjectionSession: jest.fn(),
  unpinCoachProjectionSession: jest.fn(),
  moveCoachProjectionSession: jest.fn(),
  buildCoachProjectionGenerationRequest: jest.fn(() => null),
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

const createSetupQuickActions = (overrides: {
  time?: string;
  focus?: string;
  equipment?: string;
  energy?: string;
}): QuickActionPreset[] => [
  {
    key: 'time',
    label: 'Time',
    value: overrides.time ?? '60',
    description: `${overrides.time ?? '60'} min`,
    stagedValue: null,
  },
  {
    key: 'focus',
    label: 'Focus',
    value: overrides.focus ?? 'Upper Body',
    description: overrides.focus ?? 'Upper Body',
    stagedValue: null,
  },
  {
    key: 'equipment',
    label: 'Equipment',
    value: overrides.equipment ?? 'Dumbbells, Bench',
    description: overrides.equipment ?? 'Dumbbells, Bench',
    stagedValue: null,
  },
  {
    key: 'energy',
    label: 'Energy',
    value: overrides.energy ?? 'Intense',
    description: `${overrides.energy ?? 'Intense'} energy`,
    stagedValue: null,
  },
];

const createAdaptivePlanFixture = () => {
  const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
    id: 'plan-ppl',
    activeFrom: baseHookState.planningDateLocal,
    updatedAt: '2026-04-27T12:00:00.000Z',
  });
  if (!plan) {
    throw new Error('Expected adaptive plan');
  }
  const recommendation: AdaptivePlanRecommendation = {
    id: 'rec-pull-cardio',
    planId: plan.id,
    planningDateLocal: baseHookState.planningDateLocal,
    primaryBlockId: 'pull',
    addOnBlockIds: ['easy-cardio'],
    alternativeBlockIds: ['push', 'mobility'],
    targetProgress: [
      {
        targetId: 'cardio',
        label: 'Cardio',
        count: 1,
        minCount: 2,
        maxCount: 3,
        windowDays: 7,
      },
    ],
    rationale: [
      {
        code: 'target-gap',
        message: 'Cardio is due this week.',
      },
    ],
    coachNotes: [],
    projectionStatus: 'projected',
  };
  return { plan, recommendation };
};

const createRestRecommendationFixture = () => {
  const { plan } = createAdaptivePlanFixture();
  const recommendation: AdaptivePlanRecommendation = {
    id: 'rec-rest',
    planId: plan.id,
    planningDateLocal: baseHookState.planningDateLocal,
    primaryBlockId: 'rest',
    addOnBlockIds: [],
    alternativeBlockIds: ['mobility', 'push'],
    targetProgress: [],
    rationale: [
      {
        code: 'rest-fit',
        message:
          'Your main targets are covered. Recovery keeps the plan moving.',
      },
    ],
    coachNotes: [
      'Your main targets are covered. Recovery keeps the plan moving.',
    ],
    projectionStatus: 'projected',
  };
  return { plan, recommendation };
};

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockUseBillingState.mockReturnValue({
      showUpgradeUi: false,
    });
    mockUserRepository.hasCompletedOrSkippedOnboarding.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders setup view when no plan exists', async () => {
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText, getByLabelText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText(/Today's Setup/i)).toBeTruthy();
    expect(queryByText('FOCUS')).toBeNull();
    expect(getByLabelText('Edit 30 min')).toBeTruthy();
    expect(getByText('Auto')).toBeTruthy();
    expect(getByText(/\d+ min/)).toBeTruthy();
    expect(getByText('Bodyweight')).toBeTruthy();
    expect(getByText("Generate today's workout")).toBeTruthy();
  });

  it('does not show onboarding prompt for returning users who completed or skipped setup', async () => {
    mockUserRepository.hasCompletedOrSkippedOnboarding.mockResolvedValue(true);
    mockUseHomeData.mockReturnValue(baseHookState);

    const { queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(queryByText('Build your training plan')).toBeNull();
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
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
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
      expect.not.objectContaining({ equipment: expect.anything() }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
  });

  it('shows adaptive recommendation and sends adaptive intent for Auto generation', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    const { plan, recommendation } = createAdaptivePlanFixture();
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      adaptivePlan: plan,
      adaptiveRecommendation: recommendation,
      quickActions: createSetupQuickActions({ equipment: 'Gym' }),
    });

    const { getByText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('COACH RECOMMENDS')).toBeTruthy();
    expect(getByText("Today's Plan")).toBeTruthy();
    expect(getByText('Your next session is ready.')).toBeTruthy();
    expect(getByText('Pull + Easy Cardio')).toBeTruthy();
    expect(getByText('75 min')).toBeTruthy();
    expect(getByText('Gym')).toBeTruthy();
    expect(queryByText('Projected')).toBeNull();
    expect(queryByText('FOCUS')).toBeNull();
    expect(queryByText('Customize recommendation')).toBeNull();
    expect(getByText('Adjust details')).toBeTruthy();
    expect(getByText('Cardio is due this week.')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        focus: 'Pull',
        timeMinutes: 75,
        adaptivePlanIntent: expect.objectContaining({
          planId: 'plan-ppl',
          recommendationId: 'rec-pull-cardio',
          primaryBlock: expect.objectContaining({ blockId: 'pull' }),
          addOnBlocks: [expect.objectContaining({ blockId: 'easy-cardio' })],
        }),
      }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
    const request = generateWorkout.mock.calls[0][0];
    expect(
      request.adaptivePlanIntent.primaryBlock.targetDurationMinutes
    ).toBeUndefined();
    expect(
      request.adaptivePlanIntent.addOnBlocks[0].targetDurationMinutes
    ).toBeUndefined();
    expect(
      request.adaptivePlanIntent.exerciseSlotPolicy.slots.map(
        (slot: { id: string }) => slot.id
      )
    ).toEqual(['pull-main-pull', 'pull-accessory']);
    expect(
      request.adaptivePlanIntent.exerciseSlotPolicy.currentAssignments
    ).toEqual([]);
  });

  it('renders the upcoming coach plan and wires session actions', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    const { plan, recommendation } = createAdaptivePlanFixture();

    const createProjectedSession = (
      overrides: Partial<CoachProjectedSession>
    ): CoachProjectedSession => ({
      id: 'proj-1',
      planId: 'plan-ppl',
      programVersion: 1,
      cycleIndex: 0,
      strategy: 'weekly-target-balance',
      sessionIdentityKey: 'wtb:pull:1',
      localDate: '2026-04-29',
      sourceBlockId: 'pull',
      addOnBlockIds: [],
      targetIds: ['cardio'],
      status: 'projected',
      blockLabel: 'Pull',
      durationMinutes: 45,
      rationale: [],
      coachNotes: [],
      conflictWarningIds: [],
      availableActions: ['generate', 'skip', 'pin', 'move'],
      ...overrides,
    });

    const coachPlan: HomeCoachPlanView = {
      nextSession: createProjectedSession({ id: 'proj-today' }),
      nextActionRationale: 'Cardio is due this week.',
      upcomingSessions: [
        createProjectedSession({ id: 'proj-2', localDate: '2026-04-30' }),
        createProjectedSession({
          id: 'proj-3',
          localDate: '2026-05-02',
          blockLabel: 'Long Run',
          status: 'pinned',
          sessionIdentityKey: 'pin:0:long-run',
          availableActions: ['unpin', 'move'],
        }),
      ],
      repairNotes: [],
      conflictWarnings: [],
    };

    const skipCoachProjectionSession = jest.fn();
    const generationRequest: GenerationRequest = {
      timeMinutes: 45,
      energy: 'moderate',
      focus: 'Pull',
    };
    const buildCoachProjectionGenerationRequest = jest.fn(
      () => generationRequest
    );

    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      adaptivePlan: plan,
      adaptiveRecommendation: recommendation,
      coachPlan,
      quickActions: createSetupQuickActions({ equipment: 'Gym' }),
      skipCoachProjectionSession,
      buildCoachProjectionGenerationRequest,
    });

    const { getByText, getAllByText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    // Compact upcoming projection with distinct statuses, no strategy ids.
    expect(getByText('UPCOMING')).toBeTruthy();
    expect(getByText('Long Run')).toBeTruthy();
    expect(getByText('Pinned')).toBeTruthy();
    expect(queryByText(/weekly-target-balance/)).toBeNull();

    await act(async () => {
      fireEvent.press(getAllByText('Skip')[0]);
    });
    expect(skipCoachProjectionSession).toHaveBeenCalledWith('proj-2');

    await act(async () => {
      fireEvent.press(getAllByText('Generate')[0]);
    });
    expect(buildCoachProjectionGenerationRequest).toHaveBeenCalledWith(
      'proj-2',
      expect.objectContaining({ energy: expect.any(String) })
    );
    expect(generateWorkout).toHaveBeenCalledWith(
      generationRequest,
      expect.objectContaining({ scheduledDate: expect.any(Number) })
    );
  });

  it('opens coach customization with Auto selected instead of the recommendation label', async () => {
    const { plan, recommendation } = createAdaptivePlanFixture();
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      adaptivePlan: plan,
      adaptiveRecommendation: recommendation,
      quickActions: createSetupQuickActions({ equipment: 'Gym' }),
    });

    const { getByLabelText, getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Adjust details'));

    expect(getByLabelText('Auto').props.accessibilityState?.checked).toBe(true);
    expect(getByText('Pull + Easy Cardio')).toBeTruthy();
  });

  it('uses coach intent when a submitted sheet focus switches back to Auto', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    const { plan, recommendation } = createAdaptivePlanFixture();
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      adaptivePlan: plan,
      adaptiveRecommendation: recommendation,
      quickActions: createSetupQuickActions({ equipment: 'Gym' }),
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Adjust details'));
    fireEvent.press(getByText('Upper Body'));
    await act(async () => {
      fireEvent.press(getByText('Apply'));
    });

    fireEvent.press(getByText('Upper Body'));
    fireEvent.press(getByText('Auto'));
    await act(async () => {
      fireEvent.press(getByText('Apply & Generate'));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        focus: 'Pull',
        adaptivePlanIntent: expect.objectContaining({
          planId: 'plan-ppl',
          recommendationId: 'rec-pull-cardio',
        }),
      }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
  });

  it('does not generate from setup customize while offline', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    const setGenerationStatus = jest.fn();
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      isOffline: true,
      offlineHint: { offline: true, requiresApiKey: false },
      quickActions: createSetupQuickActions({}),
      setGenerationStatus,
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText(/60 min/));
    fireEvent.press(getByText('45'));
    await act(async () => {
      fireEvent.press(getByText('Apply & Generate'));
    });

    expect(generateWorkout).not.toHaveBeenCalled();
    expect(setGenerationStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'pending' })
    );
    expect(getByText('Apply & Generate')).toBeTruthy();
  });

  it('shows rest recommendations as recovery with an escape to choose a workout', async () => {
    const { plan, recommendation } = createRestRecommendationFixture();
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      adaptivePlan: plan,
      adaptiveRecommendation: recommendation,
      quickActions: createSetupQuickActions({ equipment: 'Gym' }),
    });

    const { getByText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('COACH RECOMMENDS')).toBeTruthy();
    expect(getByText("Today's Plan")).toBeTruthy();
    expect(getByText('Recovery is the plan today.')).toBeTruthy();
    expect(getByText('Take a rest day')).toBeTruthy();
    expect(
      getByText(
        'Your main targets are covered. Recovery keeps the plan moving.'
      )
    ).toBeTruthy();
    expect(getByText('Choose a workout instead')).toBeTruthy();
    expect(queryByText("Generate today's workout")).toBeNull();
    expect(getByText('Gym')).toBeTruthy();
    expect(getByText('Intense')).toBeTruthy();
  });

  it('preserves customized duration for one-off Auto generation', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      quickActions: createSetupQuickActions({}),
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText(/60 min/));
    fireEvent.press(getByText('45'));
    await act(async () => {
      fireEvent.press(getByText('Apply & Generate'));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        focus: 'Smart',
        timeMinutes: 45,
      }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
  });

  it('treats manual focus selection as an explicit override', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Auto'));
    fireEvent.press(getByText('Upper Body'));
    await act(async () => {
      fireEvent.press(getByText('Apply & Generate'));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        focus: 'Upper Body',
      }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
    expect(generateWorkout).toHaveBeenCalledWith(
      expect.not.objectContaining({ adaptivePlanIntent: expect.anything() }),
      expect.anything()
    );
  });

  it('does not send equipment when staged equipment matches profile equipment', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
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
      expect.not.objectContaining({ equipment: expect.anything() }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
  });

  it('opens setup customize with the same values shown on the setup card', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      quickActions: createSetupQuickActions({
        time: '60',
        focus: 'Upper Body',
        equipment: 'Dumbbells, Bench',
        energy: 'Intense',
      }),
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('60 min')).toBeTruthy();
    expect(getByText('Intense')).toBeTruthy();

    fireEvent.press(getByText('Dumbbells, Bench'));
    await act(async () => {
      fireEvent.press(getByText('Apply & Generate'));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        timeMinutes: 60,
        focus: 'Smart',
        energy: 'intense',
      }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
  });

  it('keeps profile equipment as fallback after duration-only customization', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
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
      fireEvent.press(getByText('Apply & Generate'));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ timeMinutes: 45 }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
    expect(generateWorkout).toHaveBeenCalledWith(
      expect.not.objectContaining({ equipment: expect.anything() }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
  });

  it('sends equipment when the setup selection is explicitly customized', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Bodyweight'));
    fireEvent.press(getByText('Cable Machine'));
    await act(async () => {
      fireEvent.press(getByText('Apply & Generate'));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        equipment: ['Bodyweight', 'Cable Machine'],
      }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
  });

  it('sends Gym as a compact preset when explicitly selected', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Bodyweight'));
    fireEvent.press(getByText('Gym'));
    await act(async () => {
      fireEvent.press(getByText('Apply & Generate'));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ equipment: ['Gym'] }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
  });

  it('keeps Gym mutually exclusive with individual equipment selections', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Bodyweight'));
    fireEvent.press(getByText('Gym'));
    fireEvent.press(getByText('Cable Machine'));
    await act(async () => {
      fireEvent.press(getByText('Apply & Generate'));
    });

    expect(generateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ equipment: ['Cable Machine'] }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
    expect(generateWorkout).not.toHaveBeenCalledWith(
      expect.objectContaining({ equipment: expect.arrayContaining(['Gym']) }),
      expect.anything()
    );
  });

  it('normalizes mixed Gym equipment from an existing plan during regeneration', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockResolvedValue(createTodayPlanFixture());
    const plan = createTodayPlanFixture({
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
      activePlan: plan,
      planVersions: [plan],
      activePlanVersions: [plan],
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
      expect.objectContaining({ equipment: ['Gym'] }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
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

  it('routes quota errors to Paywall when server upgrade metadata is present', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockRejectedValue({
      code: 'QUOTA_EXCEEDED',
      message: 'Included quota exceeded',
      upgrade: {
        showUpgradeUi: true,
        purchaseMethod: 'iap',
      },
    });

    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
      await Promise.resolve();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Paywall', { source: 'quota' });
  });

  it('routes BYOK_REQUIRED errors to BYOK setup instead of Paywall', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockRejectedValue({
      code: 'BYOK_REQUIRED',
      message: 'API key required',
    });
    const alertSpy = jest.spyOn(Alert, 'alert');

    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
      await Promise.resolve();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith('Paywall', {
      source: 'quota',
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'AI key required',
      'API key required',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Add key' }),
        expect.objectContaining({ text: 'Not now' }),
      ])
    );
  });

  it('shows catalog no-match errors without opening BYOK or Paywall', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockRejectedValue({
      code: 'WORKOUT_CATALOG_NO_MATCH',
      message: 'No catalog workout matched this request',
    });
    const alertSpy = jest.spyOn(Alert, 'alert');

    mockUseHomeData.mockReturnValue(baseHookState);

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(getByText("Generate today's workout"));
      await Promise.resolve();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith('Paywall', {
      source: 'quota',
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('Launch', {
      openByok: true,
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'No catalog workout',
      'No catalog workout matched this request'
    );
  });

  it('renders active plan view when plan exists', async () => {
    const plan = createTodayPlanFixture();
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
      activePlan: plan,
      planVersions: [plan],
      activePlanVersions: [plan],
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText("TODAY'S WORKOUT")).toBeTruthy();
    expect(getByText('Start Workout')).toBeTruthy();
  });

  it('keeps active plan card visible while status is loading', async () => {
    const plan = createTodayPlanFixture();
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      status: 'loading',
      plan,
      activePlan: plan,
      planVersions: [plan],
      activePlanVersions: [plan],
    });

    const { getByText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText("TODAY'S WORKOUT")).toBeTruthy();
    expect(queryByText("Generate today's workout")).toBeNull();
  });

  it('navigates to ActiveWorkout when Start Workout is pressed', async () => {
    const plan = createTodayPlanFixture();
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
      activePlan: plan,
      planVersions: [plan],
      activePlanVersions: [plan],
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

    const plan = createTodayPlanFixture({
      responseId: 'resp-regen',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-regen',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
      activePlan: plan,
      planVersions: [plan],
      activePlanVersions: [plan],
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

    const seededPlan = createTodayPlanFixture({
      responseId: 'resp-transient',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-transient',
      },
    });

    let currentPlan: ReturnType<typeof createTodayPlanFixture> | null =
      seededPlan;
    let currentPendingPlan: ReturnType<typeof createTodayPlanFixture> | null =
      null;
    mockUseHomeData.mockImplementation(() => ({
      ...baseHookState,
      plan: currentPlan,
      activePlan: currentPlan,
      pendingPlanSnapshot: currentPendingPlan,
      planVersions: currentPlan ? [currentPlan] : [],
      activePlanVersions: currentPlan ? [currentPlan] : [],
      setPendingPlanSnapshot: jest.fn((plan) => {
        currentPendingPlan = plan;
      }),
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

    expect(getByText("TODAY'S WORKOUT")).toBeTruthy();
    expect(queryByText("Generate today's workout")).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
  });

  it('disables Start and Customize while regeneration is pending', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 500))
    );

    const plan = createTodayPlanFixture({
      responseId: 'resp-regen-2',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-regen-2',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
      activePlan: plan,
      planVersions: [plan],
      activePlanVersions: [plan],
    });

    const { getByText, getByLabelText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Customize'));
    fireEvent.press(getByText('Regenerate workout'));

    const start = getByLabelText('Start Workout');
    const customize = getByLabelText('Updating…');
    expect(start.props.accessibilityState?.disabled).toBe(true);
    expect(customize.props.accessibilityState?.disabled).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  });

  it('clears updating state after regeneration completes', async () => {
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 100))
    );

    const plan = createTodayPlanFixture({
      responseId: 'resp-done',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-done',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
      activePlan: plan,
      planVersions: [plan],
      activePlanVersions: [plan],
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
    const oldPlan = createTodayPlanFixture({
      id: 'old-plan',
      summary: 'Old workout summary',
      responseId: 'resp-old',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-old',
      },
    });
    const newPlan = createTodayPlanFixture({
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
      activePlan: oldPlan,
      planVersions: [oldPlan],
      activePlanVersions: [oldPlan],
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

    expect(baseHookState.setOptimisticPlanForDate).toHaveBeenCalledWith(
      newPlan,
      baseHookState.planningDateLocal
    );
    expect(queryByText('Old workout summary')).toBeTruthy();
  });

  it('uses the optimistic regenerated plan as the next regeneration baseline', async () => {
    const { generateWorkout } = require('./services/api');
    const oldPlan = createTodayPlanFixture({
      id: 'old-plan',
      responseId: 'resp-old',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-old',
      },
    });
    const newPlan = createTodayPlanFixture({
      id: 'new-plan',
      focus: 'Strength',
      responseId: 'resp-new',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-new',
      },
    });
    generateWorkout
      .mockResolvedValueOnce(newPlan)
      .mockResolvedValueOnce(createTodayPlanFixture({ id: 'newer-plan' }));

    let currentPlan = oldPlan;
    const setOptimisticPlanForDate = jest.fn((plan) => {
      currentPlan = plan;
    });
    mockUseHomeData.mockImplementation(() => ({
      ...baseHookState,
      plan: currentPlan,
      activePlan: currentPlan,
      planVersions: [currentPlan],
      activePlanVersions: [currentPlan],
      setOptimisticPlanForDate,
      refetch: jest.fn().mockResolvedValue(undefined),
    }));

    const { getByText, rerender } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    rerender(<HomeScreen />);

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
      }),
      expect.objectContaining({
        scheduledDate: baseHookState.planningDateTimestamp,
      })
    );
  });

  it('selects saved workout versions from the active card', async () => {
    const selectedPlan = createTodayPlanFixture({
      id: 'version-2',
      focus: 'Selected focus',
      summary: 'Selected version',
    });
    const olderPlan = createTodayPlanFixture({
      id: 'version-1',
      focus: 'Original focus',
      summary: 'Older version',
    });
    const easierPlan = {
      ...createTodayPlanFixture({
        id: 'version-easy',
        focus: 'Easier focus',
        summary: 'Easier version',
      }),
      versionMetadata: { changeLabel: 'Easier' },
    };
    const selectWorkoutVersionPlan = jest.fn().mockResolvedValue(undefined);
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan: selectedPlan,
      activePlan: selectedPlan,
      planVersions: [olderPlan, easierPlan, selectedPlan],
      activePlanVersions: [olderPlan, easierPlan, selectedPlan],
      selectWorkoutVersionPlan,
    });

    const { getByText, queryByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('Selected focus')).toBeTruthy();
    expect(getByText('Latest version')).toBeTruthy();
    fireEvent.press(getByText('Versions'));
    expect(getByText('Workout versions')).toBeTruthy();
    fireEvent.press(getByText('Easier'));

    expect(selectWorkoutVersionPlan).toHaveBeenCalledWith(easierPlan);
    expect(queryByText('Selected focus')).toBeTruthy();
  });

  it('shows the active saved version position when it is not latest', async () => {
    const olderPlan = createTodayPlanFixture({
      id: 'version-1',
      focus: 'Original focus',
      summary: 'Older version',
    });
    const middlePlan = createTodayPlanFixture({
      id: 'version-2',
      focus: 'Middle focus',
      summary: 'Middle version',
    });
    const latestPlan = createTodayPlanFixture({
      id: 'version-3',
      focus: 'Latest focus',
      summary: 'Latest version',
    });

    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan: middlePlan,
      activePlan: middlePlan,
      planVersions: [olderPlan, middlePlan, latestPlan],
      activePlanVersions: [olderPlan, middlePlan, latestPlan],
    });

    const { getByText } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('Version 2/3')).toBeTruthy();
  });

  it('clears selected version override when the current plan disappears', async () => {
    const selectedPlan = createTodayPlanFixture({
      id: 'version-2',
      focus: 'Selected focus',
      summary: 'Selected version',
    });
    const olderPlan = createTodayPlanFixture({
      id: 'version-1',
      focus: 'Original focus',
      summary: 'Older version',
    });
    let hookState: ReturnType<typeof useHomeData>;
    const selectWorkoutVersionPlan = jest
      .fn()
      .mockImplementation(async (version: TodayPlan) => {
        hookState = {
          ...hookState,
          activePlan: version,
        };
      });
    hookState = {
      ...baseHookState,
      plan: selectedPlan,
      activePlan: selectedPlan,
      planVersions: [olderPlan, selectedPlan],
      activePlanVersions: [olderPlan, selectedPlan],
      selectWorkoutVersionPlan,
    };
    mockUseHomeData.mockImplementation(() => hookState);

    const { getByText, queryByText, rerender } = render(<HomeScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('Versions'));
    await act(async () => {
      fireEvent.press(getByText('Original'));
      await Promise.resolve();
    });
    rerender(<HomeScreen />);
    expect(getByText('Original focus')).toBeTruthy();

    hookState = {
      ...hookState,
      plan: null,
      activePlan: null,
      planVersions: [],
      activePlanVersions: [],
    };
    await act(async () => {
      rerender(<HomeScreen />);
      await Promise.resolve();
    });

    expect(queryByText('Original focus')).toBeNull();
    expect(getByText("Generate today's workout")).toBeTruthy();
  });

  it('calls setGenerationStatus with error when regeneration fails', async () => {
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    const { generateWorkout } = require('./services/api');
    generateWorkout.mockRejectedValue({ message: 'Regen failed' });

    const setGenerationStatus = jest.fn();
    const plan = createTodayPlanFixture({
      responseId: 'resp-err',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-err',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
      activePlan: plan,
      planVersions: [plan],
      activePlanVersions: [plan],
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
    const plan = createTodayPlanFixture({
      responseId: 'resp-ui',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-ui',
      },
    });
    mockUseHomeData.mockReturnValue({
      ...baseHookState,
      plan,
      activePlan: plan,
      planVersions: [plan],
      activePlanVersions: [plan],
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
