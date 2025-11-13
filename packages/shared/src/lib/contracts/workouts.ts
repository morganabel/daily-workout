import { z } from 'zod';

export const workoutEnergySchema = z.enum(['easy', 'moderate', 'intense']);
export type WorkoutEnergy = z.infer<typeof workoutEnergySchema>;

export const workoutSourceSchema = z.enum(['ai', 'manual']);
export type WorkoutSource = z.infer<typeof workoutSourceSchema>;

const workoutExerciseBaseSchema = z.object({
  name: z.string(),
  prescription: z.string(),
  detail: z.string().nullable(),
});

export const workoutExerciseSchema = workoutExerciseBaseSchema.extend({
  id: z.string(),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

export const llmWorkoutExerciseSchema = workoutExerciseBaseSchema;
export type LlmWorkoutExercise = z.infer<typeof llmWorkoutExerciseSchema>;

const workoutBlockBaseSchema = z.object({
  title: z.string(),
  durationMinutes: z.number().int().positive(),
  focus: z.string(),
  exercises: z.array(llmWorkoutExerciseSchema).min(1),
});

export const workoutBlockSchema = workoutBlockBaseSchema.extend({
  id: z.string(),
  exercises: z.array(workoutExerciseSchema).min(1),
});
export type WorkoutBlock = z.infer<typeof workoutBlockSchema>;

export const llmWorkoutBlockSchema = workoutBlockBaseSchema;
export type LlmWorkoutBlock = z.infer<typeof llmWorkoutBlockSchema>;

const todayPlanBaseSchema = z.object({
  focus: z.string(),
  durationMinutes: z.number().int().positive(),
  equipment: z.array(z.string()),
  source: workoutSourceSchema,
  energy: workoutEnergySchema,
  summary: z.string(),
  blocks: z.array(llmWorkoutBlockSchema).min(1),
});

export const todayPlanSchema = todayPlanBaseSchema.extend({
  id: z.string(),
  blocks: z.array(workoutBlockSchema).min(1),
});
export type TodayPlan = z.infer<typeof todayPlanSchema>;

export const llmTodayPlanSchema = todayPlanBaseSchema;
export type LlmTodayPlan = z.infer<typeof llmTodayPlanSchema>;

export const workoutSessionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  completedAt: z.string(), // ISO timestamp
  durationMinutes: z.number().int().positive(),
  focus: z.string(),
  source: workoutSourceSchema.optional(),
});
export type WorkoutSessionSummary = z.infer<typeof workoutSessionSummarySchema>;

export const quickActionKeySchema = z.enum([
  'time',
  'focus',
  'equipment',
  'energy',
  'backfill',
]);
export type QuickActionKey = z.infer<typeof quickActionKeySchema>;

export const quickActionPresetSchema = z.object({
  key: quickActionKeySchema,
  label: z.string(),
  value: z.string(),
  description: z.string(),
  stagedValue: z.string().nullable().optional(),
});
export type QuickActionPreset = z.infer<typeof quickActionPresetSchema>;

export const generationRequestSchema = z
  .object({
    timeMinutes: z.number().int().positive().optional(),
    focus: z.string().optional(),
    equipment: z.array(z.string()).optional(),
    energy: workoutEnergySchema.optional(),
    backfill: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .strict();
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

const generationContextSessionSchema = workoutSessionSummarySchema.extend({
  perceivedEffort: workoutEnergySchema.optional(),
  notes: z.string().optional(),
});

export const generationContextSchema = z.object({
  userProfile: z.object({
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    primaryGoal: z.string().optional(),
    energyToday: workoutEnergySchema.optional(),
    preferredStyle: z.string().optional(),
  }),
  preferences: z.object({
    focusBias: z.array(z.string()).max(3).optional(),
    avoid: z.array(z.string()).max(5).optional(),
    injuries: z.array(z.string()).max(3).optional(),
  }),
  environment: z.object({
    equipment: z.array(z.string()).default([]),
    location: z.string().optional(),
    timeAvailableMinutes: z.number().int().positive().optional(),
    timeOfDay: z.string().optional(),
  }),
  recentSessions: z.array(generationContextSessionSchema).max(5),
  notes: z.string().optional(),
});
export type GenerationContext = z.infer<typeof generationContextSchema>;

export const quickLogPayloadSchema = z.object({
  name: z.string(),
  focus: z.string(),
  durationMinutes: z.number().int().positive(),
  note: z.string().optional(),
  completedAt: z.string().optional(),
});
export type QuickLogPayload = z.infer<typeof quickLogPayloadSchema>;

export const createTodayPlanMock = (overrides: Partial<TodayPlan> = {}): TodayPlan => ({
  id: 'plan-mock',
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

export const createSessionSummaryMock = (
  overrides: Partial<WorkoutSessionSummary> = {},
): WorkoutSessionSummary => ({
  id: 'session-mock',
  name: 'Quick Reset',
  completedAt: new Date().toISOString(),
  durationMinutes: 20,
  focus: 'Full Body',
  source: 'manual',
  ...overrides,
});

export const createGenerationContextMock = (
  overrides: Partial<GenerationContext> = {},
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
      createSessionSummaryMock({
        id: 'recent-1',
        name: 'Lower Body Strength',
        focus: 'Legs',
        durationMinutes: 38,
        source: 'ai',
      }),
      createSessionSummaryMock({
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
      equipment:
        overrides.environment?.equipment ?? base.environment.equipment,
    },
    recentSessions:
      overrides.recentSessions ?? base.recentSessions,
    notes: overrides.notes ?? base.notes,
  };
};
