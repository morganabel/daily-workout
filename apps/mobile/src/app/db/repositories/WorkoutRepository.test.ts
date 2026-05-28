import { workoutRepository } from './WorkoutRepository';
import { database } from '../index';
import { createTodayPlanFixture } from '@workout-agent/shared/testing';
import { Q } from '@nozbe/watermelondb';

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

    it('maps manual quick logs to generation context memory', async () => {
      const workout = await workoutRepository.quickLogManualSession({
        name: 'Evening Walk',
        focus: 'Recovery',
        durationMinutes: 20,
        note: 'Knees felt good.',
      });

      const session = await workoutRepository.toGenerationContextSession(workout);

      expect(session.notes).toBe('Knees felt good.');
      expect(session.exerciseNames).toEqual([]);
      expect(session.completedSetCount).toBe(0);
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

  describe('generated workout versions', () => {
    it('appends regeneration versions without deleting the previous suggestion', async () => {
      const firstPlan = createTodayPlanFixture({
        id: 'plan-v1',
        summary: 'First suggestion',
      });
      const secondPlan = createTodayPlanFixture({
        id: 'plan-v2',
        summary: 'Second suggestion',
      });

      await workoutRepository.saveGeneratedPlan(firstPlan);
      const firstWorkout = await workoutRepository.getTodayWorkout();
      expect(firstWorkout).toBeTruthy();

      await workoutRepository.saveGeneratedPlan(secondPlan, {
        baselineWorkoutId: firstWorkout!.id,
      });

      const workouts = await database.collections
        .get<any>('workouts')
        .query()
        .fetch();
      const selectedWorkout = await workoutRepository.getTodayWorkout();
      const versions =
        await workoutRepository.listPlannedWorkoutVersionsForDate(Date.now());

      expect(workouts).toHaveLength(2);
      expect(selectedWorkout?.summary).toBe('Second suggestion');
      expect(selectedWorkout?.generationVersion).toBe(2);
      expect(versions.map((workout) => workout.summary)).toEqual([
        'First suggestion',
        'Second suggestion',
      ]);
      expect(versions.map((workout) => workout.isSelected)).toEqual([
        false,
        true,
      ]);
    });

    it('selects an older generated version without deleting newer options', async () => {
      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'plan-v1', summary: 'First suggestion' })
      );
      const firstWorkout = await workoutRepository.getTodayWorkout();
      expect(firstWorkout).toBeTruthy();

      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'plan-v2', summary: 'Second suggestion' }),
        { baselineWorkoutId: firstWorkout!.id }
      );

      await workoutRepository.selectWorkoutVersion(firstWorkout!.id);

      const selectedWorkout = await workoutRepository.getTodayWorkout();
      const versions =
        await workoutRepository.listPlannedWorkoutVersionsForDate(Date.now());

      expect(selectedWorkout?.id).toBe(firstWorkout!.id);
      expect(selectedWorkout?.summary).toBe('First suggestion');
      expect(versions).toHaveLength(2);
      expect(versions.map((workout) => workout.isSelected)).toEqual([
        true,
        false,
      ]);
    });

    it('can append a version when the baseline id is the remote plan id', async () => {
      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'remote-plan-v1', summary: 'First' })
      );

      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'remote-plan-v2', summary: 'Second' }),
        { baselineWorkoutId: 'remote-plan-v1' }
      );

      const versions =
        await workoutRepository.listPlannedWorkoutVersionsForDate(Date.now());

      expect(versions).toHaveLength(2);
      expect(versions.map((workout) => workout.summary)).toEqual([
        'First',
        'Second',
      ]);
    });

    it('deletes exercises and sets when replacing a planned workout', async () => {
      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'replace-plan-v1', summary: 'First' })
      );
      const firstWorkout = await workoutRepository.getTodayWorkout();
      expect(firstWorkout).toBeTruthy();

      await workoutRepository.ensureSetsForWorkout(firstWorkout!.id);
      const firstExercises = await database.collections
        .get<any>('exercises')
        .query(Q.where('workout_id', firstWorkout!.id))
        .fetch();
      const seededSets = await database.collections
        .get<any>('sets')
        .query()
        .fetch();
      expect(firstExercises.length).toBeGreaterThan(0);
      expect(seededSets.length).toBeGreaterThan(0);

      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'replace-plan-v2', summary: 'Second' })
      );

      const orphanedExercises = await database.collections
        .get<any>('exercises')
        .query(Q.where('workout_id', firstWorkout!.id))
        .fetch();
      const remainingSets = await database.collections
        .get<any>('sets')
        .query()
        .fetch();
      expect(orphanedExercises).toHaveLength(0);
      expect(remainingSets).toHaveLength(0);
    });

    it('stores regeneration lineage and request metadata', async () => {
      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'plan-v1', summary: 'First' })
      );
      const firstWorkout = await workoutRepository.getTodayWorkout();
      expect(firstWorkout).toBeTruthy();

      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'plan-v2', summary: 'Second' }),
        {
          baselineWorkoutId: firstWorkout!.id,
          generationRequest: {
            timeMinutes: 20,
            focus: 'Upper Body',
            energy: 'easy',
            notes: 'No overhead pressing today',
            feedback: ['different-exercises'],
            baselineWorkout: createTodayPlanFixture({ id: firstWorkout!.id }),
            previousResponseId: 'resp-original',
          },
        }
      );

      const versions =
        await workoutRepository.listPlannedWorkoutVersionsForDate(Date.now());
      const secondWorkout = versions.find(
        (workout) => workout.remoteId === 'plan-v2'
      );
      expect(secondWorkout?.parentWorkoutId).toBe(firstWorkout!.id);
      expect(secondWorkout?.changeLabel).toBe('Different exercises');
      expect(JSON.parse(secondWorkout?.generationRequestJson ?? '{}')).toEqual({
        timeMinutes: 20,
        focus: 'Upper Body',
        energy: 'easy',
        notes: 'No overhead pressing today',
        feedback: ['different-exercises'],
      });
      expect(
        JSON.parse(secondWorkout?.regenerationFeedbackJson ?? '[]')
      ).toEqual(['different-exercises']);

      const plan = await workoutRepository.mapWorkoutToPlan(secondWorkout!);
      expect((plan as any).versionMetadata).toEqual(
        expect.objectContaining({
          parentWorkoutId: firstWorkout!.id,
          changeLabel: 'Different exercises',
        })
      );
    });

    it('prunes old unselected versions while keeping direct parents of selected versions', async () => {
      const now = new Date('2026-04-27T12:00:00Z').getTime();
      const oldScheduledDate = now - 100 * 24 * 60 * 60 * 1000;

      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'old-plan-v1', summary: 'First' }),
        { scheduledDate: oldScheduledDate }
      );
      const firstWorkout = await workoutRepository.getPlannedWorkoutForDate(
        oldScheduledDate
      );
      expect(firstWorkout).toBeTruthy();

      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'old-plan-v2', summary: 'Second' }),
        {
          scheduledDate: oldScheduledDate,
          baselineWorkoutId: firstWorkout!.id,
          generationRequest: { feedback: ['too-hard'] },
        }
      );
      const secondWorkout = await workoutRepository.getPlannedWorkoutForDate(
        oldScheduledDate
      );
      expect(secondWorkout).toBeTruthy();

      await workoutRepository.saveGeneratedPlan(
        createTodayPlanFixture({ id: 'old-plan-v3', summary: 'Third' }),
        {
          scheduledDate: oldScheduledDate,
          baselineWorkoutId: secondWorkout!.id,
          generationRequest: { feedback: ['just-try-again'] },
        }
      );

      const pruned = await workoutRepository.pruneRejectedWorkoutVersions({
        olderThanDays: 90,
        now,
      });
      const remaining =
        await workoutRepository.listPlannedWorkoutVersionsForDate(
          oldScheduledDate
        );

      expect(pruned).toBe(1);
      expect(remaining.map((workout) => workout.remoteId)).toEqual([
        'old-plan-v2',
        'old-plan-v3',
      ]);
    });
  });

  describe('set logging', () => {
    it('seeds default sets from prescriptions', async () => {
      const plan = createTodayPlanFixture({
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
      const plan = createTodayPlanFixture({ id: 'plan-update' });
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

  describe('toGenerationContextSession', () => {
    it('includes exercise names, completed set count, and effort', async () => {
      const plan = createTodayPlanFixture({
        id: 'plan-memory',
        focus: 'Strength',
        energy: 'intense',
      });
      await workoutRepository.saveGeneratedPlan(plan);
      const workout = await workoutRepository.getWorkoutByPlanId(plan.id);
      if (!workout) {
        throw new Error('Expected saved workout');
      }

      await workoutRepository.ensureSetsForWorkout(workout.id);
      const logs = await workoutRepository.listExerciseLogsByWorkoutId(
        workout.id
      );
      const firstSetId = logs[0]?.sets[0]?.id;
      if (!firstSetId) {
        throw new Error('Expected seeded set');
      }
      await workoutRepository.updateSetById(firstSetId, {
        completed: true,
      });
      await workoutRepository.completeWorkoutById(workout.id, 30 * 60);

      const completedWorkout = await workoutRepository.getWorkoutByPlanId(
        plan.id
      );
      if (!completedWorkout) {
        throw new Error('Expected completed workout');
      }
      const session = await workoutRepository.toGenerationContextSession(
        completedWorkout
      );

      expect(session.perceivedEffort).toBe('intense');
      expect(session.exerciseNames).toEqual(
        expect.arrayContaining(['Cat / Cow Flow', 'Dumbbell Bench Press'])
      );
      expect(session.completedSetCount).toBe(1);
    });

    it('caps exercise names to the generation context contract limit', async () => {
      const plan = createTodayPlanFixture({
        id: 'plan-many-exercises',
        blocks: [
          {
            id: 'many-exercises',
            title: 'Many Exercises',
            durationMinutes: 60,
            focus: 'General',
            exercises: Array.from({ length: 31 }, (_, index) => ({
              id: `exercise-${index + 1}`,
              name: `Exercise ${index + 1}`,
              prescription: '1 x 10',
              detail: null,
            })),
          },
        ],
      });
      await workoutRepository.saveGeneratedPlan(plan);
      const workout = await workoutRepository.getWorkoutByPlanId(plan.id);
      if (!workout) {
        throw new Error('Expected saved workout');
      }

      const session = await workoutRepository.toGenerationContextSession(workout);

      expect(session.exerciseNames).toHaveLength(30);
      expect(session.exerciseNames).not.toContain('Exercise 31');
    });
  });
});
