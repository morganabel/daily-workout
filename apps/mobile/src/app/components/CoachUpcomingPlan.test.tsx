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
  onResolveConflict: jest.fn(),
};

describe('CoachUpcomingPlan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders upcoming sessions without normal planned status copy', () => {
    const screen = render(
      <CoachUpcomingPlan coachPlan={createPlan()} {...noopHandlers} />
    );

    expect(screen.getByText('COMING UP')).toBeTruthy();
    expect(screen.getByText('Long Run')).toBeTruthy();
    expect(screen.queryByText('Planned')).toBeNull();
    expect(screen.queryByText('Pinned')).toBeNull();
  });

  it('does not render row-level planning actions', () => {
    const screen = render(
      <CoachUpcomingPlan coachPlan={createPlan()} {...noopHandlers} />
    );

    expect(screen.queryByText('Unpin')).toBeNull();
    expect(screen.queryByText('Move to next day')).toBeNull();
    expect(screen.queryByText('Generate')).toBeNull();
    expect(screen.queryByText('Skip')).toBeNull();
  });

  it('caps the visible future preview', () => {
    const coachPlan = createPlan({
      upcomingSessions: [
        createSession({ id: 'proj-1', blockLabel: 'First' }),
        createSession({ id: 'proj-2', blockLabel: 'Second' }),
        createSession({ id: 'proj-3', blockLabel: 'Third' }),
        createSession({ id: 'proj-4', blockLabel: 'Fourth' }),
      ],
    });
    const screen = render(
      <CoachUpcomingPlan coachPlan={coachPlan} {...noopHandlers} />
    );

    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.getByText('Third')).toBeTruthy();
    expect(screen.queryByText('Fourth')).toBeNull();
  });

  it('does not render skipped sessions as coming up', () => {
    const coachPlan = createPlan({
      upcomingSessions: [
        createSession({
          id: 'proj-skipped',
          blockLabel: 'Skipped Legs',
          status: 'skipped',
          rationale: [
            { code: 'skipped-session', message: 'Legs was skipped.' },
          ],
        }),
        createSession({
          id: 'proj-next',
          blockLabel: 'Next Push',
          status: 'projected',
        }),
      ],
    });
    const screen = render(
      <CoachUpcomingPlan coachPlan={coachPlan} {...noopHandlers} />
    );

    expect(screen.getByText('Next Push')).toBeTruthy();
    expect(screen.queryByText('Skipped Legs')).toBeNull();
    expect(screen.queryByText('Skipped')).toBeNull();
    expect(screen.queryByText('Legs was skipped.')).toBeNull();
  });

  it('renders a pinned conflict warning with explicit repair actions', () => {
    const warning: CoachProjectionConflictWarning = {
      id: 'proj-2:conflict:abc',
      projectionId: 'proj-2',
      localDate: '2026-05-01',
      kind: 'planned-event-conflict',
      message: 'Long Run on Fri, May 1 overlaps Marathon.',
      eventTitle: 'Marathon',
      eventLocalDate: '2026-05-01',
      actions: ['keep-pinned', 'move', 'unpin'],
    };
    const coachPlan = createPlan({
      conflictWarnings: [warning],
      // Keep the only "Unpin" affordance on the conflict warning itself.
      upcomingSessions: [
        createSession({ availableActions: ['generate', 'skip'] }),
      ],
    });
    const screen = render(
      <CoachUpcomingPlan coachPlan={coachPlan} {...noopHandlers} />
    );

    expect(
      screen.getByText('Long Run on Fri, May 1 overlaps Marathon.')
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
