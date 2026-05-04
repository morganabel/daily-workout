import { z } from 'zod';

export const workoutEnergySchema = z.enum(['easy', 'moderate', 'intense']);
export type WorkoutEnergy = z.infer<typeof workoutEnergySchema>;

export const workoutSourceSchema = z.enum(['ai', 'manual']);
export type WorkoutSource = z.infer<typeof workoutSourceSchema>;

export const aiProviderNameSchema = z.enum(['openai', 'gemini']);
export type AiProviderName = z.infer<typeof aiProviderNameSchema>;

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
  // Provider response ID for continuity-aware regeneration.
  responseId: z.string().optional(),
  generationProvenance: z
    .object({
      provider: aiProviderNameSchema,
      responseId: z.string().optional(),
    })
    .strict()
    .optional(),
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
export type LlmWorkoutExerciseFlat = z.infer<
  typeof llmWorkoutExerciseFlatSchema
>;

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

export const weightUnitSchema = z.enum(['lb', 'kg']);
export type WeightUnit = z.infer<typeof weightUnitSchema>;

export const workoutSetLogSchema = z
  .object({
    id: z.string(),
    order: z.number().int().nonnegative(),
    completed: z.boolean(),
    reps: z.number().int().nonnegative().optional(),
    weight: z.number().nonnegative().optional(),
    weightUnit: weightUnitSchema.optional(),
    rpe: z.number().int().min(1).max(10).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.weight !== undefined &&
      value.weight !== null &&
      !value.weightUnit
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'weightUnit is required when weight is present',
        path: ['weightUnit'],
      });
    }
  });
export type WorkoutSetLog = z.infer<typeof workoutSetLogSchema>;

export const workoutExerciseLogSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().int().nonnegative(),
  blockId: z.string().optional(),
  blockTitle: z.string().optional(),
  blockFocus: z.string().optional(),
  blockOrder: z.number().int().nonnegative().optional(),
  prescription: z.string().optional(),
  detail: z.string().nullable().optional(),
  sets: z.array(workoutSetLogSchema),
});
export type WorkoutExerciseLog = z.infer<typeof workoutExerciseLogSchema>;

export const workoutSessionSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  completedAt: z.string(), // ISO timestamp
  durationMinutes: z.number().int().positive(),
  focus: z.string(),
  source: workoutSourceSchema.optional(),
  // When set, the session is archived/hidden from recency contexts
  archivedAt: z.string().optional(),
  isFavorite: z.boolean().optional(),
});
export type WorkoutSessionSummary = z.infer<typeof workoutSessionSummarySchema>;

export const workoutSessionDetailSchema = workoutSessionSummarySchema.extend({
  exercises: z.array(workoutExerciseLogSchema),
});
export type WorkoutSessionDetail = z.infer<typeof workoutSessionDetailSchema>;

export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type LocalDate = z.infer<typeof localDateSchema>;

export const timezoneSchema = z.string().min(1);
export type Timezone = z.infer<typeof timezoneSchema>;

export const canonicalEventKinds = [
  'workout',
  'hike',
  'run',
  'sport',
  'rest',
  'travel',
  'other',
] as const;
export type CanonicalEventKind = (typeof canonicalEventKinds)[number];
export const canonicalEventKindSchema = z.enum(canonicalEventKinds);

export const plannedEventIntensitySchema = z.enum(['low', 'moderate', 'high']);
export type PlannedEventIntensity = z.infer<typeof plannedEventIntensitySchema>;

export const GYM_EQUIPMENT = 'Gym';

export const onboardingGoalSchema = z.enum([
  'general-fitness',
  'build-muscle',
  'build-strength',
  'lose-fat',
  'run-cardio',
  'mobility',
]);
export type OnboardingGoal = z.infer<typeof onboardingGoalSchema>;

export const trainingEnvironmentSchema = z.enum([
  'home',
  'gym',
  'outdoors',
  'travel',
]);
export type TrainingEnvironment = z.infer<typeof trainingEnvironmentSchema>;

export const onboardingAnswersSchema = z
  .object({
    goal: onboardingGoalSchema,
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    environment: trainingEnvironmentSchema,
    equipment: z.array(z.string()).default([]),
  })
  .strict();
export type OnboardingAnswers = z.infer<typeof onboardingAnswersSchema>;

export const trainingTemplateIdSchema = z.enum([
  'balanced-foundation',
  'strength-foundation',
  'ppl-conditioning',
  'endurance-support',
  'busy-travel',
]);
export type TrainingTemplateId = z.infer<typeof trainingTemplateIdSchema>;

export const starterWeekSlotRoleSchema = z.enum([
  'pull',
  'push',
  'legs',
  'sprint',
  'mobility',
  'recovery',
  'conditioning',
  'full-body',
  'flexible',
]);
export type StarterWeekSlotRole = z.infer<typeof starterWeekSlotRoleSchema>;

export const plannedSlotDetailStateSchema = z.enum([
  'not-generated',
  'generating',
  'generated',
  'error',
]);
export type PlannedSlotDetailState = z.infer<
  typeof plannedSlotDetailStateSchema
>;

export const durationAssumptionsSchema = z
  .object({
    targetMinutes: z.number().int().positive(),
    minimumUsefulMinutes: z.number().int().positive(),
  })
  .strict();
export type DurationAssumptions = z.infer<typeof durationAssumptionsSchema>;

export const equipmentLocationAssumptionsSchema = z
  .object({
    environment: trainingEnvironmentSchema,
    equipment: z.array(z.string()).default([]),
  })
  .strict();
export type EquipmentLocationAssumptions = z.infer<
  typeof equipmentLocationAssumptionsSchema
>;

export const trainingBlueprintSetupStatusSchema = z.enum([
  'completed',
  'skipped',
]);
export type TrainingBlueprintSetupStatus = z.infer<
  typeof trainingBlueprintSetupStatusSchema
>;

export const trainingBlueprintEditStatusSchema = z.enum([
  'accepted',
  'adjusted',
  'edited',
]);
export type TrainingBlueprintEditStatus = z.infer<
  typeof trainingBlueprintEditStatusSchema
>;

export const starterWeekSlotSchema = z
  .object({
    id: z.string(),
    role: starterWeekSlotRoleSchema,
    label: z.string(),
    dayOffset: z.number().int().min(0).max(13),
    targetDurationMinutes: z.number().int().positive(),
  })
  .strict();
export type StarterWeekSlot = z.infer<typeof starterWeekSlotSchema>;

export const trainingBlueprintSchema = z
  .object({
    templateId: trainingTemplateIdSchema,
    onboardingAnswers: onboardingAnswersSchema.optional(),
    weeklyRhythm: z.string(),
    durationAssumptions: durationAssumptionsSchema,
    equipmentLocationAssumptions: equipmentLocationAssumptionsSchema,
    slotSequence: z.array(starterWeekSlotSchema).min(1),
    setupStatus: trainingBlueprintSetupStatusSchema,
    editStatus: trainingBlueprintEditStatusSchema.optional(),
    horizonDays: z.number().int().positive().default(7),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();
export type TrainingBlueprint = z.infer<typeof trainingBlueprintSchema>;

export const plannedSlotMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    ownership: z.literal('app'),
    source: z.literal('training-blueprint'),
    templateId: trainingTemplateIdSchema,
    slotId: z.string(),
    slotRole: starterWeekSlotRoleSchema,
    slotLabel: z.string(),
    plannedDate: localDateSchema,
    targetDurationMinutes: z.number().int().positive(),
    equipmentLocationAssumptions: equipmentLocationAssumptionsSchema,
    detailState: plannedSlotDetailStateSchema,
    locked: z.boolean().default(false),
    userEdited: z.boolean().default(false),
    linkedWorkoutId: z.string().optional(),
  })
  .strict();
export type PlannedSlotMetadata = z.infer<typeof plannedSlotMetadataSchema>;

export const plannedSlotIntentSchema = z
  .object({
    role: starterWeekSlotRoleSchema,
    label: z.string().optional(),
    targetDurationMinutes: z.number().int().positive().optional(),
    equipmentLocationAssumptions: equipmentLocationAssumptionsSchema.optional(),
    plannedDate: localDateSchema.optional(),
    templateId: trainingTemplateIdSchema.optional(),
    slotId: z.string().optional(),
  })
  .strict();
export type PlannedSlotIntent = z.infer<typeof plannedSlotIntentSchema>;

export const trainingTemplateDefinitionSchema = z
  .object({
    id: trainingTemplateIdSchema,
    name: z.string(),
    summary: z.string(),
    weeklyRhythm: z.string(),
    durationAssumptions: durationAssumptionsSchema,
    slotSequence: z.array(starterWeekSlotSchema).min(1),
  })
  .strict();
export type TrainingTemplateDefinition = z.infer<
  typeof trainingTemplateDefinitionSchema
>;

const createSlot = (
  dayOffset: number,
  role: StarterWeekSlotRole,
  label: string,
  targetDurationMinutes: number,
): StarterWeekSlot => ({
  id: `day-${dayOffset + 1}-${role}`,
  role,
  label,
  dayOffset,
  targetDurationMinutes,
});

export const TRAINING_TEMPLATE_DEFINITIONS = {
  'balanced-foundation': {
    id: 'balanced-foundation',
    name: 'Balanced foundation',
    summary: 'A simple mix of strength, conditioning, mobility, and recovery.',
    weeklyRhythm: '3 strength / conditioning days, 2 recovery or mobility days',
    durationAssumptions: { targetMinutes: 35, minimumUsefulMinutes: 20 },
    slotSequence: [
      createSlot(0, 'full-body', 'Full body strength', 35),
      createSlot(1, 'recovery', 'Recovery', 20),
      createSlot(2, 'conditioning', 'Conditioning', 30),
      createSlot(3, 'full-body', 'Full body strength', 35),
      createSlot(4, 'mobility', 'Mobility', 20),
      createSlot(5, 'flexible', 'Flexible workout', 30),
      createSlot(6, 'recovery', 'Recovery', 20),
    ],
  },
  'strength-foundation': {
    id: 'strength-foundation',
    name: 'Strength foundation',
    summary: 'Full-body strength exposures with enough recovery to progress.',
    weeklyRhythm: '3 strength days, 1 conditioning day, recovery between harder days',
    durationAssumptions: { targetMinutes: 45, minimumUsefulMinutes: 30 },
    slotSequence: [
      createSlot(0, 'full-body', 'Full body strength', 45),
      createSlot(1, 'recovery', 'Recovery', 20),
      createSlot(2, 'full-body', 'Full body strength', 45),
      createSlot(3, 'conditioning', 'Conditioning', 30),
      createSlot(4, 'full-body', 'Full body strength', 45),
      createSlot(5, 'mobility', 'Mobility', 20),
      createSlot(6, 'recovery', 'Recovery', 20),
    ],
  },
  'ppl-conditioning': {
    id: 'ppl-conditioning',
    name: 'Lift conditioning',
    summary: 'Lifting days with one sprint or conditioning exposure.',
    weeklyRhythm: '3 lift days plus one sprint day',
    durationAssumptions: { targetMinutes: 50, minimumUsefulMinutes: 35 },
    slotSequence: [
      createSlot(0, 'full-body', 'Lift', 50),
      createSlot(1, 'full-body', 'Lift', 50),
      createSlot(2, 'full-body', 'Lift', 50),
      createSlot(3, 'recovery', 'Recovery', 20),
      createSlot(4, 'sprint', 'Sprint conditioning', 30),
      createSlot(5, 'mobility', 'Mobility', 20),
      createSlot(6, 'recovery', 'Recovery', 20),
    ],
  },
  'endurance-support': {
    id: 'endurance-support',
    name: 'Endurance support',
    summary: 'Cardio-forward training with strength support and recovery.',
    weeklyRhythm: '2 cardio days, 2 support strength days, mobility and recovery',
    durationAssumptions: { targetMinutes: 40, minimumUsefulMinutes: 25 },
    slotSequence: [
      createSlot(0, 'conditioning', 'Easy cardio', 40),
      createSlot(1, 'mobility', 'Mobility', 20),
      createSlot(2, 'full-body', 'Strength support', 35),
      createSlot(3, 'recovery', 'Recovery', 20),
      createSlot(4, 'sprint', 'Intervals', 30),
      createSlot(5, 'full-body', 'Strength support', 35),
      createSlot(6, 'recovery', 'Recovery', 20),
    ],
  },
  'busy-travel': {
    id: 'busy-travel',
    name: 'Busy travel',
    summary: 'Short, low-friction sessions for minimal equipment or travel weeks.',
    weeklyRhythm: 'Short strength, mobility, and flexible conditioning sessions',
    durationAssumptions: { targetMinutes: 25, minimumUsefulMinutes: 15 },
    slotSequence: [
      createSlot(0, 'full-body', 'Bodyweight strength', 25),
      createSlot(1, 'mobility', 'Mobility', 15),
      createSlot(2, 'recovery', 'Recovery', 15),
      createSlot(3, 'conditioning', 'Quick conditioning', 20),
      createSlot(4, 'full-body', 'Bodyweight strength', 25),
      createSlot(5, 'flexible', 'Flexible movement', 20),
      createSlot(6, 'recovery', 'Recovery', 15),
    ],
  },
} satisfies Record<TrainingTemplateId, TrainingTemplateDefinition>;

const minimalEquipment = new Set(['Bodyweight', 'Resistance Bands', 'Jump Rope']);

export const selectTrainingTemplateId = (
  answers: OnboardingAnswers,
): TrainingTemplateId => {
  const hasGymAccess =
    answers.environment === 'gym' || answers.equipment.includes(GYM_EQUIPMENT);
  const onlyMinimalEquipment =
    answers.equipment.length > 0 &&
    answers.equipment.every((item) => minimalEquipment.has(item));

  if (answers.goal === 'run-cardio') {
    return 'endurance-support';
  }

  if (answers.goal === 'build-strength') {
    return 'strength-foundation';
  }

  if (
    answers.goal === 'build-muscle' &&
    hasGymAccess &&
    answers.experienceLevel !== 'beginner'
  ) {
    return 'ppl-conditioning';
  }

  if (answers.goal === 'mobility') {
    return 'busy-travel';
  }

  if (answers.environment === 'travel' || onlyMinimalEquipment) {
    return 'busy-travel';
  }

  return 'balanced-foundation';
};

export const createTrainingBlueprintFromOnboarding = (
  answers: OnboardingAnswers,
  options: {
    editStatus?: TrainingBlueprintEditStatus;
    horizonDays?: number;
    updatedAt?: string;
  } = {},
): TrainingBlueprint => {
  const template = TRAINING_TEMPLATE_DEFINITIONS[selectTrainingTemplateId(answers)];

  return trainingBlueprintSchema.parse({
    templateId: template.id,
    onboardingAnswers: answers,
    weeklyRhythm: template.weeklyRhythm,
    durationAssumptions: template.durationAssumptions,
    equipmentLocationAssumptions: {
      environment: answers.environment,
      equipment: answers.equipment,
    },
    slotSequence: template.slotSequence,
    setupStatus: 'completed',
    editStatus: options.editStatus ?? 'accepted',
    horizonDays: options.horizonDays ?? 7,
    updatedAt: options.updatedAt,
  });
};

export const plannedEventInputSchema = z.object({
  kind: z.string(),
  title: z.string(),
  localDate: localDateSchema,
  createdAtTimezone: timezoneSchema,
  startsAt: z.number().int().positive().optional(),
  endsAt: z.number().int().positive().optional(),
  allDay: z.boolean().optional(),
  durationMinutes: z.number().int().positive().optional(),
  intensity: plannedEventIntensitySchema.optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.enum(['planned', 'canceled']).optional(),
  linkedWorkoutId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PlannedEventInput = z.infer<typeof plannedEventInputSchema>;

export const plannedEventSchema = plannedEventInputSchema.extend({
  id: z.string(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  archivedAt: z.number().int().positive().optional(),
});
export type PlannedEvent = z.infer<typeof plannedEventSchema>;

export const plannedEventPatchSchema = plannedEventInputSchema
  .partial()
  .extend({
    id: z.string(),
  });
export type PlannedEventPatch = z.infer<typeof plannedEventPatchSchema>;

export const calendarItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('workout-session'),
    localDate: localDateSchema,
    sessionId: z.string(),
    title: z.string(),
    completedAt: z.string().datetime().optional(),
    durationMinutes: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('planned-event'),
    localDate: localDateSchema,
    eventId: z.string(),
    kind: z.string(),
    title: z.string(),
    startsAt: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
  }),
]);
export type CalendarItem = z.infer<typeof calendarItemSchema>;

export const upcomingEventContextSchema = z.object({
  kind: z.string(),
  title: z.string(),
  localDate: localDateSchema,
  startsAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  allDay: z.boolean().optional(),
  intensity: plannedEventIntensitySchema.optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpcomingEventContext = z.infer<typeof upcomingEventContextSchema>;

export const MAX_UPCOMING_EVENTS = 10;

export const workoutLogPayloadSchema = z
  .object({
    completedAt: z.string().optional(),
    durationSeconds: z.number().int().nonnegative().optional(),
    exercises: z.array(workoutExerciseLogSchema).optional(),
  })
  .strict();
export type WorkoutLogPayload = z.infer<typeof workoutLogPayloadSchema>;

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

export function normalizeEquipmentSelection(
  equipment: string[],
  fallback: string[] = [],
): string[] {
  const normalized = [
    ...new Set(equipment.map((item) => item.trim()).filter(Boolean)),
  ];

  if (normalized.some((item) => item.toLowerCase() === 'gym')) {
    return [GYM_EQUIPMENT];
  }

  return normalized.length ? normalized : fallback;
}

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

/**
 * Checks if a focus value represents an "auto" or "smart" selection,
 * meaning the AI should choose the most appropriate focus based on context.
 */
export const isAutoFocus = (focus?: string): boolean =>
  Boolean(focus && ['smart', 'auto'].includes(focus.trim().toLowerCase()));

const sanitizeEquipmentList = (value: string): string[] | undefined => {
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) {
    return undefined;
  }
  return normalizeEquipmentSelection(tokens);
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
  const source =
    action.key === 'equipment'
      ? action.stagedValue
      : (action.stagedValue ?? action.value);

  if (!source) {
    return {};
  }

  switch (action.key) {
    case 'time': {
      const minutes = source
        ? clampTimeMinutes(coerceNumber(source) ?? NaN)
        : undefined;
      return minutes ? { timeMinutes: minutes } : {};
    }
    case 'focus': {
      const focus = sanitizeFocus(source);
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
    name: aiProviderNameSchema,
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
    planningDateLocal: localDateSchema.optional(),
    // For regeneration: link to previous conversation
    previousResponseId: z.string().optional(),
    // For regeneration: explicit baseline workout for stateless providers
    baselineWorkout: todayPlanSchema.optional(),
    // For regeneration: user feedback about what was wrong
    feedback: z.array(regenerationFeedbackSchema).optional(),
    // Optional upcoming events context (bounded)
    upcomingEvents: z
      .array(upcomingEventContextSchema)
      .max(MAX_UPCOMING_EVENTS)
      .optional(),
    // Optional explicit intent when generating from a blueprint-owned planned slot.
    plannedSlotIntent: plannedSlotIntentSchema.optional(),
    // Optional provider selection and model override
    provider: aiProviderSchema.optional(),
  })
  .strict();
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

const generationContextSessionSchema = workoutSessionSummarySchema.extend({
  perceivedEffort: workoutEnergySchema.optional(),
  notes: z.string().optional(),
});

export const experienceLevelSchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
]);
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
  // First-run onboarding answers and setup state for template-based planning.
  onboardingAnswers: onboardingAnswersSchema.optional(),
  onboardingSetupStatus: trainingBlueprintSetupStatusSchema.optional(),
  // Accepted or adjusted template-derived training structure.
  trainingBlueprint: trainingBlueprintSchema.optional(),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

/**
 * Predefined equipment options for the profile selector
 */
export const EQUIPMENT_OPTIONS = [
  GYM_EQUIPMENT,
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

export const generationRequestPayloadSchema = generationRequestSchema.extend({
  context: generationContextSchema.optional(),
});
export type GenerationRequestPayload = z.infer<
  typeof generationRequestPayloadSchema
>;

export const quickLogPayloadSchema = z.object({
  name: z.string(),
  focus: z.string(),
  durationMinutes: z.number().int().positive(),
  note: z.string().optional(),
  completedAt: z.string().optional(),
});
export type QuickLogPayload = z.infer<typeof quickLogPayloadSchema>;

export const createTodayPlanMock = (
  overrides: Partial<TodayPlan> = {},
): TodayPlan => ({
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

export const createWorkoutSetLogMock = (
  overrides: Partial<WorkoutSetLog> = {},
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

export const createWorkoutExerciseLogMock = (
  overrides: Partial<WorkoutExerciseLog> = {},
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
  sets: [createWorkoutSetLogMock()],
  ...overrides,
});

export const createSessionDetailMock = (
  overrides: Partial<WorkoutSessionDetail> = {},
): WorkoutSessionDetail => ({
  ...createSessionSummaryMock(),
  exercises: [createWorkoutExerciseLogMock()],
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
      equipment: overrides.environment?.equipment ?? base.environment.equipment,
    },
    recentSessions: overrides.recentSessions ?? base.recentSessions,
    notes: overrides.notes ?? base.notes,
  };
};
