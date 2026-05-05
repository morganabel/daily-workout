import type {
  PlannedEvent,
  PlannedSlotMetadata,
  StarterWeekSlot,
  TrainingBlueprint,
} from '@workout-agent/shared';
import { plannedSlotMetadataSchema } from '@workout-agent/shared';
import { plannedEventRepository } from '../db/repositories/PlannedEventRepository';
import { formatLocalDate, getDeviceTimezone, parseLocalDate } from '../utils/date';

type StarterWeekSlotOptions = {
  startDate?: Date;
  timezone?: string;
};

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const isProtectedBlueprintSlot = (event: PlannedEvent): boolean => {
  const metadata = plannedSlotMetadataSchema.safeParse(event.metadata);
  if (!metadata.success) {
    return false;
  }

  return Boolean(
    metadata.data.locked ||
      metadata.data.userEdited ||
      metadata.data.linkedWorkoutId ||
      event.linkedWorkoutId
  );
};

const getBlueprintSlotId = (event: PlannedEvent): string | undefined => {
  const metadata = plannedSlotMetadataSchema.safeParse(event.metadata);
  return metadata.success ? metadata.data.slotId : undefined;
};

const isBlueprintSlot = (event: PlannedEvent): boolean =>
  plannedSlotMetadataSchema.safeParse(event.metadata).success;

const createMetadata = (
  blueprint: TrainingBlueprint,
  slot: StarterWeekSlot,
  plannedDate: string
): PlannedSlotMetadata =>
  plannedSlotMetadataSchema.parse({
    schemaVersion: 1,
    ownership: 'app',
    source: 'training-blueprint',
    templateId: blueprint.templateId,
    slotId: slot.id,
    slotRole: slot.role,
    slotLabel: slot.label,
    plannedDate,
    targetDurationMinutes: slot.targetDurationMinutes,
    equipmentLocationAssumptions: blueprint.equipmentLocationAssumptions,
    detailState: 'not-generated',
  });

export const createStarterWeekSlots = async (
  blueprint: TrainingBlueprint,
  options: StarterWeekSlotOptions = {}
): Promise<PlannedEvent[]> => {
  const startDate = options.startDate ?? new Date();
  const timezone = options.timezone ?? getDeviceTimezone();
  const horizonDays = blueprint.horizonDays || 7;
  const start = parseLocalDate(formatLocalDate(startDate));
  const end = addDays(start, horizonDays - 1);
  const existingEvents = await plannedEventRepository.listEventsByDateRange(
    start.getTime(),
    end.getTime()
  );
  const existingSlotsById = new Map<string, PlannedEvent>();
  const expectedSlotIds = new Set(
    blueprint.slotSequence
      .filter((slot) => slot.dayOffset < horizonDays)
      .map((slot) => slot.id)
  );

  for (const event of existingEvents) {
    const slotId = getBlueprintSlotId(event);
    if (slotId) {
      existingSlotsById.set(slotId, event);
    }
  }

  await Promise.all(
    existingEvents
      .filter(
        (event) =>
          isBlueprintSlot(event) &&
          !expectedSlotIds.has(getBlueprintSlotId(event) ?? '') &&
          !isProtectedBlueprintSlot(event)
      )
      .map((event) => plannedEventRepository.archivePlannedEvent(event.id))
  );

  const plannedSlots: PlannedEvent[] = [];

  for (const slot of blueprint.slotSequence) {
    if (slot.dayOffset >= horizonDays) {
      continue;
    }

    const plannedDate = formatLocalDate(addDays(start, slot.dayOffset));
    const metadata = createMetadata(blueprint, slot, plannedDate);
    const existingSlot = existingSlotsById.get(slot.id);

    if (existingSlot && isProtectedBlueprintSlot(existingSlot)) {
      plannedSlots.push(existingSlot);
      continue;
    }

    if (existingSlot) {
      plannedSlots.push(
        await plannedEventRepository.updatePlannedEvent({
          id: existingSlot.id,
          kind: 'workout',
          title: slot.label,
          localDate: plannedDate,
          createdAtTimezone: timezone,
          allDay: true,
          durationMinutes: slot.targetDurationMinutes,
          status: 'planned',
          metadata,
        })
      );
      continue;
    }

    plannedSlots.push(
      await plannedEventRepository.createPlannedEvent({
        kind: 'workout',
        title: slot.label,
        localDate: plannedDate,
        createdAtTimezone: timezone,
        allDay: true,
        durationMinutes: slot.targetDurationMinutes,
        status: 'planned',
        metadata,
      })
    );
  }

  return plannedSlots;
};
