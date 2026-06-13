import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type {
  CoachProjectedSession,
  CoachProjectionConflictWarning,
} from '@workout-agent/shared';
import { CoachUpcomingPlan } from './CoachUpcomingPlan';
import type { HomeCoachPlanView } from '../hooks/useHomeData';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const createSession = (
  overrides: Partial<CoachProjectedSession> = {}
): CoachProjectedSession => ({
  id: 'proj-1',
  planId: 'plan-ppl',
  programVersion: 1,
  cycleIndex: 0,
  strategy: 'weekly-target-balance',
  sessionIdentityKey: 'wtb:strength:1',
  localDate: '2026-04-29',
  sourceBlockId: 'push',
  addOnBlockIds: [],
  targetIds: ['strength'],
  status: 'projected',
  blockLabel: 'Upper Strength',
  durationMinutes: 45,
  rationale: [{ code: 'next-up', message: 'Next in your rotation.' }],
  coachNotes: [],
  conflictWarningIds: [],
  availableActions: ['generate', 'pin', 'skip', 'move'],
  ...overrides,
});

const createPlan = (
  overrides: Partial<HomeCoachPlanView> = {}
): HomeCoachPlanView => ({
  nextSession: createSession(),
  nextActionRationale: 'Next in your rotation.',
  upcomingSessions: [
    createSession({
      id: 'proj-2',
      localDate: '2026-05-01',
      blockLabel: 'Long Run',
      status: 'pinned',
      sessionIdentityKey: 'pin:0:long-run',
      availableActions: ['unpin', 'move'],
    }),
  ],
  repairNotes: [],
  conflictWarnings: [],
  ...overrides,
});

const noopHandlers = {
  onSkip: jest.fn(),
  onPin: jest.fn(),
  onUnpin: jest.fn(),
  onMove: jest.fn(),
  onGenerate: jest.fn(),
  onResolveConflict: jest.fn(),
};

describe('CoachUpcomingPlan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders upcoming sessions with distinct status labels', () => {
    const screen = render(
      <CoachUpcomingPlan coachPlan={createPlan()} {...noopHandlers} />
    );

    expect(screen.getByText('UPCOMING')).toBeTruthy();
    expect(screen.getByText('Long Run')).toBeTruthy();
    expect(screen.getByText('Pinned')).toBeTruthy();
  });

  it('invokes unpin and move with the projection id and next day', () => {
    const screen = render(
      <CoachUpcomingPlan coachPlan={createPlan()} {...noopHandlers} />
    );

    fireEvent.press(screen.getByText('Unpin'));
    expect(noopHandlers.onUnpin).toHaveBeenCalledWith('proj-2');

    fireEvent.press(screen.getByText('Move to next day'));
    expect(noopHandlers.onMove).toHaveBeenCalledWith('proj-2', '2026-05-02');
  });

  it('invokes generate and skip from a projected session', () => {
    const coachPlan = createPlan({
      upcomingSessions: [createSession()],
    });
    const screen = render(
      <CoachUpcomingPlan coachPlan={coachPlan} {...noopHandlers} />
    );

    fireEvent.press(screen.getByText('Generate'));
    expect(noopHandlers.onGenerate).toHaveBeenCalledWith('proj-1');

    fireEvent.press(screen.getByText('Skip'));
    expect(noopHandlers.onSkip).toHaveBeenCalledWith('proj-1');
  });

  it('renders a pinned conflict warning with explicit repair actions', () => {
    const warning: CoachProjectionConflictWarning = {
      id: 'proj-2:conflict:abc',
      projectionId: 'proj-2',
      localDate: '2026-05-01',
      kind: 'planned-event-conflict',
      message: 'Pinned session conflicts with Marathon.',
      eventTitle: 'Marathon',
      eventLocalDate: '2026-05-01',
      actions: ['keep-pinned', 'move', 'unpin'],
    };
    const coachPlan = createPlan({
      conflictWarnings: [warning],
      // Keep the only "Unpin" affordance on the conflict warning itself.
      upcomingSessions: [createSession({ availableActions: ['generate', 'skip'] })],
    });
    const screen = render(
      <CoachUpcomingPlan coachPlan={coachPlan} {...noopHandlers} />
    );

    expect(
      screen.getByText('Pinned session conflicts with Marathon.')
    ).toBeTruthy();
    expect(screen.getByText('Keep pinned')).toBeTruthy();

    fireEvent.press(screen.getByText('Unpin'));
    expect(noopHandlers.onResolveConflict).toHaveBeenCalledWith(
      warning,
      'unpin'
    );
  });

  it('keeps internal strategy ids out of the copy', () => {
    const coachPlan = createPlan();
    const screen = render(
      <CoachUpcomingPlan coachPlan={coachPlan} {...noopHandlers} />
    );

    expect(screen.queryByText(/weekly-target-balance/)).toBeNull();
    expect(screen.queryByText(/ordered-rotation/)).toBeNull();
    expect(screen.queryByText(/pin:0:long-run/)).toBeNull();
  });
});
