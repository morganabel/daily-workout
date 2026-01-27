import { database } from '../index';
import { plannedEventRepository } from './PlannedEventRepository';
import { formatLocalDate } from '../../utils/date';

const clearPlannedEvents = async () => {
  await database.write(async () => {
    const events = await database.collections
      .get<any>('planned_events')
      .query()
      .fetch();
    await Promise.all(events.map((event) => event.destroyPermanently()));
  });
};

describe('PlannedEventRepository', () => {
  afterEach(async () => {
    await clearPlannedEvents();
  });

  it('creates and returns a planned event with metadata', async () => {
    const localDate = formatLocalDate(new Date());

    const event = await plannedEventRepository.createPlannedEvent({
      kind: 'hike',
      title: 'Trail Loop',
      localDate,
      createdAtTimezone: 'UTC',
      durationMinutes: 90,
      tags: ['outdoors'],
      notes: 'Bring water',
      details: { elevation: 400 },
      metadata: { source: 'manual' },
    });

    expect(event.title).toBe('Trail Loop');
    expect(event.tags).toEqual(['outdoors']);
    expect(event.details).toEqual({ elevation: 400 });
    expect(event.metadata).toEqual({ source: 'manual' });
  });

  it('updates and archives planned events', async () => {
    const localDate = formatLocalDate(new Date());

    const event = await plannedEventRepository.createPlannedEvent({
      kind: 'rest',
      title: 'Recovery',
      localDate,
      createdAtTimezone: 'UTC',
    });

    const updated = await plannedEventRepository.updatePlannedEvent({
      id: event.id,
      title: 'Active recovery',
      status: 'canceled',
    });

    expect(updated.title).toBe('Active recovery');
    expect(updated.status).toBe('canceled');

    await plannedEventRepository.archivePlannedEvent(event.id);
    const archived = await plannedEventRepository.getPlannedEventById(event.id);
    expect(archived?.archivedAt).toBeTruthy();
  });

  it('filters upcoming event context to the next week', async () => {
    const today = new Date();
    const withinRange = new Date(today);
    withinRange.setDate(today.getDate() + 2);
    const beyondRange = new Date(today);
    beyondRange.setDate(today.getDate() + 10);

    await plannedEventRepository.createPlannedEvent({
      kind: 'run',
      title: 'Tempo Run',
      localDate: formatLocalDate(withinRange),
      createdAtTimezone: 'UTC',
      durationMinutes: 40,
    });

    await plannedEventRepository.createPlannedEvent({
      kind: 'rest',
      title: 'Canceled rest',
      localDate: formatLocalDate(withinRange),
      createdAtTimezone: 'UTC',
      status: 'canceled',
    });

    await plannedEventRepository.createPlannedEvent({
      kind: 'hike',
      title: 'Later Hike',
      localDate: formatLocalDate(beyondRange),
      createdAtTimezone: 'UTC',
    });

    const upcoming = await plannedEventRepository.listUpcomingEventContext(
      7,
      10
    );

    expect(upcoming.some((event) => event.title === 'Tempo Run')).toBe(true);
    expect(upcoming.some((event) => event.title === 'Canceled rest')).toBe(
      false
    );
    expect(upcoming.some((event) => event.title === 'Later Hike')).toBe(false);
  });
});
