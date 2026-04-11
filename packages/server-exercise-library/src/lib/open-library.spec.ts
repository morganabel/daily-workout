import { existsSync } from 'node:fs';
import path from 'node:path';
import { openExerciseLibrary } from './open-library.js';
import type { ExerciseRecord } from './types.js';

const packageRoot = process.cwd();
const generatedDbPath = path.join(
  packageRoot,
  'data',
  'generated',
  'exercise-library.sqlite',
);

describe('openExerciseLibrary', () => {
  it('opens the generated library and reports metadata', () => {
    expect(existsSync(generatedDbPath)).toBe(true);

    const library = openExerciseLibrary();
    const metadata = library.getLibraryMetadata();

    expect(metadata.exerciseCount).toBe(873);
    expect(metadata.plannerReadyCount).toBeGreaterThanOrEqual(10);

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
    expect(
      result.exercises.map((exercise: ExerciseRecord) => exercise.name),
    ).toEqual(['Arm Circles', 'Pushups']);

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
