import { z } from 'zod';

export const workoutEnergySchema = z.enum(['easy', 'moderate', 'intense']);
export type WorkoutEnergy = z.infer<typeof workoutEnergySchema>;

export const workoutSourceSchema = z.enum(['ai', 'manual']);
export type WorkoutSource = z.infer<typeof workoutSourceSchema>;

export const workoutExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  prescription: z.string(),
  detail: z.string().optional(),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

export const workoutBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationMinutes: z.number().int().positive(),
  focus: z.string(),
  exercises: z.array(workoutExerciseSchema).min(1),
});
export type WorkoutBlock = z.infer<typeof workoutBlockSchema>;

export const todayPlanSchema = z.object({
  id: z.string(),
  focus: z.string(),
  durationMinutes: z.number().int().positive(),
  equipment: z.array(z.string()),
  source: workoutSourceSchema,
  energy: workoutEnergySchema,
  summary: z.string(),
  blocks: z.array(workoutBlockSchema).min(1),
});
export type TodayPlan = z.infer<typeof todayPlanSchema>;

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

export const generationRequestSchema = z.object({
  timeMinutes: z.number().int().positive().optional(),
  focus: z.string().optional(),
  equipment: z.array(z.string()).optional(),
  energy: workoutEnergySchema.optional(),
  backfill: z.boolean().optional(),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

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
