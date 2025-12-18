import { Q } from '@nozbe/watermelondb';
import type {
  TodayPlan,
  WorkoutSessionSummary,
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
import type { WeightUnit } from '@workout-agent/shared';

export type SetInput = {
  order: number;
  reps?: number;
  weight?: number;
  weightUnit?: WeightUnit;
  rpe?: number;
  completed?: boolean;
};

export type ExerciseWithSets = Exercise & {
  sets: Set[];
};

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
        Q.take(1),
      )
      .observe();
  }

  observeRecentSessions(limit = 3, options?: { includeArchived?: boolean }) {
    return this.buildCompletedQuery(limit, Boolean(options?.includeArchived)).observe();
  }

  async listRecentSessions(limit = 5, options?: { includeArchived?: boolean }) {
    const query = this.buildCompletedQuery(limit, Boolean(options?.includeArchived));
    return query.fetch();
  }

  async getTodayWorkout(): Promise<Workout | null> {
    const workouts = await this.workouts
      .query(
        Q.where('status', 'planned'),
        Q.where('archived_at', null),
        Q.sortBy('scheduled_date', Q.desc),
        Q.take(1),
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
      await Promise.all(existing.map((workout) => workout.destroyPermanently()));

      const workout = await this.workouts.create((w) => {
        w.name = payload.workout.name;
        w.status = (payload.workout.status as 'planned' | 'completed' | 'skipped') ?? 'planned';
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

    return rowsToPlan(workout as unknown as WorkoutRowLike, exercises as ExerciseRowLike[]);
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
    };
  }

  async listSetsForExercise(exerciseId: string): Promise<Set[]> {
    return this.sets.query(Q.where('exercise_id', exerciseId), Q.sortBy('order', Q.asc)).fetch();
  }

  async upsertSet(exerciseId: string, input: SetInput): Promise<Set> {
    const existingSets = await this.sets
      .query(Q.where('exercise_id', exerciseId), Q.where('order', input.order))
      .fetch();

    if (existingSets[0]) {
      const set = existingSets[0];
      await database.write(async () => {
        await set.update((s) => {
          s.reps = input.reps ?? null;
          s.weight = input.weight ?? null;
          s.weightUnit = input.weightUnit ?? undefined;
          s.rpe = input.rpe ?? null;
          s.completed = Boolean(input.completed);
          s.order = input.order;
        });
      });
      return set;
    }

    const exercise = await this.exercises.find(exerciseId);
    return database.write(async () => {
      return this.sets.create((s) => {
        s.exercise.set(exercise);
        s.reps = input.reps ?? undefined;
        s.weight = input.weight ?? undefined;
        s.weightUnit = input.weightUnit ?? undefined;
        s.rpe = input.rpe ?? undefined;
        s.completed = Boolean(input.completed);
        s.order = input.order;
      });
    });
  }

  async replaceSetsForExercise(exerciseId: string, sets: SetInput[]) {
    // Replace by order to support add/remove flows
    const existing = await this.listSetsForExercise(exerciseId);
    const byOrder = new Map(existing.map((set) => [set.order, set] as const));

    await database.write(async () => {
      const seenOrders = new Set<number>();
      for (const input of sets) {
        seenOrders.add(input.order);
        const match = byOrder.get(input.order);
        if (match) {
          await match.update((s) => {
            s.reps = input.reps ?? null;
            s.weight = input.weight ?? null;
            s.weightUnit = input.weightUnit ?? undefined;
            s.rpe = input.rpe ?? null;
            s.completed = Boolean(input.completed);
            s.order = input.order;
          });
        } else {
          const exercise = await this.exercises.find(exerciseId);
          await this.sets.create((s) => {
            s.exercise.set(exercise);
            s.reps = input.reps ?? undefined;
            s.weight = input.weight ?? undefined;
            s.weightUnit = input.weightUnit ?? undefined;
            s.rpe = input.rpe ?? undefined;
            s.completed = Boolean(input.completed);
            s.order = input.order;
          });
        }
      }

      // Remove sets that are no longer present
      const toRemove = existing.filter((set) => !seenOrders.has(set.order));
      await Promise.all(toRemove.map((set) => set.destroyPermanently()));
    });
  }

  async removeSetByOrder(exerciseId: string, order: number) {
    const matches = await this.sets
      .query(Q.where('exercise_id', exerciseId), Q.where('order', order))
      .fetch();

    if (!matches.length) return;

    await database.write(async () => {
      await Promise.all(matches.map((set) => set.destroyPermanently()));
    });
  }

  async getWorkoutDetail(workoutId: string): Promise<{
    workout: Workout;
    exercises: ExerciseWithSets[];
  }> {
    const workout = await this.workouts.find(workoutId);
    const exercises = await this.exercises
      .query(Q.where('workout_id', workout.id), Q.sortBy('order', Q.asc))
      .fetch();

    const exercisesWithSets: ExerciseWithSets[] = [];
    for (const exercise of exercises) {
      const sets = await this.listSetsForExercise(exercise.id);
      exercisesWithSets.push(Object.assign(exercise, { sets }));
    }

    return { workout, exercises: exercisesWithSets };
  }

  async markSyncPending(workoutId: string, pending: boolean) {
    const workout = await this.workouts.find(workoutId);
    await database.write(async () => {
      await workout.update((w) => {
        w.syncPending = pending;
      });
    });
  }

  async startWorkoutTimer(workoutId: string, startedAt: number = Date.now()) {
    const workout = await this.workouts.find(workoutId);
    await database.write(async () => {
      await workout.update((w) => {
        w.startedAt = startedAt;
      });
    });
  }

  async findLastCompletedExerciseByName(exerciseName: string) {
    const normalized = exerciseName.trim().toLowerCase();
    const recentCompleted = await this.workouts
      .query(
        Q.where('status', 'completed'),
        Q.where('archived_at', null),
        Q.sortBy('completed_at', Q.desc),
        Q.take(10),
      )
      .fetch();

    for (const workout of recentCompleted) {
      const exercises = await this.exercises
        .query(Q.where('workout_id', workout.id))
        .fetch();
      const match = exercises.find((exercise) => exercise.name.trim().toLowerCase() === normalized);
      if (match) {
        const sets = await this.listSetsForExercise(match.id);
        return { workout, exercise: match, sets };
      }
    }

    return null;
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
      const computedDuration =
        durationSeconds ??
        (workout.startedAt ? Math.max(1, Math.round((now - workout.startedAt) / 1000)) : undefined);
      await workout.update((w) => {
        w.status = 'completed';
        w.completedAt = now;
        if (computedDuration !== undefined) {
          w.durationSeconds = computedDuration;
        }
        w.archivedAt = undefined;
        // Clear sync flag once marked complete locally; API sync can toggle as needed
        if (w.syncPending) {
          w.syncPending = false;
        }
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
        w.startedAt = startTime;
        w.archivedAt = undefined;
        w.syncPending = false;
      });
      return workout;
    });
  }
}

export const workoutRepository = new WorkoutRepository();
