import { workoutRepository } from './WorkoutRepository';
import { database } from '../index';
import { createTodayPlanMock } from '@workout-agent/shared';

// Helper to get timestamp from WatermelonDB date field (can be Date object or number)
const getTimestamp = (value: number | Date | undefined | null): number => {
  if (value instanceof Date) return value.getTime();
  return value ?? 0;
};

describe('WorkoutRepository', () => {
  // Clean up workouts after each test
  afterEach(async () => {
    await database.write(async () => {
      const workouts = await database.collections
        .get('workouts')
        .query()
        .fetch();
      const exercises = await database.collections
        .get('exercises')
        .query()
        .fetch();
      const sets = await database.collections.get('sets').query().fetch();
      await Promise.all(sets.map((set) => set.destroyPermanently()));
      await Promise.all(
        exercises.map((exercise) => exercise.destroyPermanently())
      );
      await Promise.all(workouts.map((w) => w.destroyPermanently()));
    });
  });

  describe('quickLogManualSession', () => {
    it('creates a completed manual workout with correct fields', async () => {
      const workout = await workoutRepository.quickLogManualSession({
        name: 'Morning Run',
        focus: 'Cardio',
        durationMinutes: 30,
      });

      expect(workout.name).toBe('Morning Run');
      expect(workout.focus).toBe('Cardio');
      expect(workout.status).toBe('completed');
      expect(workout.source).toBe('manual');
      expect(workout.durationSeconds).toBe(30 * 60);
    });

    it('sets scheduledDate to completedAt minus duration', async () => {
      const durationMinutes = 45;
      const durationMs = durationMinutes * 60 * 1000;

      const workout = await workoutRepository.quickLogManualSession({
        name: 'Strength Training',
        focus: 'Upper Body',
        durationMinutes,
      });

      const scheduledDate = getTimestamp(workout.scheduledDate);
      const completedAt = getTimestamp(workout.completedAt);

      // scheduledDate should be completedAt - duration
      const expectedStartTime = completedAt - durationMs;
      expect(scheduledDate).toBe(expectedStartTime);
    });

    it('calculates start time correctly with custom completedAt', async () => {
      const completedAtInput = new Date('2025-12-03T15:00:00Z').getTime(); // 3:00 PM
      const durationMinutes = 45;
      const expectedStartTime = completedAtInput - durationMinutes * 60 * 1000; // 2:15 PM

      const workout = await workoutRepository.quickLogManualSession({
        name: 'Yoga Session',
        focus: 'Mobility',
        durationMinutes,
        completedAt: completedAtInput,
      });

      const scheduledDate = getTimestamp(workout.scheduledDate);
      const completedAt = getTimestamp(workout.completedAt);

      expect(completedAt).toBe(completedAtInput);
      expect(scheduledDate).toBe(expectedStartTime);
      expect(workout.durationSeconds).toBe(durationMinutes * 60);

      // Verify the math: completedAt - scheduledDate should equal durationSeconds * 1000
      const actualDurationMs = completedAt - scheduledDate;
      expect(actualDurationMs).toBe(workout.durationSeconds! * 1000);
    });

    it('stores the note in the summary field', async () => {
      const workout = await workoutRepository.quickLogManualSession({
        name: 'Evening Walk',
        focus: 'Recovery',
        durationMinutes: 20,
        note: 'Felt great after dinner!',
      });

      expect(workout.summary).toBe('Felt great after dinner!');
    });

    it('leaves summary as null/undefined when no note provided', async () => {
      const workout = await workoutRepository.quickLogManualSession({
        name: 'Quick HIIT',
        focus: 'Cardio',
        durationMinutes: 15,
      });

      expect(workout.summary).toBeFalsy();
    });

    it('maintains timestamp consistency across different durations', async () => {
      const testCases = [
        { durationMinutes: 15, name: 'Quick workout' },
        { durationMinutes: 60, name: 'Hour workout' },
        { durationMinutes: 90, name: 'Long workout' },
      ];

      for (const { durationMinutes, name } of testCases) {
        const workout = await workoutRepository.quickLogManualSession({
          name,
          focus: 'General',
          durationMinutes,
        });

        const scheduledDate = getTimestamp(workout.scheduledDate);
        const completedAt = getTimestamp(workout.completedAt);
        const durationMs = durationMinutes * 60 * 1000;
        const calculatedDuration = completedAt - scheduledDate;

        expect(calculatedDuration).toBe(durationMs);
        expect(workout.durationSeconds).toBe(durationMinutes * 60);
      }
    });
  });

  describe('set logging', () => {
    it('seeds default sets from prescriptions', async () => {
      const plan = createTodayPlanMock({
        id: 'plan-sets',
        blocks: [
          {
            id: 'strength',
            title: 'Strength',
            durationMinutes: 10,
            focus: 'Upper',
            exercises: [
              {
                id: 'bench',
                name: 'Bench Press',
                prescription: '4 x 8',
                detail: null,
              },
            ],
          },
        ],
      });

      await workoutRepository.saveGeneratedPlan(plan);
      const workout = await workoutRepository.getWorkoutByPlanId(plan.id);
      expect(workout).toBeTruthy();

      await workoutRepository.ensureSetsForWorkout(workout!.id);

      const exercises = await database.collections
        .get<any>('exercises')
        .query()
        .fetch();
      expect(exercises).toHaveLength(1);

      const sets = await database.collections.get<any>('sets').query().fetch();
      expect(sets).toHaveLength(4);
      expect(sets[0].order).toBe(0);
      expect(sets[3].order).toBe(3);
    });

    it('updates set metrics and returns logs', async () => {
      const plan = createTodayPlanMock({ id: 'plan-update' });
      await workoutRepository.saveGeneratedPlan(plan);
      const workout = await workoutRepository.getWorkoutByPlanId(plan.id);
      expect(workout).toBeTruthy();

      await workoutRepository.ensureSetsForWorkout(workout!.id);
      const sets = await database.collections.get<any>('sets').query().fetch();

      const updated = await workoutRepository.updateSetById(sets[0].id, {
        reps: 8,
        weight: 95,
        weightUnit: 'lb',
        rpe: 7,
        completed: true,
      });

      expect(updated.completed).toBe(true);
      expect(updated.reps).toBe(8);
      expect(updated.weight).toBe(95);
    });
  });

  describe('toggleFavoriteWorkout', () => {
    it('toggles isFavorite flag', async () => {
      // Create a workout
      const workout = await workoutRepository.quickLogManualSession({
        name: 'Fav Test',
        focus: 'Strength',
        durationMinutes: 30,
      });

      // Initially undefined or false
      expect(workout.isFavorite).toBeFalsy();

      // Toggle ON
      await workoutRepository.toggleFavoriteWorkout(workout.id);

      // Reload to check persistence
      const updatedWorkout = await database.collections
        .get<any>('workouts')
        .find(workout.id);
      expect(updatedWorkout.isFavorite).toBe(true);

      // Toggle OFF
      await workoutRepository.toggleFavoriteWorkout(workout.id);

      const updatedWorkout2 = await database.collections
        .get<any>('workouts')
        .find(workout.id);
      expect(updatedWorkout2.isFavorite).toBe(false);
    });

    it('is reflected in session summary', async () => {
      const workout = await workoutRepository.quickLogManualSession({
        name: 'Summary Test',
        focus: 'Strength',
        durationMinutes: 30,
      });

      await workoutRepository.toggleFavoriteWorkout(workout.id);

      // Reload the workout to get the latest state before converting to summary
      const reloadedWorkout = await database.collections
        .get<any>('workouts')
        .find(workout.id);
      const summary = workoutRepository.toSessionSummary(reloadedWorkout);
      expect(summary.isFavorite).toBe(true);
    });
  });
});
