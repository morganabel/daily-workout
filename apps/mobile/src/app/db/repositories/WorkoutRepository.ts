import { Q } from '@nozbe/watermelondb';
import type {
  TodayPlan,
  WorkoutSessionSummary,
  WorkoutBlock,
  WorkoutExercise,
} from '@workout-agent/shared';
import { database } from '../index';
import Workout from '../models/Workout';
import Exercise from '../models/Exercise';
import Set from '../models/Set';

export class WorkoutRepository {
  private workouts = database.collections.get<Workout>('workouts');
  private exercises = database.collections.get<Exercise>('exercises');
  private sets = database.collections.get<Set>('sets');

  observeTodayWorkout() {
    return this.workouts
      .query(Q.where('status', 'planned'), Q.sortBy('scheduled_date', Q.desc), Q.take(1))
      .observe();
  }

  observeRecentSessions(limit = 3) {
    return this.workouts
      .query(
        Q.where('status', 'completed'),
        Q.sortBy('completed_at', Q.desc),
        Q.take(limit),
      )
      .observe();
  }

  async getTodayWorkout(): Promise<Workout | null> {
    const workouts = await this.workouts
      .query(Q.where('status', 'planned'), Q.sortBy('scheduled_date', Q.desc), Q.take(1))
      .fetch();
    return workouts.length > 0 ? workouts[0] : null;
  }

  // Legacy entrypoint retained for future quick-add flows.
  async createWorkout(name: string, exercisesData: any[]) {
    const now = Date.now();
    await database.write(async () => {
      const workout = await this.workouts.create((w) => {
        w.name = name;
        w.status = 'planned';
        w.scheduledDate = now;
      });

      for (const exData of exercisesData) {
        const exercise = await this.exercises.create((e) => {
          e.workout.set(workout);
          e.name = exData.name;
          e.muscleGroup = exData.muscleGroup;
          e.order = exData.order;
        });

        if (exData.sets?.length) {
          // Sets table exists but is not currently rendered; populate if provided
          for (const setData of exData.sets) {
            await this.sets.create((s) => {
              s.exercise.set(exercise);
              s.reps = setData.reps;
              s.weight = setData.weight;
              s.rpe = setData.rpe;
              s.completed = setData.completed ?? false;
              s.order = setData.order;
            });
          }
        }
      }
    });
  }

  async saveGeneratedPlan(plan: TodayPlan) {
    await database.write(async () => {
      const existing = await this.workouts
        .query(Q.where('status', 'planned'))
        .fetch();
      await Promise.all(existing.map((workout) => workout.destroyPermanently()));

      const now = Date.now();
      const workout = await this.workouts.create((w) => {
        w.name = plan.focus;
        w.status = 'planned';
        w.remoteId = plan.id;
        w.focus = plan.focus;
        w.summary = plan.summary;
        w.energy = plan.energy;
        w.source = plan.source;
        w.equipmentJson = JSON.stringify(plan.equipment);
        w.planJson = JSON.stringify(plan);
        w.scheduledDate = now;
        w.durationSeconds = plan.durationMinutes * 60;
      });

      for (const [blockIndex, block] of plan.blocks.entries()) {
        for (const [exerciseIndex, exercise] of block.exercises.entries()) {
          await this.exercises.create((e) => {
            e.workout.set(workout);
            e.name = exercise.name;
            e.muscleGroup = block.focus;
            e.order = exerciseIndex;
            e.blockId = block.id;
            e.blockTitle = block.title;
            e.blockFocus = block.focus;
            e.blockDuration = block.durationMinutes;
            e.blockOrder = blockIndex;
            e.prescription = exercise.prescription;
            e.detail = exercise.detail ?? '';
          });
        }
      }
    });
  }

  async mapWorkoutToPlan(workout: Workout): Promise<TodayPlan> {
    const parsed = this.parsePlanJson(workout);
    const equipment = this.parseEquipment(workout);
    const durationMinutes = this.deriveDurationMinutes(workout);
    const fallbackBlocks = await this.buildBlocksFromExercises(workout);

    if (parsed) {
      return {
        ...parsed,
        id: workout.id,
        focus: parsed.focus ?? workout.focus ?? workout.name,
        durationMinutes: parsed.durationMinutes ?? durationMinutes,
        source: parsed.source ?? (workout.source as TodayPlan['source'] | undefined) ?? 'ai',
        energy: parsed.energy ?? (workout.energy as TodayPlan['energy'] | undefined) ?? 'moderate',
        equipment: parsed.equipment ?? equipment,
        summary: parsed.summary ?? workout.summary ?? '',
        blocks: parsed.blocks && parsed.blocks.length > 0 ? parsed.blocks : fallbackBlocks,
      };
    }

    return {
      id: workout.id,
      focus: workout.focus ?? workout.name,
      durationMinutes,
      equipment,
      source: (workout.source as TodayPlan['source'] | undefined) ?? 'ai',
      energy: (workout.energy as TodayPlan['energy'] | undefined) ?? 'moderate',
      summary: workout.summary ?? 'Personalized workout',
      blocks: fallbackBlocks,
    };
  }

  toSessionSummary(workout: Workout): WorkoutSessionSummary {
    return {
      id: workout.id,
      name: workout.name,
      focus: workout.focus ?? workout.name,
      durationMinutes: this.deriveDurationMinutes(workout),
      completedAt: workout.completedAt
        ? new Date(workout.completedAt).toISOString()
        : new Date().toISOString(),
      source: (workout.source as WorkoutSessionSummary['source']) ?? 'manual',
    };
  }

  async completeWorkoutById(workoutId: string) {
    try {
      const workout = await this.workouts.find(workoutId);
      await this.completeWorkout(workout);
    } catch (error) {
      console.error('Failed to complete workout', error);
      throw error;
    }
  }

  async completeWorkout(workout: Workout) {
    await database.write(async () => {
      const now = Date.now();
      await workout.update((w) => {
        w.status = 'completed';
        w.completedAt = now;
      });
    });
  }

  private parsePlanJson(workout: Workout): TodayPlan | null {
    if (!workout.planJson) {
      return null;
    }

    try {
      return JSON.parse(workout.planJson) as TodayPlan;
    } catch (error) {
      console.warn('Failed to parse plan JSON', error);
      return null;
    }
  }

  private parseEquipment(workout: Workout): string[] {
    if (!workout.equipmentJson) {
      return [];
    }

    try {
      const parsed = JSON.parse(workout.equipmentJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private deriveDurationMinutes(workout: Workout): number {
    if (workout.durationSeconds) {
      return Math.max(1, Math.round(workout.durationSeconds / 60));
    }
    return 30;
  }

  private async buildBlocksFromExercises(workout: Workout): Promise<WorkoutBlock[]> {
    const exercises = await this.exercises
      .query(Q.where('workout_id', workout.id), Q.sortBy('block_order', Q.asc))
      .fetch();
    exercises.sort((a, b) => {
      const blockA = a.blockOrder ?? 0;
      const blockB = b.blockOrder ?? 0;
      if (blockA === blockB) {
        return a.order - b.order;
      }
      return blockA - blockB;
    });

    if (!exercises.length) {
      return [
        {
          id: `${workout.id}-block`,
          title: workout.focus ?? workout.name,
          durationMinutes: this.deriveDurationMinutes(workout),
          focus: workout.focus ?? workout.name,
          exercises: [
            {
              id: `${workout.id}-exercise`,
              name: workout.name,
              prescription: 'Custom workout',
              detail: workout.summary ?? null,
            },
          ],
        },
      ];
    }

    const grouped = new Map<
      string,
      {
        block: {
          id: string;
          title?: string | null;
          focus?: string | null;
          duration?: number | null;
          order: number;
        };
        exercises: WorkoutExercise[];
      }
    >();

    exercises.forEach((exercise) => {
      const blockKey = exercise.blockId ?? `${exercise.blockOrder ?? 0}`;
      if (!grouped.has(blockKey)) {
        grouped.set(blockKey, {
          block: {
            id: exercise.blockId ?? `${workout.id}-block-${blockKey}`,
            title: exercise.blockTitle,
            focus: exercise.blockFocus,
            duration: exercise.blockDuration,
            order: exercise.blockOrder ?? 0,
          },
          exercises: [],
        });
      }

      grouped.get(blockKey)!.exercises.push({
        id: exercise.id,
        name: exercise.name,
        prescription: exercise.prescription ?? 'See notes',
        detail: exercise.detail || null,
      });
    });

    return Array.from(grouped.values())
      .sort((a, b) => a.block.order - b.block.order)
      .map<WorkoutBlock>((group) => ({
        id: group.block.id,
        title: group.block.title ?? workout.name,
        durationMinutes: group.block.duration ?? 5,
        focus: group.block.focus ?? workout.focus ?? workout.name,
        exercises: group.exercises,
      }));
  }
}

export const workoutRepository = new WorkoutRepository();
