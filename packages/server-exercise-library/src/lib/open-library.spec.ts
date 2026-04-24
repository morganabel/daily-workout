import { openExerciseLibrary } from './open-library.js';
import type { ExerciseRecord } from './types.js';

describe('openExerciseLibrary', () => {
  it('opens the generated library and reports metadata', () => {
    const library = openExerciseLibrary();
    const metadata = library.getLibraryMetadata();

    expect(metadata.exerciseCount).toBeGreaterThanOrEqual(873);
    expect(metadata.plannerReadyCount).toBeGreaterThanOrEqual(400);
    expect(metadata.sourceVersion).toContain('free-exercise-db@');

    library.close();
  });

  it('defaults eligible queries to planner-ready records', () => {
    const library = openExerciseLibrary();
    const result = library.listEligibleExercises({
      availableEquipment: ['Bodyweight'],
      focusTags: ['upper_body'],
    });

    expect(result.totalEligibleCount).toBeGreaterThan(0);
    expect(
      result.exercises.every(
        (exercise: ExerciseRecord) =>
          exercise.metadataCompleteness === 'planner-ready',
      ),
    ).toBe(true);
    const exerciseNames = result.exercises.map(
      (exercise: ExerciseRecord) => exercise.name,
    );
    expect(exerciseNames).toContain('Arm Circles');
    expect(exerciseNames).toContain('Pushups');

    library.close();
  });

  it('supports alias lookup for curated records', () => {
    const library = openExerciseLibrary();
    const pushup = library.getExerciseByAlias('push-up');
    const inclineCurl = library.getExerciseByAlias(
      'incline alternating dumbbell curl',
    );

    expect(pushup?.id).toBe('fedb:pushups');
    expect(inclineCurl?.id).toBe('fedb:alternate-incline-dumbbell-curl');

    library.close();
  });

  it('uses BM25 search text to rank relevant candidates higher inside filtered results', () => {
    const library = openExerciseLibrary();
    const result = library.listEligibleExercises({
      availableEquipment: ['Rowing Machine'],
      searchText: 'rowing machine cardio',
      limit: 3,
    });

    expect(result.exercises[0]?.id).toBe('fedb:rowing-stationary');

    library.close();
  });

  it('returns stable ordering for repeated planner candidate queries', () => {
    const library = openExerciseLibrary();
    const query = {
      availableEquipment: ['Bodyweight'],
      focusTags: ['upper_body'],
      limit: 5,
    };

    const first = library.listEligibleExercises(query);
    const second = library.listEligibleExercises(query);

    expect(first.exercises.map((exercise) => exercise.id)).toEqual(
      second.exercises.map((exercise) => exercise.id),
    );

    library.close();
  });

  it('supports variation queries by excluding baseline exercises', () => {
    const library = openExerciseLibrary();
    const result = library.listVariationCandidates({
      availableEquipment: ['Bodyweight', 'Pull-up Bar'],
      focusTags: ['upper_body'],
      baselineExerciseIds: ['fedb:pullups'],
    });

    expect(
      result.exercises.some(
        (exercise: ExerciseRecord) => exercise.id === 'fedb:pullups',
      ),
    ).toBe(false);
    expect(
      result.exercises.some(
        (exercise: ExerciseRecord) => exercise.id === 'fedb:chin-up',
      ),
    ).toBe(true);

    library.close();
  });

  it('returns planner-facing diagnostics for empty planner-ready results', () => {
    const library = openExerciseLibrary();
    const result = library.listEligibleExercises({
      availableEquipment: ['Parachute'],
      focusTags: ['upper_body'],
      limit: 5,
    });

    expect(result.exercises).toHaveLength(0);
    expect(result.diagnostics?.blockerCodes).toContain('unsupported_equipment');
    expect(result.diagnostics?.counts.relaxedEquipment).toBeGreaterThan(0);

    library.close();
  });
});
