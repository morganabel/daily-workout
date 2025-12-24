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
  // OpenAI response ID for conversation context when regenerating
  responseId: z.string().optional(),
});
export type TodayPlan = z.infer<typeof todayPlanSchema>;

export const llmTodayPlanSchema = todayPlanBaseSchema;
export type LlmTodayPlan = z.infer<typeof llmTodayPlanSchema>;

// Flattened LLM schema (v2-flat): blocks and exercises are separate top-level arrays
// This reduces nesting depth to <= 3 levels for better provider compatibility
export const llmWorkoutBlockFlatSchema = z.object({
  title: z.string(),
  durationMinutes: z.number().int().positive(),
  focus: z.string(),
});
export type LlmWorkoutBlockFlat = z.infer<typeof llmWorkoutBlockFlatSchema>;

export const llmWorkoutExerciseFlatSchema = z.object({
  blockIndex: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
  name: z.string(),
  prescription: z.string(),
  detail: z.string().nullable(),
});
export type LlmWorkoutExerciseFlat = z.infer<typeof llmWorkoutExerciseFlatSchema>;

const llmTodayPlanFlatBaseSchema = z.object({
  focus: z.string(),
  durationMinutes: z.number().int().positive(),
  equipment: z.array(z.string()),
  source: workoutSourceSchema,
  energy: workoutEnergySchema,
  summary: z.string(),
  blocks: z.array(llmWorkoutBlockFlatSchema).min(1),
  exercises: z.array(llmWorkoutExerciseFlatSchema).min(1),
});

export const llmTodayPlanFlatSchema = llmTodayPlanFlatBaseSchema;
export type LlmTodayPlanFlat = z.infer<typeof llmTodayPlanFlatSchema>;

export const workoutSessionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  completedAt: z.string(), // ISO timestamp
  durationMinutes: z.number().int().positive(),
  focus: z.string(),
  source: workoutSourceSchema.optional(),
  // When set, the session is archived/hidden from recency contexts
  archivedAt: z.string().optional(),
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

const QUICK_ACTION_TIME_MINUTES = [15, 20, 30, 45, 60];
const WORKOUT_ENERGY_VALUES = new Set(workoutEnergySchema.options);
const BACKFILL_TRUE_VALUES = new Set(['true', 'yes', '1', 'y']);
const BACKFILL_FALSE_VALUES = new Set(['false', 'no', '0', 'n']);
const MAX_FOCUS_LENGTH = 80;

const clampTimeMinutes = (value: number): number | undefined => {
  const valid = QUICK_ACTION_TIME_MINUTES.find((option) => option === value);
  if (valid) {
    return valid;
  }

  if (Number.isFinite(value)) {
    const clamped = Math.min(Math.max(value, 5), 120);
    return Math.round(clamped);
  }

  return undefined;
};

const sanitizeFocus = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, MAX_FOCUS_LENGTH);
};

const sanitizeEquipmentList = (value: string): string[] | undefined => {
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) {
    return undefined;
  }
  return tokens;
};

const sanitizeEnergy = (value: string): WorkoutEnergy | undefined => {
  const normalized = value.trim().toLowerCase() as WorkoutEnergy;
  return WORKOUT_ENERGY_VALUES.has(normalized) ? normalized : undefined;
};

const sanitizeBackfill = (value: string): boolean | undefined => {
  const normalized = value.trim().toLowerCase();
  if (BACKFILL_TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (BACKFILL_FALSE_VALUES.has(normalized)) {
    return false;
  }

  return undefined;
};

const coerceNumber = (value: string): number | undefined => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const normalizeQuickActionValue = (
  action: QuickActionPreset,
): Partial<GenerationRequest> => {
  // For equipment, only use stagedValue (explicit user choice), not the default display value.
  // This allows the API layer to fall back to user profile equipment when not explicitly set.
  const source = action.key === 'equipment'
    ? action.stagedValue
    : (action.stagedValue ?? action.value);

  if (!source) {
    return {};
  }

  switch (action.key) {
    case 'time': {
      const minutes = source ? clampTimeMinutes(coerceNumber(source) ?? NaN) : undefined;
      return minutes ? { timeMinutes: minutes } : {};
    }
    case 'focus': {
      const focus = sanitizeFocus(source);
      if (focus === 'Smart') return {};
      return focus ? { focus } : {};
    }
    case 'equipment': {
      const equipment = sanitizeEquipmentList(source);
      return equipment ? { equipment } : {};
    }
    case 'energy': {
      const energy = sanitizeEnergy(source);
      return energy ? { energy } : {};
    }
    case 'backfill': {
      const backfill = sanitizeBackfill(source);
      return backfill === undefined ? {} : { backfill };
    }
    default:
      return {};
  }
};

export const buildGenerationRequestFromQuickActions = (
  quickActions: QuickActionPreset[],
  base: Partial<GenerationRequest> = {},
): GenerationRequest => {
  const request: Partial<GenerationRequest> = { ...base };

  quickActions.forEach((action) => {
    Object.assign(request, normalizeQuickActionValue(action));
  });

  return request as GenerationRequest;
};

/**
 * Feedback options when regenerating a workout
 */
export const regenerationFeedbackSchema = z.enum([
  'too-hard',
  'too-easy',
  'different-exercises',
  'just-try-again',
]);
export type RegenerationFeedback = z.infer<typeof regenerationFeedbackSchema>;

export const aiProviderSchema = z
  .object({
    name: z.enum(['openai', 'gemini']),
    model: z.string().optional(),
  })
  .strict();
export type AiProvider = z.infer<typeof aiProviderSchema>;

export const generationRequestSchema = z
  .object({
    timeMinutes: z.number().int().positive().optional(),
    focus: z.string().optional(),
    equipment: z.array(z.string()).optional(),
    energy: workoutEnergySchema.optional(),
    backfill: z.boolean().optional(),
    notes: z.string().optional(),
    // For regeneration: link to previous conversation
    previousResponseId: z.string().optional(),
    // For regeneration: user feedback about what was wrong
    feedback: z.array(regenerationFeedbackSchema).optional(),
    // Optional provider selection and model override
    provider: aiProviderSchema.optional(),
  })
  .strict();
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

const generationContextSessionSchema = workoutSessionSummarySchema.extend({
  perceivedEffort: workoutEnergySchema.optional(),
  notes: z.string().optional(),
});

export const experienceLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;

/**
 * User preferences stored locally on the device.
 * This is the source of truth for profile data that feeds into GenerationContext.
 */
export const userPreferencesSchema = z.object({
  // Equipment the user has access to (profile default)
  equipment: z.array(z.string()).default([]),
  // Experience level
  experienceLevel: experienceLevelSchema.optional(),
  // Primary fitness goal
  primaryGoal: z.string().optional(),
  // Injuries or constraints to avoid
  injuries: z.array(z.string()).default([]),
  // Preferred workout style (optional)
  preferredStyle: z.string().optional(),
  // Focus areas to bias towards
  focusBias: z.array(z.string()).default([]),
  // Exercises or movements to avoid
  avoid: z.array(z.string()).default([]),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

/**
 * Predefined equipment options for the profile selector
 */
export const EQUIPMENT_OPTIONS = [
  'Bodyweight',
  'Dumbbells',
  'Barbell',
  'Kettlebells',
  'Pull-up Bar',
  'Resistance Bands',
  'Cable Machine',
  'Bench',
  'Squat Rack',
  'Treadmill',
  'Rowing Machine',
  'Jump Rope',
] as const;

export const generationContextSchema = z.object({
  userProfile: z.object({
    experienceLevel: experienceLevelSchema.optional(),
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
  archivedAt: undefined,
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
