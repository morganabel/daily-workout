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
          exercise.metadataCompleteness === 'planner-ready'
      )
    ).toBe(true);
    const exerciseNames = result.exercises.map(
      (exercise: ExerciseRecord) => exercise.name
    );
    expect(exerciseNames).toContain('Arm Circles');
    expect(exerciseNames).toContain('Pushups');

    library.close();
  });

  it('supports alias lookup for curated records', () => {
    const library = openExerciseLibrary();
    const pushup = library.getExerciseByAlias('push-up');
    const inclineCurl = library.getExerciseByAlias(
      'incline alternating dumbbell curl'
    );

    expect(pushup?.id).toBe('fedb:pushups');
    expect(inclineCurl?.id).toBe('fedb:alternate-incline-dumbbell-curl');

    library.close();
  });

  it('expands Gym into loaded gym equipment for candidate queries', () => {
    const library = openExerciseLibrary();
    const result = library.listEligibleExercises({
      availableEquipment: ['Gym'],
      focusTags: ['upper_body'],
      blockRole: 'main',
      styleBias: ['strength'],
      limit: 20,
    });

    expect(result.diagnostics?.blockerCodes).toBeUndefined();
    const exerciseNames = result.exercises.map(
      (exercise: ExerciseRecord) => exercise.name
    );
    expect(exerciseNames).toContain('Barbell Bench Press');

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
      second.exercises.map((exercise) => exercise.id)
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
        (exercise: ExerciseRecord) => exercise.id === 'fedb:pullups'
      )
    ).toBe(false);
    expect(
      result.exercises.some(
        (exercise: ExerciseRecord) => exercise.id === 'fedb:chin-up'
      )
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

  it('returns a direct workout catalog match for a strong bodyweight request', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 30,
      focus: 'full body strength',
      availableEquipment: ['Bodyweight'],
      experienceLevel: 'beginner',
      energy: 'moderate',
    });

    expect(result.decision).toBe('direct');
    expect(result.recipe?.id).toBe('catalog:bodyweight-foundation-30');
    expect(result.plan?.source).toBe('library');
    expect(result.plan?.blocks[0]?.exercises[0]?.id).toContain('ex:00508');

    library.close();
  });

  it('penalizes recently used workout catalog recipes before selection', () => {
    const library = openExerciseLibrary();
    const query = {
      timeMinutes: 30,
      focus: 'full body strength',
      availableEquipment: ['Bodyweight'],
      experienceLevel: 'beginner' as const,
      energy: 'moderate' as const,
    };
    const fresh = library.matchWorkoutCatalog(query);
    const repeated = library.matchWorkoutCatalog({
      ...query,
      recentCatalogRecipeIds: ['catalog:bodyweight-foundation-30'],
    });

    expect(fresh.recipe?.id).toBe('catalog:bodyweight-foundation-30');
    if (repeated.recipe?.id === fresh.recipe?.id) {
      expect(repeated.diagnostics.blockerCodes).toContain(
        'catalog_recipe_cooldown'
      );
      expect(repeated.score).toBeLessThan(
        fresh.score ?? Number.POSITIVE_INFINITY
      );
    } else {
      expect(repeated.recipe?.id).not.toBe('catalog:bodyweight-foundation-30');
    }

    library.close();
  });

  it('uses valid direct catalog substitutions to avoid recently used exercises', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 30,
      focus: 'Conditioning',
      focusTags: ['conditioning', 'recovery', 'lower_body'],
      availableEquipment: ['Treadmill'],
      experienceLevel: 'beginner',
      energy: 'easy',
      recentExerciseIds: ['ex:02157'],
    });
    const exerciseIds =
      result.plan?.blocks.flatMap((block) =>
        block.exercises.map((exercise) => exercise.id)
      ) ?? [];

    expect(result.decision).toBe('direct');
    expect(result.recipe?.id).toBe('catalog:treadmill-recovery-cardio-30');
    expect(exerciseIds).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('ex:02157:cardio:incline-walk'),
      ])
    );
    expect(exerciseIds).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/ex:(00153|00498):cardio:incline-walk/),
      ])
    );

    library.close();
  });

  it('returns an adapt workout catalog match for usable but ambiguous catalog fit', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 30,
      focus: 'mobility reset',
      availableEquipment: ['Bodyweight'],
      experienceLevel: 'beginner',
      energy: 'easy',
    });

    expect(result.decision).toBe('adapt');
    expect(result.recipe?.id).toBe('catalog:bodyweight-easy-walk-core-30');
    expect(result.score).toBeGreaterThanOrEqual(58);
    expect(result.score).toBeLessThan(82);

    library.close();
  });

  it('returns no catalog match for an unrecognized explicit focus', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 30,
      focus: 'Parachute intervals',
      availableEquipment: ['Bodyweight'],
      experienceLevel: 'beginner',
      energy: 'moderate',
    });

    expect(result.decision).toBe('none');
    expect(result.diagnostics.blockerCodes).toContain('focus_gap');
    expect(result.score).toBeLessThan(58);

    library.close();
  });

  it('returns a full-body recipe for an explicit full-body request', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 25,
      focus: 'Full Body',
      availableEquipment: ['Bodyweight'],
      experienceLevel: 'beginner',
      energy: 'moderate',
      contraindicationTags: ['shoulder_irritation'],
    });

    expect(result.decision).toBe('direct');
    expect(result.recipe?.focusTags).toContain('full_body');
    expect(result.diagnostics.blockerCodes).not.toContain('focus_gap');
    expect(result.plan?.durationMinutes).toBe(25);
    expect(
      result.plan?.blocks.reduce(
        (total, block) => total + block.durationMinutes,
        0
      )
    ).toBe(25);

    library.close();
  });

  it('routes energy-mismatched catalog recipes through adaptation instead of direct return', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 25,
      focus: 'Full Body',
      availableEquipment: ['Bodyweight'],
      experienceLevel: 'beginner',
      energy: 'intense',
      contraindicationTags: ['shoulder_irritation'],
    });

    expect(result.recipe?.id).toBe(
      'catalog:bodyweight-shoulder-safe-full-body-25'
    );
    expect(result.decision).toBe('adapt');
    expect(result.plan?.energy).toBe('easy');
    expect(result.diagnostics.blockerCodes).toContain('energy_gap');

    library.close();
  });

  it('prioritizes exact upper-body catalog matches over broad full-body matches', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 30,
      focus: 'Upper Body',
      availableEquipment: ['Dumbbell'],
      experienceLevel: 'beginner',
      energy: 'moderate',
    });

    expect(result.decision).not.toBe('none');
    expect(result.recipe?.id).toBe('catalog:dumbbell-upper-body-30');
    expect(result.recipe?.focus).toContain('Upper Body');

    library.close();
  });

  it('returns the treadmill recovery catalog workout for recovery cardio requests', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 30,
      focus: 'Conditioning',
      availableEquipment: ['Treadmill'],
      experienceLevel: 'beginner',
      energy: 'easy',
      contraindicationTags: ['lower_body_fatigue'],
    });

    expect(result.decision).not.toBe('none');
    expect(result.recipe?.id).toBe('catalog:treadmill-recovery-cardio-30');
    expect(result.plan?.blocks.flatMap((block) => block.exercises)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining('fedb:walking-treadmill'),
        }),
      ])
    );

    library.close();
  });

  it('returns a real deadlift workout for advanced powerlifting pull requests', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 85,
      focus: 'Pull',
      availableEquipment: ['Barbell', 'Pull-up Bar'],
      experienceLevel: 'advanced',
      energy: 'intense',
      styleBias: ['powerlifting'],
    });

    expect(result.decision).toBe('direct');
    expect(result.recipe?.id).toBe('catalog:powerlifting-deadlift-day-85');
    expect(result.plan?.blocks.flatMap((block) => block.exercises)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining('fedb:barbell-deadlift'),
        }),
      ])
    );

    library.close();
  });

  it('returns no workout catalog match for unsupported equipment', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 30,
      focus: 'upper body strength',
      availableEquipment: ['Parachute'],
      experienceLevel: 'beginner',
    });

    expect(result.decision).toBe('none');
    expect(result.diagnostics.blockerCodes).toContain('unsupported_equipment');
    expect(result.plan).toBeUndefined();

    library.close();
  });

  it('filters workout catalog matches by protected stressors', () => {
    const library = openExerciseLibrary();
    const result = library.matchWorkoutCatalog({
      timeMinutes: 30,
      focus: 'full body strength',
      availableEquipment: ['Bodyweight'],
      experienceLevel: 'beginner',
      disallowedStressors: ['lower_body_fatigue'],
    });

    expect(result.decision).toBe('none');
    expect(result.diagnostics.blockerCodes).toContain('stressor_conflict');

    library.close();
  });
});
