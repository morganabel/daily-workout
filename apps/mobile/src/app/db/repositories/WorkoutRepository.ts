import { database } from '../index';
import Workout from '../models/Workout';
import Exercise from '../models/Exercise';
import Set from '../models/Set';
import { Q } from '@nozbe/watermelondb';

export class WorkoutRepository {
  private workouts = database.collections.get<Workout>('workouts');
  private exercises = database.collections.get<Exercise>('exercises');
  private sets = database.collections.get<Set>('sets');

  async getTodayWorkout(): Promise<Workout | null> {
    // For now, just get the first planned workout.
    // In a real app, we'd query by date.
    const workouts = await this.workouts.query(
      Q.where('status', 'planned'),
      Q.take(1)
    ).fetch();

    return workouts.length > 0 ? workouts[0] : null;
  }

  observeTodayWorkout() {
    return this.workouts.query(
      Q.where('status', 'planned'),
      Q.take(1)
    ).observe();
  }

  async createWorkout(name: string, exercisesData: any[]) {
    await database.write(async () => {
      const workout = await this.workouts.create(w => {
        w.name = name;
        w.status = 'planned';
        w.scheduledDate = Date.now();
      });

      for (const exData of exercisesData) {
        const exercise = await this.exercises.create(e => {
          e.workout.set(workout);
          e.name = exData.name;
          e.muscleGroup = exData.muscleGroup;
          e.order = exData.order;
        });

        for (const setData of exData.sets) {
          await this.sets.create(s => {
            s.exercise.set(exercise);
            s.reps = setData.reps;
            s.weight = setData.weight;
            s.rpe = setData.rpe;
            s.completed = false;
            s.order = setData.order;
          });
        }
      }
    });
  }

  async completeWorkout(workout: Workout) {
    await database.write(async () => {
      await workout.update(w => {
        w.status = 'completed';
        w.completedAt = Date.now();
      });
    });
  }
}

export const workoutRepository = new WorkoutRepository();
