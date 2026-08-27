import { Q } from 'nitromelondb';
import type { Database } from 'nitromelondb';
import type {
  PlannedEvent,
  PlannedEventInput,
  PlannedEventPatch,
  UpcomingEventContext,
} from '@leveza/shared';
import { MAX_UPCOMING_EVENTS } from '@leveza/shared';
import PlannedEventModel from '../models/PlannedEvent';
import {
  formatLocalDate,
  getLocalDateFromTimestamp,
  parseLocalDate,
} from '../../utils/date';

const parseJson = <T>(value?: string | null): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const serializeJson = (value?: unknown): string | undefined => {
  if (value === undefined) return undefined;
  return JSON.stringify(value);
};

const serializeTags = (tags?: string[]): string | undefined => {
  if (!tags || tags.length === 0) return undefined;
  return JSON.stringify(tags);
};

const intensityOptions = new Set(['low', 'moderate', 'high']);
const statusOptions = new Set(['planned', 'canceled']);

const coerceIntensity = (
  value?: string | null
): PlannedEvent['intensity'] | undefined =>
  value && intensityOptions.has(value)
    ? (value as PlannedEvent['intensity'])
    : undefined;

const coerceStatus = (
  value?: string | null
): PlannedEvent['status'] | undefined =>
  value && statusOptions.has(value)
    ? (value as PlannedEvent['status'])
    : undefined;

const buildPlannedEvent = (event: PlannedEventModel): PlannedEvent => ({
  id: event.id,
  kind: event.kind,
  title: event.title,
  localDate: event.localDate,
  createdAtTimezone: event.createdAtTimezone,
  startsAt: event.startsAt ?? undefined,
  endsAt: event.endsAt ?? undefined,
  allDay: event.allDay ?? undefined,
  durationMinutes: event.durationMinutes ?? undefined,
  intensity: coerceIntensity(event.intensity),
  tags: parseJson<string[]>(event.tagsJson),
  notes: event.notes ?? undefined,
  status: coerceStatus(event.status),
  linkedWorkoutId: event.linkedWorkoutId ?? undefined,
  details: parseJson<Record<string, unknown>>(event.detailsJson),
  metadata: parseJson<Record<string, unknown>>(event.metadataJson),
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
  archivedAt: event.archivedAt ?? undefined,
});

const buildUpcomingContext = (
  event: PlannedEventModel
): UpcomingEventContext => ({
  kind: event.kind,
  title: event.title,
  localDate: event.localDate,
  startsAt: event.startsAt ? new Date(event.startsAt).toISOString() : undefined,
  durationMinutes: event.durationMinutes ?? undefined,
  allDay: event.allDay ?? undefined,
  intensity: coerceIntensity(
    event.intensity
  ) as UpcomingEventContext['intensity'],
  tags: parseJson<string[]>(event.tagsJson),
  notes: event.notes ?? undefined,
  metadata: parseJson<Record<string, unknown>>(event.metadataJson),
});

const resolveUpcomingWindow = (options?: {
  startLocalDate?: string;
  daysAhead?: number;
}) => {
  const startLocalDate = options?.startLocalDate ?? formatLocalDate(new Date());
  const end = parseLocalDate(startLocalDate);
  end.setDate(end.getDate() + (options?.daysAhead ?? 7));

  return {
    startLocalDate,
    endLocalDate: formatLocalDate(end),
  };
};

const filterUpcomingRecords = (
  events: PlannedEventModel[],
  limit: number
): UpcomingEventContext[] =>
  events
    .filter((event) => event.status !== 'canceled')
    .map(buildUpcomingContext)
    .slice(0, limit);

export class PlannedEventRepository {
  private readonly plannedEvents;

  constructor(private readonly database: Database) {
    this.plannedEvents =
      database.collections.get<PlannedEventModel>('planned_events');
  }

  toPlannedEvent(record: PlannedEventModel): PlannedEvent {
    return buildPlannedEvent(record);
  }

  observeEvents(options?: { includeArchived?: boolean }) {
    const conditions: Array<
      ReturnType<typeof Q.where> | ReturnType<typeof Q.sortBy>
    > = [Q.sortBy('local_date', Q.asc), Q.sortBy('starts_at', Q.asc)];

    if (!options?.includeArchived) {
      conditions.unshift(Q.where('archived_at', null));
    }

    return this.plannedEvents.query(...conditions).observe();
  }

  observeEventsByLocalDate(
    localDate: string,
    options?: { includeArchived?: boolean }
  ) {
    const conditions: Array<ReturnType<typeof Q.where>> = [
      Q.where('local_date', localDate),
    ];

    if (!options?.includeArchived) {
      conditions.push(Q.where('archived_at', null));
    }

    return this.plannedEvents.query(...conditions).observe();
  }

  async listEventsByLocalDate(
    localDate: string,
    options?: { includeArchived?: boolean }
  ): Promise<PlannedEvent[]> {
    const conditions = [Q.where('local_date', localDate)];
    if (!options?.includeArchived) {
      conditions.push(Q.where('archived_at', null));
    }
    const events = await this.plannedEvents.query(...conditions).fetch();
    return events.map(buildPlannedEvent);
  }

  async listUpcomingEventContext(
    options: {
      startLocalDate?: string;
      daysAhead?: number;
      limit?: number;
    } = {}
  ): Promise<UpcomingEventContext[]> {
    const { startLocalDate, endLocalDate } = resolveUpcomingWindow(options);
    const limit = options.limit ?? MAX_UPCOMING_EVENTS;

    const events = await this.plannedEvents
      .query(
        Q.where('archived_at', null),
        Q.where('local_date', Q.gte(startLocalDate)),
        Q.where('local_date', Q.lte(endLocalDate)),
        Q.sortBy('local_date', Q.asc),
        Q.sortBy('starts_at', Q.asc)
      )
      .fetch();

    return filterUpcomingRecords(events, limit);
  }

  observeUpcomingEventContext(
    options: {
      startLocalDate?: string;
      daysAhead?: number;
      limit?: number;
    } = {}
  ) {
    const { startLocalDate, endLocalDate } = resolveUpcomingWindow(options);
    const limit = options.limit ?? MAX_UPCOMING_EVENTS;
    const observable = this.plannedEvents
      .query(
        Q.where('archived_at', null),
        Q.where('local_date', Q.gte(startLocalDate)),
        Q.where('local_date', Q.lte(endLocalDate)),
        Q.sortBy('local_date', Q.asc),
        Q.sortBy('starts_at', Q.asc)
      )
      .observe();

    return {
      subscribe: (callback: (events: UpcomingEventContext[]) => void) =>
        observable.subscribe((events) =>
          callback(filterUpcomingRecords(events, limit))
        ),
    };
  }

  async createPlannedEvent(input: PlannedEventInput): Promise<PlannedEvent> {
    const event = await this.database.write(async () =>
      this.plannedEvents.create((record) => {
        record.kind = input.kind;
        record.title = input.title;
        record.localDate = input.localDate;
        record.createdAtTimezone = input.createdAtTimezone;
        record.startsAt = input.startsAt ?? undefined;
        record.endsAt = input.endsAt ?? undefined;
        record.allDay = input.allDay ?? undefined;
        record.durationMinutes = input.durationMinutes ?? undefined;
        record.intensity = input.intensity ?? undefined;
        record.tagsJson = serializeTags(input.tags);
        record.notes = input.notes ?? undefined;
        record.status = input.status ?? 'planned';
        record.linkedWorkoutId = input.linkedWorkoutId ?? undefined;
        record.detailsJson = serializeJson(input.details);
        record.metadataJson = serializeJson(input.metadata);
        record.archivedAt = undefined;
      })
    );

    return buildPlannedEvent(event);
  }

  async updatePlannedEvent(patch: PlannedEventPatch): Promise<PlannedEvent> {
    const event = await this.plannedEvents.find(patch.id);

    const updated = await this.database.write(async () =>
      event.update((record) => {
        if ('kind' in patch) record.kind = patch.kind!;
        if ('title' in patch) record.title = patch.title!;
        if ('localDate' in patch) record.localDate = patch.localDate!;
        if ('createdAtTimezone' in patch) {
          record.createdAtTimezone = patch.createdAtTimezone!;
        }
        if ('startsAt' in patch) record.startsAt = patch.startsAt ?? undefined;
        if ('endsAt' in patch) record.endsAt = patch.endsAt ?? undefined;
        if ('allDay' in patch) record.allDay = patch.allDay ?? undefined;
        if ('durationMinutes' in patch) {
          record.durationMinutes = patch.durationMinutes ?? undefined;
        }
        if ('intensity' in patch)
          record.intensity = patch.intensity ?? undefined;
        if ('tags' in patch) record.tagsJson = serializeTags(patch.tags);
        if ('notes' in patch) record.notes = patch.notes ?? undefined;
        if ('status' in patch) record.status = patch.status ?? undefined;
        if ('linkedWorkoutId' in patch) {
          record.linkedWorkoutId = patch.linkedWorkoutId ?? undefined;
        }
        if ('details' in patch)
          record.detailsJson = serializeJson(patch.details);
        if ('metadata' in patch)
          record.metadataJson = serializeJson(patch.metadata);
      })
    );

    return buildPlannedEvent(updated);
  }

  async archivePlannedEvent(eventId: string): Promise<void> {
    const event = await this.plannedEvents.find(eventId);
    await this.database.write(async () => {
      await event.update((record) => {
        record.archivedAt = Date.now();
      });
    });
  }

  async getPlannedEventById(eventId: string): Promise<PlannedEvent | null> {
    try {
      const event = await this.plannedEvents.find(eventId);
      return buildPlannedEvent(event);
    } catch {
      return null;
    }
  }

  async listEventsForLocalDate(localDate: string): Promise<PlannedEvent[]> {
    const events = await this.plannedEvents
      .query(Q.where('local_date', localDate), Q.where('archived_at', null))
      .fetch();
    return events.map(buildPlannedEvent);
  }

  async listEventsByDateRange(
    start: number,
    end: number
  ): Promise<PlannedEvent[]> {
    const startLocalDate = getLocalDateFromTimestamp(start);
    const endLocalDate = getLocalDateFromTimestamp(end);
    const events = await this.plannedEvents
      .query(Q.where('archived_at', null), Q.sortBy('local_date', Q.asc))
      .fetch();

    return events
      .filter(
        (event) =>
          event.localDate >= startLocalDate && event.localDate <= endLocalDate
      )
      .map(buildPlannedEvent);
  }
}
