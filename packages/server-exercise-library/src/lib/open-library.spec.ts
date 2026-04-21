import { existsSync } from 'node:fs';
import path from 'node:path';
import { openExerciseLibrary } from './open-library.js';
import type { ExerciseRecord } from './types.js';

const packageRoot = process.cwd();
const generatedDbPath = path.join(
  packageRoot,
  'data',
  'public',
  'exercise-library.sqlite',
);

describe('openExerciseLibrary', () => {
  it('opens the generated library and reports metadata', () => {
    expect(existsSync(generatedDbPath)).toBe(true);

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

    expect(result.exercises[0]?.requiredEquipment).toContain('rowing_machine');
    expect(result.exercises[0]?.styleTags).toEqual(
      expect.arrayContaining(['cardio', 'conditioning']),
    );
    expect(result.exercises[0]?.name.toLowerCase()).toContain('rowing');

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
});
