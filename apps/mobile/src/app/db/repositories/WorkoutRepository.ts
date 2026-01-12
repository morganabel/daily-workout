import { Q } from '@nozbe/watermelondb';
import type {
  TodayPlan,
  WorkoutExerciseLog,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
  WorkoutSetLog,
  WeightUnit,
} from '@workout-agent/shared';
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
  return Math.min(value, 12);
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

  observeTodayWorkout() {
    return this.workouts
      .query(
        Q.where('status', 'planned'),
        Q.where('archived_at', null),
        Q.sortBy('scheduled_date', Q.desc),
        Q.take(1)
      )
      .observe();
  }

  observeRecentSessions(limit = 3, options?: { includeArchived?: boolean }) {
    return this.buildCompletedQuery(
      limit,
      Boolean(options?.includeArchived)
    ).observe();
  }

  async listRecentSessions(limit = 5, options?: { includeArchived?: boolean }) {
    const query = this.buildCompletedQuery(
      limit,
      Boolean(options?.includeArchived)
    );
    return query.fetch();
  }

  async getTodayWorkout(): Promise<Workout | null> {
    const workouts = await this.workouts
      .query(
        Q.where('status', 'planned'),
        Q.where('archived_at', null),
        Q.sortBy('scheduled_date', Q.desc),
        Q.take(1)
      )
      .fetch();
    return workouts.length > 0 ? workouts[0] : null;
  }

  async saveGeneratedPlan(plan: TodayPlan) {
    const payload = planToPersistence(plan);

    await database.write(async () => {
      const existing = await this.workouts
        .query(Q.where('status', 'planned'))
        .fetch();
      await Promise.all(
        existing.map((workout) => workout.destroyPermanently())
      );

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
        w.scheduledDate = payload.workout.scheduledDate ?? Date.now();
        w.completedAt = payload.workout.completedAt ?? undefined;
        w.durationSeconds = payload.workout.durationSeconds ?? undefined;
        w.archivedAt = undefined;
        // Store OpenAI response ID for conversation context
        w.responseId = payload.workout.responseId ?? undefined;
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

  async getSessionDetailById(workoutId: string): Promise<WorkoutSessionDetail> {
    await this.ensureSetsForWorkout(workoutId);
    const workout = await this.workouts.find(workoutId);
    const exercises = await this.listExerciseLogsByWorkoutId(workoutId);

    return {
      ...this.toSessionSummary(workout),
      exercises,
    };
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
    const workouts = await this.buildCompletedQuery(12, true).fetch();

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
      archivedAt: workout.archivedAt
        ? new Date(workout.archivedAt).toISOString()
        : undefined,
      isFavorite: workout.isFavorite,
    };
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
      });
      return workout;
    });
  }
}

export const workoutRepository = new WorkoutRepository();
