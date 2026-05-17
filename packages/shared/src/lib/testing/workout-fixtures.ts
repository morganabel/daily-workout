import type {
  GenerationContext,
  TodayPlan,
  WorkoutExerciseLog,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
  WorkoutSetLog,
} from '../contracts/workouts.js';

export const createTodayPlanFixture = (
  overrides: Partial<TodayPlan> = {}
): TodayPlan => ({
  id: 'plan-fixture',
  focus: 'Upper Body Push',
  durationMinutes: 32,
  equipment: ['Dumbbells', 'Bench'],
  source: 'ai',
  energy: 'moderate',
  summary:
    'Prime your pressing pattern, build volume with compound supersets, and finish with a core burner.',
  blocks: [
    {
      id: 'warmup',
      title: 'Warm-up & Activation',
      durationMinutes: 6,
      focus: 'Prep & mobility',
      exercises: [
        {
          id: 'cat-cow',
          name: 'Cat / Cow Flow',
          prescription: '45 seconds',
          detail: 'Move slowly through the spine and breathe.',
        },
      ],
    },
    {
      id: 'strength',
      title: 'Strength Superset',
      durationMinutes: 18,
      focus: 'Compound push + support',
      exercises: [
        {
          id: 'db-bench',
          name: 'Dumbbell Bench Press',
          prescription: '3 x 10',
          detail: 'Tempo 2-1-2, choose load @ RPE 7.',
        },
      ],
    },
    {
      id: 'finisher',
      title: 'Conditioning Finisher',
      durationMinutes: 8,
      focus: 'Metabolic push',
      exercises: [
        {
          id: 'hollow-rock',
          name: 'Hollow Body Rock',
          prescription: '40 seconds',
          detail: 'Lower back stays glued to the floor.',
        },
      ],
    },
  ],
  ...overrides,
});

export const createSessionSummaryFixture = (
  overrides: Partial<WorkoutSessionSummary> = {}
): WorkoutSessionSummary => ({
  id: 'session-fixture',
  name: 'Quick Reset',
  completedAt: new Date().toISOString(),
  durationMinutes: 20,
  focus: 'Full Body',
  source: 'manual',
  archivedAt: undefined,
  ...overrides,
});

export const createWorkoutSetLogFixture = (
  overrides: Partial<WorkoutSetLog> = {}
): WorkoutSetLog => ({
  id: 'set-1',
  order: 0,
  completed: true,
  reps: 10,
  weight: 50,
  weightUnit: 'lb',
  rpe: 7,
  ...overrides,
});

export const createWorkoutExerciseLogFixture = (
  overrides: Partial<WorkoutExerciseLog> = {}
): WorkoutExerciseLog => ({
  id: 'exercise-1',
  name: 'Dumbbell Bench Press',
  order: 0,
  blockId: 'strength',
  blockTitle: 'Strength',
  blockFocus: 'Upper Body',
  blockOrder: 0,
  prescription: '3 x 10',
  detail: 'Keep core tight',
  sets: [createWorkoutSetLogFixture()],
  ...overrides,
});

export const createSessionDetailFixture = (
  overrides: Partial<WorkoutSessionDetail> = {}
): WorkoutSessionDetail => ({
  ...createSessionSummaryFixture(),
  exercises: [createWorkoutExerciseLogFixture()],
  ...overrides,
});

export const createGenerationContextFixture = (
  overrides: Partial<GenerationContext> = {}
): GenerationContext => {
  const base: GenerationContext = {
    userProfile: {
      experienceLevel: 'intermediate',
      primaryGoal: 'Build balanced strength',
      energyToday: 'moderate',
      preferredStyle: 'Hybrid strength + conditioning',
    },
    preferences: {
      focusBias: ['Upper Body', 'Core'],
      avoid: ['High-impact plyometrics'],
      injuries: ['Right shoulder tweak'],
    },
    environment: {
      equipment: ['Dumbbells', 'Pull-up bar', 'Bands'],
      location: 'Garage gym',
      timeAvailableMinutes: 35,
      timeOfDay: 'Morning',
    },
    recentSessions: [
      createSessionSummaryFixture({
        id: 'recent-1',
        name: 'Lower Body Strength',
        focus: 'Legs',
        durationMinutes: 38,
        source: 'ai',
      }),
      createSessionSummaryFixture({
        id: 'recent-2',
        name: 'Intervals + Core',
        focus: 'Conditioning',
        durationMinutes: 24,
        source: 'manual',
      }),
    ].map((session, index) => ({
      ...session,
      perceivedEffort: index === 0 ? 'intense' : 'moderate',
      notes: index === 0 ? 'Felt heavy, keep next session lighter' : undefined,
    })),
    notes: 'Prefers pushing movements earlier in the week.',
  };

  return {
    userProfile: {
      ...base.userProfile,
      ...(overrides.userProfile ?? {}),
    },
    preferences: {
      ...base.preferences,
      ...(overrides.preferences ?? {}),
    },
    environment: {
      ...base.environment,
      ...(overrides.environment ?? {}),
      equipment: overrides.environment?.equipment ?? base.environment.equipment,
    },
    recentSessions: overrides.recentSessions ?? base.recentSessions,
    notes: overrides.notes ?? base.notes,
  };
};
