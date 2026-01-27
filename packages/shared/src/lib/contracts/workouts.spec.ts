import {
  buildGenerationRequestFromQuickActions,
  normalizeQuickActionValue,
  workoutSetLogSchema,
  workoutExerciseLogSchema,
  workoutSessionDetailSchema,
  workoutLogPayloadSchema,
  generationRequestSchema,
  MAX_UPCOMING_EVENTS,
  createSessionDetailMock,
  createWorkoutExerciseLogMock,
  createWorkoutSetLogMock,
  isAutoFocus,
  type GenerationRequest,
  type QuickActionPreset,
} from './workouts';

const createPreset = (
  overrides: Partial<QuickActionPreset>
): QuickActionPreset =>
  ({
    key: 'time',
    label: 'Time',
    value: '30',
    description: '30 minutes',
    stagedValue: null,
    ...overrides,
  } as QuickActionPreset);

describe('quick action helpers', () => {
  it('normalizes individual quick action values', () => {
    const timeResult = normalizeQuickActionValue(
      createPreset({ key: 'time', stagedValue: '95' })
    );
    expect(timeResult).toEqual({ timeMinutes: 95 });

    const focusResult = normalizeQuickActionValue(
      createPreset({
        key: 'focus',
        stagedValue: '  Lower Body  ',
      })
    );
    expect(focusResult).toEqual({ focus: 'Lower Body' });

    const equipmentResult = normalizeQuickActionValue(
      createPreset({
        key: 'equipment',
        stagedValue: 'Dumbbells, Bands,  Bench ',
      })
    );
    expect(equipmentResult).toEqual({
      equipment: ['Dumbbells', 'Bands', 'Bench'],
    });

    const energyResult = normalizeQuickActionValue(
      createPreset({ key: 'energy', stagedValue: 'Intense' })
    );
    expect(energyResult).toEqual({ energy: 'intense' });

    const backfillResult = normalizeQuickActionValue(
      createPreset({ key: 'backfill', stagedValue: 'YES' })
    );
    expect(backfillResult).toEqual({ backfill: true });

    const smartFocusResult = normalizeQuickActionValue(
      createPreset({
        key: 'focus',
        stagedValue: 'Smart',
      })
    );
    expect(smartFocusResult).toEqual({ focus: 'Smart' });
  });

  it('builds a generation request from quick actions and base defaults', () => {
    const quickActions: QuickActionPreset[] = [
      createPreset({ key: 'time', stagedValue: '45' }),
      createPreset({ key: 'focus', stagedValue: 'Upper Body' }),
      createPreset({
        key: 'equipment',
        stagedValue: 'Bodyweight, Rings',
      }),
      createPreset({ key: 'energy', stagedValue: 'easy' }),
    ];

    const base: Partial<GenerationRequest> = { notes: 'Morning session' };
    const request = buildGenerationRequestFromQuickActions(quickActions, base);

    expect(request).toEqual({
      timeMinutes: 45,
      focus: 'Upper Body',
      equipment: ['Bodyweight', 'Rings'],
      energy: 'easy',
      notes: 'Morning session',
    });
  });

  it('ignores invalid quick action values', () => {
    const quickActions: QuickActionPreset[] = [
      createPreset({ key: 'time', stagedValue: 'abc' }),
      createPreset({ key: 'energy', stagedValue: 'supercharged' }),
      createPreset({ key: 'equipment', stagedValue: '' }),
    ];

    const request = buildGenerationRequestFromQuickActions(quickActions);
    expect(request).toEqual({});
  });

  it('equipment only uses stagedValue, not default value (to allow profile fallback)', () => {
    // Equipment with a display value but no staged value should NOT be included
    // This allows the API layer to fall back to user profile equipment
    const equipmentWithDefaultOnly = normalizeQuickActionValue(
      createPreset({
        key: 'equipment',
        value: 'Dumbbells', // display value
        stagedValue: null, // user didn't explicitly select
      })
    );
    expect(equipmentWithDefaultOnly).toEqual({});

    // Other quick actions still use value as fallback
    const timeWithDefaultOnly = normalizeQuickActionValue(
      createPreset({
        key: 'time',
        value: '30',
        stagedValue: null,
      })
    );
    expect(timeWithDefaultOnly).toEqual({ timeMinutes: 30 });
  });
});

describe('workout logging contracts', () => {
  it('parses a session detail mock without errors', () => {
    const session = createSessionDetailMock();
    const parsed = workoutSessionDetailSchema.parse(session);
    expect(parsed.exercises).toHaveLength(1);
  });

  it('requires weightUnit when weight is provided', () => {
    const setLog = createWorkoutSetLogMock({ weightUnit: undefined });
    expect(() => workoutSetLogSchema.parse(setLog)).toThrow();
  });

  it('allows weightUnit to be omitted when weight is absent', () => {
    const setLog = createWorkoutSetLogMock({
      weight: undefined,
      weightUnit: undefined,
    });
    const parsed = workoutSetLogSchema.parse(setLog);
    expect(parsed.weightUnit).toBeUndefined();
  });

  it('accepts a log payload with exercises', () => {
    const payload = workoutLogPayloadSchema.parse({
      durationSeconds: 1200,
      exercises: [createWorkoutExerciseLogMock()],
    });
    expect(payload.exercises).toHaveLength(1);
  });

  it('accepts a completion-only log payload', () => {
    const payload = workoutLogPayloadSchema.parse({});
    expect(payload.exercises).toBeUndefined();
  });

  it('parses exercise logs with set arrays', () => {
    const exercise = createWorkoutExerciseLogMock({
      sets: [createWorkoutSetLogMock({ reps: 8 })],
    });
    const parsed = workoutExerciseLogSchema.parse(exercise);
    expect(parsed.sets[0].reps).toBe(8);
  });
});

describe('isAutoFocus', () => {
  it('returns true for "smart" (case-insensitive)', () => {
    expect(isAutoFocus('smart')).toBe(true);
    expect(isAutoFocus('Smart')).toBe(true);
    expect(isAutoFocus('SMART')).toBe(true);
  });

  it('returns true for "auto" (case-insensitive)', () => {
    expect(isAutoFocus('auto')).toBe(true);
    expect(isAutoFocus('Auto')).toBe(true);
    expect(isAutoFocus('AUTO')).toBe(true);
  });

  it('handles whitespace around the value', () => {
    expect(isAutoFocus('  smart  ')).toBe(true);
    expect(isAutoFocus(' auto ')).toBe(true);
  });

  it('returns false for specific focus values', () => {
    expect(isAutoFocus('Push')).toBe(false);
    expect(isAutoFocus('Pull')).toBe(false);
    expect(isAutoFocus('Legs')).toBe(false);
    expect(isAutoFocus('Core')).toBe(false);
    expect(isAutoFocus('Cardio')).toBe(false);
  });

  it('returns false for undefined or empty values', () => {
    expect(isAutoFocus(undefined)).toBe(false);
    expect(isAutoFocus('')).toBe(false);
    expect(isAutoFocus('   ')).toBe(false);
  });
});

describe('generation request upcoming events', () => {
  it('accepts up to the maximum upcoming events', () => {
    const upcomingEvents = Array.from(
      { length: MAX_UPCOMING_EVENTS },
      (_, index) => ({
        kind: 'hike',
        title: `Trail ${index + 1}`,
        localDate: '2025-06-0' + ((index % 9) + 1),
      })
    );

    const result = generationRequestSchema.safeParse({
      timeMinutes: 30,
      upcomingEvents,
    });

    expect(result.success).toBe(true);
  });

  it('rejects requests with too many upcoming events', () => {
    const upcomingEvents = Array.from(
      { length: MAX_UPCOMING_EVENTS + 1 },
      (_, index) => ({
        kind: 'run',
        title: `Run ${index + 1}`,
        localDate: '2025-06-15',
      })
    );

    const result = generationRequestSchema.safeParse({ upcomingEvents });
    expect(result.success).toBe(false);
  });
});
