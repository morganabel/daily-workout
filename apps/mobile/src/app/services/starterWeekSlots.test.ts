import {
  createTrainingBlueprintFromOnboarding,
  plannedSlotMetadataSchema,
  type PlannedSlotMetadata,
} from '@workout-agent/shared';
import { database } from '../db';
import { plannedEventRepository } from '../db/repositories/PlannedEventRepository';
import { createStarterWeekSlots } from './starterWeekSlots';

const clearPlannedEvents = async () => {
  await database.write(async () => {
    const events = await database.collections
      .get<any>('planned_events')
      .query()
      .fetch();
    await Promise.all(events.map((event) => event.destroyPermanently()));
  });
};

const createBlueprint = () =>
  createTrainingBlueprintFromOnboarding({
    goal: 'build-muscle',
    experienceLevel: 'intermediate',
    environment: 'gym',
    equipment: ['Gym'],
  });

describe('createStarterWeekSlots', () => {
  afterEach(async () => {
    await clearPlannedEvents();
  });

  it('creates versioned blueprint-owned workout slots for the starter week', async () => {
    const slots = await createStarterWeekSlots(createBlueprint(), {
      startDate: new Date(2026, 3, 13),
      timezone: 'UTC',
    });

    expect(slots).toHaveLength(7);
    expect(slots[0]).toMatchObject({
      kind: 'workout',
      title: 'Lift',
      localDate: '2026-04-13',
      durationMinutes: 50,
    });

    const metadata = plannedSlotMetadataSchema.parse(slots[0].metadata);
    expect(metadata).toMatchObject({
      schemaVersion: 1,
      ownership: 'app',
      source: 'training-blueprint',
      templateId: 'ppl-conditioning',
      slotRole: 'full-body',
      detailState: 'not-generated',
      locked: false,
      userEdited: false,
    });
  });

  it('preserves user-owned planned events in the same date range', async () => {
    await plannedEventRepository.createPlannedEvent({
      kind: 'travel',
      title: 'Flight home',
      localDate: '2026-04-13',
      createdAtTimezone: 'UTC',
      durationMinutes: 180,
      metadata: { source: 'manual' },
    });

    await createStarterWeekSlots(createBlueprint(), {
      startDate: new Date(2026, 3, 13),
      timezone: 'UTC',
    });

    const events = await plannedEventRepository.listEventsByDateRange(
      new Date(2026, 3, 13).getTime(),
      new Date(2026, 3, 19).getTime()
    );

    expect(events.some((event) => event.title === 'Flight home')).toBe(true);
    expect(
      events.filter((event) =>
        plannedSlotMetadataSchema.safeParse(event.metadata).success
      )
    ).toHaveLength(7);
  });

  it('preserves locked and linked blueprint-owned slots', async () => {
    const blueprint = createBlueprint();
    const slots = await createStarterWeekSlots(blueprint, {
      startDate: new Date(2026, 3, 13),
      timezone: 'UTC',
    });
    const lockedMetadata = plannedSlotMetadataSchema.parse(slots[0].metadata);
    const linkedMetadata = plannedSlotMetadataSchema.parse(slots[1].metadata);

    await plannedEventRepository.updatePlannedEvent({
      id: slots[0].id,
      title: 'Locked push slot',
      metadata: { ...lockedMetadata, locked: true } satisfies PlannedSlotMetadata,
    });
    await plannedEventRepository.updatePlannedEvent({
      id: slots[1].id,
      title: 'Linked pull slot',
      linkedWorkoutId: 'workout-1',
      metadata: {
        ...linkedMetadata,
        linkedWorkoutId: 'workout-1',
        detailState: 'generated',
      } satisfies PlannedSlotMetadata,
    });

    const updatedSlots = await createStarterWeekSlots(blueprint, {
      startDate: new Date(2026, 3, 13),
      timezone: 'UTC',
    });

    expect(updatedSlots[0].title).toBe('Locked push slot');
    expect(updatedSlots[1].title).toBe('Linked pull slot');
    expect(updatedSlots[1].linkedWorkoutId).toBe('workout-1');
  });
});
