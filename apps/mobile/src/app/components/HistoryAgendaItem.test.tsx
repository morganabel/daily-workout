import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { CalendarItem, PlannedEvent } from '@workout-agent/shared';
import { HistoryAgendaItem } from './HistoryAgendaItem';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

const plannedSlotEvent: PlannedEvent = {
  id: 'event-1',
  kind: 'workout',
  title: 'Pull',
  localDate: '2026-04-15',
  createdAtTimezone: 'UTC',
  allDay: true,
  durationMinutes: 45,
  status: 'planned',
  metadata: {
    schemaVersion: 1,
    ownership: 'app',
    source: 'training-blueprint',
    templateId: 'ppl-conditioning',
    slotId: 'day-2-pull',
    slotRole: 'pull',
    slotLabel: 'Pull',
    plannedDate: '2026-04-15',
    targetDurationMinutes: 45,
    equipmentLocationAssumptions: {
      environment: 'gym',
      equipment: ['Gym'],
    },
    detailState: 'not-generated',
    locked: false,
    userEdited: false,
  },
  createdAt: 1,
  updatedAt: 1,
};

const item: CalendarItem = {
  type: 'planned-event',
  localDate: '2026-04-15',
  eventId: 'event-1',
  kind: 'workout',
  title: 'Pull',
  allDay: true,
};

describe('HistoryAgendaItem planned slots', () => {
  it('renders planned-slot metadata and generation action', () => {
    const onGenerateWorkout = jest.fn();
    const screen = render(
      <HistoryAgendaItem
        item={item}
        plannedEvent={plannedSlotEvent}
        onEditEvent={jest.fn()}
        onGenerateWorkout={onGenerateWorkout}
        onOpenLinkedWorkout={jest.fn()}
        onOpenPlannedWorkout={jest.fn()}
        onOpenSession={jest.fn()}
      />
    );

    expect(screen.getByText('Pull')).toBeTruthy();
    expect(screen.getByText('Not generated')).toBeTruthy();
    expect(screen.queryByText('pull • not generated')).toBeNull();

    fireEvent.press(screen.getByText('Build'));
    expect(onGenerateWorkout).toHaveBeenCalledWith(plannedSlotEvent);
  });

  it('opens linked planned-slot workouts instead of regenerating', () => {
    const onOpenLinkedWorkout = jest.fn();
    const linkedEvent = {
      ...plannedSlotEvent,
      linkedWorkoutId: 'workout-1',
      metadata: {
        ...plannedSlotEvent.metadata,
        detailState: 'generated',
        linkedWorkoutId: 'workout-1',
      },
    } satisfies PlannedEvent;
    const screen = render(
      <HistoryAgendaItem
        item={item}
        plannedEvent={linkedEvent}
        onEditEvent={jest.fn()}
        onGenerateWorkout={jest.fn()}
        onOpenLinkedWorkout={onOpenLinkedWorkout}
        onOpenPlannedWorkout={jest.fn()}
        onOpenSession={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText('Open'));
    expect(onOpenLinkedWorkout).toHaveBeenCalledWith(linkedEvent);
  });

  it('opens built planned workouts from the agenda', () => {
    const onOpenPlannedWorkout = jest.fn();
    const plannedWorkout: CalendarItem = {
      type: 'planned-workout',
      localDate: '2026-04-15',
      workoutId: 'workout-1',
      title: 'Pull',
      scheduledAt: new Date(2026, 3, 15).toISOString(),
      durationMinutes: 50,
    };
    const screen = render(
      <HistoryAgendaItem
        item={plannedWorkout}
        onEditEvent={jest.fn()}
        onGenerateWorkout={jest.fn()}
        onOpenLinkedWorkout={jest.fn()}
        onOpenPlannedWorkout={onOpenPlannedWorkout}
        onOpenSession={jest.fn()}
      />
    );

    expect(screen.getByText('Pull')).toBeTruthy();
    expect(screen.getByText(/Planned/)).toBeTruthy();
    expect(screen.getByText(/50 min/)).toBeTruthy();

    fireEvent.press(screen.getByText('Open'));
    expect(onOpenPlannedWorkout).toHaveBeenCalledWith('workout-1');
  });
});
