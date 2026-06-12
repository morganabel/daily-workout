import { Q } from '@nozbe/watermelondb';
import type {
  CoachProgramAttribution,
  GenerationContext,
  GenerationRequest,
  RegenerationFeedback,
  TodayPlan,
  WorkoutExerciseLog,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
  WorkoutSetLog,
  WeightUnit,
} from '@workout-agent/shared';
import {
  coachProgramAttributionSchema,
  selectCoachStrategyForTemplate,
  workoutEnergySchema,
} from '@workout-agent/shared';
import { endOfDay, parseLocalDate, startOfDay } from '../../utils/date';
import { database } from '../index';
import Workout from '../models/Workout';
import Exercise from '../models/Exercise';
import Set from '../models/Set';
import {
  deriveDurationMinutes,
  planToPersistence,
  rowsToPlan,
  type ExerciseRowLike,
  type WorkoutRowLike,
} from '../mappers/workoutMapper';

const DEFAULT_SET_COUNT = 3;
const DEFAULT_REJECTED_VERSION_RETENTION_DAYS = 90;
const MAX_GENERATION_CONTEXT_EXERCISE_NAMES = 30;

type PersistedGenerationRequest = Partial<
  Pick<
    GenerationRequest,
    'timeMinutes' | 'focus' | 'equipment' | 'energy' | 'notes'
  >
> & {
  feedback?: RegenerationFeedback[];
};

const stringifyJson = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return JSON.stringify(value);
};

const parseCoachProgramAttribution = (
  value: string | undefined | null
): CoachProgramAttribution | undefined => {
  if (!value) return undefined;
  try {
    const result = coachProgramAttributionSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

const readCatalogProvenance = (
  planJson: string | undefined
): TodayPlan['catalogProvenance'] | undefined => {
  if (!planJson) return undefined;
  try {
    const parsed = JSON.parse(planJson) as Partial<TodayPlan>;
    return parsed.catalogProvenance;
  } catch {
    return undefined;
  }
};

const sanitizeGenerationRequest = (
  request: GenerationRequest | undefined
): PersistedGenerationRequest | undefined => {
  if (!request) return undefined;

  const sanitized: PersistedGenerationRequest = {};
  if (request.timeMinutes !== undefined)
    sanitized.timeMinutes = request.timeMinutes;
  if (request.focus !== undefined) sanitized.focus = request.focus;
  if (request.equipment !== undefined) sanitized.equipment = request.equipment;
  if (request.energy !== undefined) sanitized.energy = request.energy;
  if (request.notes?.trim()) sanitized.notes = request.notes.trim();
  if (request.feedback?.length) sanitized.feedback = request.feedback;

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const buildGeneratedCoachProgramAttribution = (
  request: GenerationRequest | undefined
): CoachProgramAttribution | undefined => {
  const intent = request?.adaptivePlanIntent;
  if (!intent) return undefined;

  const templateId = intent.sourceTemplateId;
  const scheduleStrategy =
    intent.scheduleStrategy ??
    (templateId
      ? selectCoachStrategyForTemplate(templateId).strategy
      : 'weekly-target-balance');

  return coachProgramAttributionSchema.parse({
    programId: intent.planId,
    programVersion: intent.programVersion ?? 1,
    sourceBlockId: intent.primaryBlock.blockId,
    addOnBlockIds: intent.addOnBlocks.map((block) => block.blockId),
    templateId,
    projectionId: intent.projectionId,
    scheduleStrategy,
    sourceKind: 'generated',
    confidence: 'high',
  });
};

const buildRequestedChanges = (
  request: PersistedGenerationRequest | undefined
): Record<string, unknown> | undefined => {
  if (!request) return undefined;

  const changes: Record<string, unknown> = {};
  if (request.timeMinutes !== undefined)
    changes.timeMinutes = request.timeMinutes;
  if (request.focus !== undefined) changes.focus = request.focus;
  if (request.equipment !== undefined) changes.equipment = request.equipment;
  if (request.energy !== undefined) changes.energy = request.energy;
  if (request.notes !== undefined) changes.notes = request.notes;
  if (request.feedback?.length) changes.feedback = request.feedback;

  return Object.keys(changes).length > 0 ? changes : undefined;
};

const deriveChangeLabel = (
  request: PersistedGenerationRequest | undefined,
  isRegeneration: boolean
): string | undefined => {
  if (!request || !isRegeneration) return undefined;

  if (request.feedback?.includes('too-hard')) return 'Easier';
  if (request.feedback?.includes('too-easy')) return 'Harder';
  if (request.feedback?.includes('different-exercises')) {
    return 'Different exercises';
  }
  if (request.feedback?.includes('just-try-again')) return 'Retry';
  if (request.timeMinutes !== undefined) return `${request.timeMinutes} min`;
  if (request.focus && request.focus !== 'Smart') return request.focus;
  if (request.equipment?.length) return 'Equipment change';
  if (request.energy) return `${request.energy} energy`;
  if (request.notes) return 'Custom request';

  return undefined;
};

const getDayBounds = (timestamp: number) => {
  const date = new Date(timestamp);
  return {
    start: startOfDay(date).getTime(),
    end: endOfDay(date).getTime(),
  };
};

const getTimestampForLocalDate = (localDate: string): number =>
  parseLocalDate(localDate).getTime();

const getTimestamp = (value: number | Date | undefined | null): number => {
  if (value instanceof Date) return value.getTime();
  return value ?? 0;
};

const normalizeExerciseName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const parseSetCount = (prescription?: string): number | null => {
  if (!prescription) return null;
  const match = prescription.match(/(\d+)\s*(?:x|sets?)/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

const buildSetLog = (set: Set): WorkoutSetLog => ({
  id: set.id,
  order: set.order,
  completed: set.completed,
  reps: set.reps ?? undefined,
  weight: set.weight ?? undefined,
  weightUnit: set.weightUnit ?? undefined,
  rpe: set.rpe ?? undefined,
});

const buildExerciseLog = (
  exercise: Exercise,
  sets: Set[]
): WorkoutExerciseLog => ({
  id: exercise.id,
  name: exercise.name,
  order: exercise.order ?? 0,
  blockId: exercise.blockId ?? undefined,
  blockTitle: exercise.blockTitle ?? undefined,
  blockFocus: exercise.blockFocus ?? undefined,
  blockOrder: exercise.blockOrder ?? undefined,
  prescription: exercise.prescription ?? undefined,
  detail: exercise.detail ?? undefined,
  sets: sets
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(buildSetLog),
});

export class WorkoutRepository {
  private workouts = database.collections.get<Workout>('workouts');
  private exercises = database.collections.get<Exercise>('exercises');
  private sets = database.collections.get<Set>('sets');

  private buildCompletedQuery(limit: number, includeArchived = false) {
    const conditions = [
      Q.where('status', 'completed'),
      Q.sortBy('completed_at', Q.desc),
      Q.take(limit),
    ];

    if (!includeArchived) {
      conditions.unshift(Q.where('archived_at', null));
    }

    return this.workouts.query(...conditions);
  }

  private buildPlannedWorkoutQueryForDate(timestamp: number) {
    const { start, end } = getDayBounds(timestamp);
    return this.workouts.query(
      Q.where('status', 'planned'),
      Q.where('archived_at', null),
      Q.where('scheduled_date', Q.between(start, end)),
      Q.or(Q.where('is_selected', true), Q.where('is_selected', null)),
      Q.sortBy('scheduled_date', Q.desc),
      Q.take(1)
    );
  }

  private buildPlannedVersionsQueryForDate(timestamp: number) {
    const { start, end } = getDayBounds(timestamp);
    return this.workouts.query(
      Q.where('status', 'planned'),
      Q.where('archived_at', null),
      Q.where('scheduled_date', Q.between(start, end)),
      Q.sortBy('created_at', Q.asc)
    );
  }

  private getWorkoutGenerationGroupId(workout: Workout): string {
    return workout.generationGroupId || workout.id;
  }

  private async destroyWorkoutGraph(workout: Workout): Promise<void> {
    const exercises = await this.exercises
      .query(Q.where('workout_id', workout.id))
      .fetch();

    for (const exercise of exercises) {
      const sets = await this.sets
        .query(Q.where('exercise_id', exercise.id))
        .fetch();
      await Promise.all(sets.map((set) => set.destroyPermanently()));
      await exercise.destroyPermanently();
    }

    await workout.destroyPermanently();
  }

  observeTodayWorkout() {
    return this.buildPlannedWorkoutQueryForDate(Date.now()).observe();
  }

  observeTodayWorkoutVersions() {
    return this.buildPlannedVersionsQueryForDate(Date.now()).observe();
  }

  observePlannedWorkoutVersionsForDate(localDate: string) {
    return this.buildPlannedVersionsQueryForDate(
      getTimestampForLocalDate(localDate)
    ).observe();
  }

  observeRecentSessions(limit = 3, options?: { includeArchived?: boolean }) {
    return this.buildCompletedQuery(
      limit,
      Boolean(options?.includeArchived)
    ).observe();
  }

  observeCompletedSessionsByDateRange(
    start: number,
    end: number,
    options?: { includeArchived?: boolean }
  ) {
    const conditions: Array<
      ReturnType<typeof Q.where> | ReturnType<typeof Q.sortBy>
    > = [
      Q.where('status', 'completed'),
      Q.where('completed_at', Q.between(start, end)),
      Q.sortBy('completed_at', Q.desc),
    ];

    if (!options?.includeArchived) {
      conditions.unshift(Q.where('archived_at', null));
    }

    return this.workouts.query(...conditions).observe();
  }

  async listRecentSessions(limit = 5, options?: { includeArchived?: boolean }) {
    const query = this.buildCompletedQuery(
      limit,
      Boolean(options?.includeArchived)
    );
    return query.fetch();
  }

  async listCompletedSessionsByDateRange(
    start: number,
    end: number,
    options?: { includeArchived?: boolean }
  ) {
    const conditions: Array<
      ReturnType<typeof Q.where> | ReturnType<typeof Q.sortBy>
    > = [
      Q.where('status', 'completed'),
      Q.where('completed_at', Q.between(start, end)),
      Q.sortBy('completed_at', Q.desc),
    ];

    if (!options?.includeArchived) {
      conditions.unshift(Q.where('archived_at', null));
    }

    return this.workouts.query(...conditions).fetch();
  }

  async getTodayWorkout(): Promise<Workout | null> {
    const workouts = await this.buildPlannedWorkoutQueryForDate(
      Date.now()
    ).fetch();
    return workouts.length > 0 ? workouts[0] : null;
  }

  async getPlannedWorkoutForDate(timestamp: number): Promise<Workout | null> {
    const workouts = await this.buildPlannedWorkoutQueryForDate(
      timestamp
    ).fetch();
    return workouts.length > 0 ? workouts[0] : null;
  }

  async getPlannedWorkoutForLocalDate(
    localDate: string
  ): Promise<Workout | null> {
    return this.getPlannedWorkoutForDate(getTimestampForLocalDate(localDate));
  }

  async listPlannedWorkoutVersionsForLocalDate(
    localDate: string
  ): Promise<Workout[]> {
    return this.listPlannedWorkoutVersionsForDate(
      getTimestampForLocalDate(localDate)
    );
  }

  async listPlannedWorkoutVersionsForDate(
    timestamp: number
  ): Promise<Workout[]> {
    const workouts = await this.buildPlannedVersionsQueryForDate(
      timestamp
    ).fetch();
    const selected =
      workouts.find((workout) => workout.isSelected === true) ??
      workouts.find((workout) => workout.isSelected !== false);
    const selectedGroupId = selected
      ? this.getWorkoutGenerationGroupId(selected)
      : undefined;

    if (!selectedGroupId) {
      return [];
    }

    return workouts.filter(
      (workout) => this.getWorkoutGenerationGroupId(workout) === selectedGroupId
    );
  }

  async saveGeneratedPlan(
    plan: TodayPlan,
    options?: {
      scheduledDate?: number;
      baselineWorkoutId?: string;
      generationRequest?: GenerationRequest;
    }
  ) {
    const now = Date.now();
    const payload = planToPersistence(plan, now);
    const scheduledDate = options?.scheduledDate ?? now;
    const generationRequest = sanitizeGenerationRequest(
      options?.generationRequest
    );
    const coachProgramAttribution = buildGeneratedCoachProgramAttribution(
      options?.generationRequest
    );
    const requestedChanges = buildRequestedChanges(generationRequest);
    payload.workout.scheduledDate = scheduledDate;

    await database.write(async () => {
      const { start, end } = getDayBounds(scheduledDate);
      const plannedForDay = await this.workouts
        .query(
          Q.where('status', 'planned'),
          Q.where('archived_at', null),
          Q.where('scheduled_date', Q.between(start, end))
        )
        .fetch();

      let baselineWorkout: Workout | null = null;
      if (options?.baselineWorkoutId) {
        try {
          baselineWorkout = await this.workouts.find(options.baselineWorkoutId);
        } catch {
          const matches = await this.workouts
            .query(Q.where('remote_id', options.baselineWorkoutId), Q.take(1))
            .fetch();
          baselineWorkout = matches[0] ?? null;
        }
      }

      const generationGroupId = baselineWorkout
        ? this.getWorkoutGenerationGroupId(baselineWorkout)
        : payload.workout.remoteId ?? plan.id;
      const versionsInGroup = plannedForDay.filter(
        (workout) =>
          this.getWorkoutGenerationGroupId(workout) === generationGroupId
      );
      const generationVersion = baselineWorkout
        ? Math.max(
            1,
            ...versionsInGroup.map((workout) => workout.generationVersion ?? 1)
          ) + 1
        : 1;
      const changeLabel = deriveChangeLabel(
        generationRequest,
        Boolean(baselineWorkout)
      );

      if (baselineWorkout) {
        await Promise.all(
          versionsInGroup.map((workout) =>
            workout.update((record) => {
              record.isSelected = false;
              record.generationGroupId = generationGroupId;
              record.generationVersion = record.generationVersion ?? 1;
            })
          )
        );
      } else {
        for (const workout of plannedForDay) {
          await this.destroyWorkoutGraph(workout);
        }
      }

      const workout = await this.workouts.create((w) => {
        w.name = payload.workout.name;
        w.status =
          (payload.workout.status as 'planned' | 'completed' | 'skipped') ??
          'planned';
        w.remoteId = payload.workout.remoteId ?? undefined;
        w.focus = payload.workout.focus ?? undefined;
        w.summary = payload.workout.summary ?? undefined;
        w.energy = payload.workout.energy ?? undefined;
        w.source = payload.workout.source ?? undefined;
        w.equipmentJson = payload.workout.equipmentJson ?? undefined;
        w.planJson = payload.workout.planJson ?? undefined;
        w.scheduledDate = scheduledDate;
        w.completedAt = payload.workout.completedAt ?? undefined;
        w.durationSeconds = payload.workout.durationSeconds ?? undefined;
        w.archivedAt = undefined;
        w.generationGroupId = generationGroupId;
        w.generationVersion = generationVersion;
        w.isSelected = true;
        w.parentWorkoutId = baselineWorkout?.id ?? undefined;
        w.generationRequestJson = stringifyJson(generationRequest);
        w.regenerationFeedbackJson = stringifyJson(generationRequest?.feedback);
        w.regenerationNotes = generationRequest?.notes;
        w.requestedChangesJson = stringifyJson(requestedChanges);
        w.changeLabel = changeLabel;
        // Store provider response ID for continuity-aware regeneration.
        w.responseId = payload.workout.responseId ?? undefined;
        w.coachProgramAttributionJson = stringifyJson(coachProgramAttribution);
      });

      for (const exercisePayload of payload.exercises) {
        await this.exercises.create((e) => {
          e.workout.set(workout);
          e.name = exercisePayload.name;
          e.muscleGroup = exercisePayload.muscleGroup ?? undefined;
          e.order = exercisePayload.order ?? 0;
          e.blockId = exercisePayload.blockId ?? undefined;
          e.blockTitle = exercisePayload.blockTitle ?? undefined;
          e.blockFocus = exercisePayload.blockFocus ?? undefined;
          e.blockDuration = exercisePayload.blockDuration ?? undefined;
          e.blockOrder = exercisePayload.blockOrder ?? undefined;
          e.prescription = exercisePayload.prescription ?? undefined;
          e.detail = exercisePayload.detail ?? undefined;
        });
      }
    });
  }

  async pruneRejectedWorkoutVersions(options?: {
    olderThanDays?: number;
    now?: number;
  }): Promise<number> {
    const olderThanDays =
      options?.olderThanDays ?? DEFAULT_REJECTED_VERSION_RETENTION_DAYS;
    const now = options?.now ?? Date.now();
    const cutoff = now - olderThanDays * 24 * 60 * 60 * 1000;
    const protectedParentWorkouts = await this.workouts
      .query(
        Q.where('archived_at', null),
        Q.or(Q.where('status', 'completed'), Q.where('is_selected', true))
      )
      .fetch();
    const protectedParentIds = new globalThis.Set(
      protectedParentWorkouts
        .map((workout) => workout.parentWorkoutId)
        .filter((id): id is string => Boolean(id))
    );
    const candidates = await this.workouts
      .query(
        Q.where('status', 'planned'),
        Q.where('archived_at', null),
        Q.where('is_selected', false),
        Q.where('scheduled_date', Q.lt(cutoff))
      )
      .fetch();
    const prunable = candidates.filter(
      (workout) => !workout.isFavorite && !protectedParentIds.has(workout.id)
    );

    await database.write(async () => {
      for (const workout of prunable) {
        await this.destroyWorkoutGraph(workout);
      }
    });

    return prunable.length;
  }

  async selectWorkoutVersion(workoutId: string): Promise<void> {
    const selectedWorkout = await this.workouts.find(workoutId);
    const groupId = this.getWorkoutGenerationGroupId(selectedWorkout);
    const scheduledDate = getTimestamp(selectedWorkout.scheduledDate);
    const { start, end } = getDayBounds(scheduledDate || Date.now());
    const versions = await this.workouts
      .query(
        Q.where('status', 'planned'),
        Q.where('archived_at', null),
        Q.where('scheduled_date', Q.between(start, end))
      )
      .fetch();

    await database.write(async () => {
      await Promise.all(
        versions
          .filter(
            (workout) => this.getWorkoutGenerationGroupId(workout) === groupId
          )
          .map((workout) =>
            workout.update((record) => {
              record.generationGroupId = groupId;
              record.generationVersion = record.generationVersion ?? 1;
              record.isSelected = workout.id === selectedWorkout.id;
            })
          )
      );
    });
  }

  async mapWorkoutToPlan(workout: Workout): Promise<TodayPlan> {
    const exercises = await this.exercises
      .query(Q.where('workout_id', workout.id), Q.sortBy('block_order', Q.asc))
      .fetch();

    return rowsToPlan(
      workout as unknown as WorkoutRowLike,
      exercises as ExerciseRowLike[]
    );
  }

  async getWorkoutByPlanId(planId: string): Promise<Workout | null> {
    try {
      return await this.workouts.find(planId);
    } catch {
      // no-op: fall back to remote_id lookup
    }

    const matches = await this.workouts
      .query(Q.where('remote_id', planId), Q.take(1))
      .fetch();
    return matches.length > 0 ? matches[0] : null;
  }

  async ensureSetsForWorkout(workoutId: string) {
    const exercises = await this.exercises
      .query(Q.where('workout_id', workoutId))
      .fetch();

    await database.write(async () => {
      for (const exercise of exercises) {
        const existingSets = await this.sets
          .query(Q.where('exercise_id', exercise.id))
          .fetch();

        if (existingSets.length > 0) {
          continue;
        }

        const targetCount =
          parseSetCount(exercise.prescription) ?? DEFAULT_SET_COUNT;
        for (let index = 0; index < targetCount; index += 1) {
          await this.sets.create((set) => {
            set.exercise.set(exercise);
            set.order = index;
            set.completed = false;
          });
        }
      }
    });
  }

  async listExerciseLogsByWorkoutId(
    workoutId: string
  ): Promise<WorkoutExerciseLog[]> {
    const exercises = await this.exercises
      .query(
        Q.where('workout_id', workoutId),
        Q.sortBy('block_order', Q.asc),
        Q.sortBy('order', Q.asc)
      )
      .fetch();

    const logs = await Promise.all(
      exercises.map(async (exercise) => {
        const sets = await this.sets
          .query(Q.where('exercise_id', exercise.id))
          .fetch();
        return buildExerciseLog(exercise, sets);
      })
    );

    return logs;
  }

  /**
   * Get session detail for viewing completed workouts.
   * Does NOT seed default sets - only returns existing data.
   * Use this for History/session detail views.
   */
  async getSessionDetailById(workoutId: string): Promise<WorkoutSessionDetail> {
    const workout = await this.workouts.find(workoutId);
    const exercises = await this.listExerciseLogsByWorkoutId(workoutId);

    return {
      ...this.toSessionSummary(workout),
      exercises,
    };
  }

  /**
   * Get session detail and seed default sets if needed.
   * Use this for Active Workout and explicit edit mode.
   */
  async getSessionDetailForEditing(
    workoutId: string
  ): Promise<WorkoutSessionDetail> {
    await this.ensureSetsForWorkout(workoutId);
    return this.getSessionDetailById(workoutId);
  }

  async updateSetById(
    setId: string,
    updates: {
      reps?: number | null;
      weight?: number | null;
      weightUnit?: WeightUnit | null;
      rpe?: number | null;
      completed?: boolean;
      order?: number;
    }
  ): Promise<WorkoutSetLog> {
    const set = await this.sets.find(setId);

    await database.write(async () => {
      await set.update((record) => {
        if (updates.reps !== undefined) {
          record.reps = updates.reps ?? undefined;
        }
        if (updates.weight !== undefined) {
          record.weight = updates.weight ?? undefined;
        }
        if (updates.weightUnit !== undefined) {
          record.weightUnit = updates.weightUnit ?? undefined;
        }
        if (updates.rpe !== undefined) {
          record.rpe = updates.rpe ?? undefined;
        }
        if (updates.completed !== undefined) {
          record.completed = updates.completed;
        }
        if (updates.order !== undefined) {
          record.order = updates.order;
        }
      });
    });

    return buildSetLog(set);
  }

  async addSetForExercise(exerciseId: string): Promise<WorkoutSetLog> {
    const exercise = await this.exercises.find(exerciseId);
    const sets = await this.sets
      .query(Q.where('exercise_id', exerciseId))
      .fetch();
    const nextOrder = sets.length;

    const newSet = await database.write(async () =>
      this.sets.create((set) => {
        set.exercise.set(exercise);
        set.order = nextOrder;
        set.completed = false;
      })
    );

    return buildSetLog(newSet);
  }

  async removeSetById(setId: string): Promise<void> {
    const set = await this.sets.find(setId);
    const exercise = await set.exercise.fetch();

    await database.write(async () => {
      await set.destroyPermanently();

      const remainingSets = await this.sets
        .query(Q.where('exercise_id', exercise.id), Q.sortBy('order', Q.asc))
        .fetch();

      await Promise.all(
        remainingSets.map((remaining, index) =>
          remaining.update((record) => {
            record.order = index;
          })
        )
      );
    });
  }

  async getLastExercisePerformance(
    exerciseName: string,
    options?: { excludeWorkoutId?: string }
  ): Promise<{ completedAt: string; sets: WorkoutSetLog[] } | null> {
    const normalizedTarget = normalizeExerciseName(exerciseName);
    const workouts = await this.buildCompletedQuery(12, false).fetch();

    for (const workout of workouts) {
      if (
        options?.excludeWorkoutId &&
        workout.id === options.excludeWorkoutId
      ) {
        continue;
      }

      const exercises = await this.exercises
        .query(Q.where('workout_id', workout.id))
        .fetch();

      const match = exercises.find(
        (exercise) => normalizeExerciseName(exercise.name) === normalizedTarget
      );
      if (!match) {
        continue;
      }

      const sets = await this.sets
        .query(Q.where('exercise_id', match.id), Q.sortBy('order', Q.asc))
        .fetch();

      const completedSets = sets.filter((item) => item.completed);
      if (completedSets.length === 0) {
        continue;
      }

      return {
        completedAt: workout.completedAt
          ? new Date(workout.completedAt).toISOString()
          : new Date().toISOString(),
        sets: completedSets.map(buildSetLog),
      };
    }

    return null;
  }

  toSessionSummary(workout: Workout): WorkoutSessionSummary {
    return {
      id: workout.id,
      name: workout.name,
      focus: workout.focus ?? workout.name,
      durationMinutes: deriveDurationMinutes(workout),
      completedAt: workout.completedAt
        ? new Date(workout.completedAt).toISOString()
        : new Date().toISOString(),
      source: (workout.source as WorkoutSessionSummary['source']) ?? 'manual',
      coachProgramAttribution: parseCoachProgramAttribution(
        workout.coachProgramAttributionJson
      ),
      catalogProvenance: readCatalogProvenance(workout.planJson ?? undefined),
      archivedAt: workout.archivedAt
        ? new Date(workout.archivedAt).toISOString()
        : undefined,
      isFavorite: workout.isFavorite ?? undefined,
    };
  }

  async toGenerationContextSession(
    workout: Workout
  ): Promise<GenerationContext['recentSessions'][number]> {
    const exercises = await this.exercises
      .query(Q.where('workout_id', workout.id), Q.sortBy('order', Q.asc))
      .fetch();
    const exerciseIds = exercises.map((exercise) => exercise.id);
    const sets = exerciseIds.length
      ? await this.sets
          .query(Q.where('exercise_id', Q.oneOf(exerciseIds)))
          .fetch()
      : [];
    const completedSetCount = sets.filter((set) => set.completed).length;
    const summary = this.toSessionSummary(workout);
    const exerciseNames = [
      ...new globalThis.Set(exercises.map((exercise) => exercise.name)),
    ].slice(0, MAX_GENERATION_CONTEXT_EXERCISE_NAMES);
    const session: GenerationContext['recentSessions'][number] = {
      ...summary,
      exerciseNames,
      completedSetCount,
    };

    const energy = workoutEnergySchema.safeParse(workout.energy);
    if (energy.success) {
      session.perceivedEffort = energy.data;
    }
    if (workout.source === 'manual' && workout.summary?.trim()) {
      session.notes = workout.summary.trim();
    }

    return session;
  }

  async toggleFavoriteWorkout(workoutId: string) {
    const workout = await this.workouts.find(workoutId);
    await database.write(async () => {
      await workout.update((w) => {
        w.isFavorite = !w.isFavorite;
      });
    });
  }

  async completeWorkoutById(workoutId: string, durationSeconds?: number) {
    try {
      const workout = await this.workouts.find(workoutId);
      await this.completeWorkout(workout, durationSeconds);
    } catch (error) {
      console.error('Failed to complete workout', error);
      throw error;
    }
  }

  async completeWorkout(workout: Workout, durationSeconds?: number) {
    await database.write(async () => {
      const now = Date.now();
      await workout.update((w) => {
        w.status = 'completed';
        w.completedAt = now;
        if (durationSeconds !== undefined) {
          w.durationSeconds = durationSeconds;
        }
        w.archivedAt = undefined;
      });
    });
  }

  async skipWorkoutById(workoutId: string) {
    const workout = await this.workouts.find(workoutId);
    await database.write(async () => {
      await workout.update((w) => {
        w.status = 'skipped';
        w.archivedAt = undefined;
      });
    });
  }

  async discardPlannedWorkout() {
    await database.write(async () => {
      const planned = await this.workouts
        .query(Q.where('status', 'planned'))
        .fetch();
      await Promise.all(planned.map((workout) => workout.destroyPermanently()));
    });
  }

  async archiveWorkoutById(workoutId: string) {
    const workout = await this.workouts.find(workoutId);
    await database.write(async () => {
      await workout.update((w) => {
        w.archivedAt = Date.now();
      });
    });
  }

  async unarchiveWorkoutById(workoutId: string) {
    const workout = await this.workouts.find(workoutId);
    await database.write(async () => {
      await workout.update((w) => {
        w.archivedAt = undefined;
      });
    });
  }

  async deleteWorkoutById(workoutId: string) {
    try {
      const workout = await this.workouts.find(workoutId);
      await database.write(async () => {
        await this.destroyWorkoutGraph(workout);
      });
    } catch (error) {
      console.error('Failed to delete workout', error);
      throw error;
    }
  }

  /**
   * Create a completed manual workout session (quick log).
   * Used when users want to record an ad-hoc workout without generating a plan.
   */
  async quickLogManualSession(params: {
    name: string;
    focus: string;
    durationMinutes: number;
    completedAt?: number;
    note?: string;
    coachProgramAttribution?: CoachProgramAttribution;
  }): Promise<Workout> {
    const now = Date.now();
    const completedAt = params.completedAt ?? now;
    const durationSeconds = params.durationMinutes * 60;

    // Calculate start time by subtracting duration from completion time
    const startTime = completedAt - durationSeconds * 1000;

    return database.write(async () => {
      const workout = await this.workouts.create((w) => {
        w.name = params.name;
        w.status = 'completed';
        w.source = 'manual';
        w.focus = params.focus;
        // For AI workouts, summary holds the AI description; for manual logs, it holds the user's note
        w.summary = params.note ?? undefined;
        w.scheduledDate = startTime;
        w.completedAt = completedAt;
        w.durationSeconds = durationSeconds;
        w.archivedAt = undefined;
        w.coachProgramAttributionJson = stringifyJson(
          params.coachProgramAttribution
            ? coachProgramAttributionSchema.parse(params.coachProgramAttribution)
            : undefined
        );
      });
      return workout;
    });
  }
}

export const workoutRepository = new WorkoutRepository();
