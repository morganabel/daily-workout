import { z } from 'zod';

export const workoutEnergySchema = z.enum(['easy', 'moderate', 'intense']);
export type WorkoutEnergy = z.infer<typeof workoutEnergySchema>;

export const workoutSourceSchema = z.enum(['ai', 'manual', 'library']);
export type WorkoutSource = z.infer<typeof workoutSourceSchema>;

export const workoutCreationModeSchema = z.enum(['auto', 'library', 'ai']);
export type WorkoutCreationMode = z.infer<typeof workoutCreationModeSchema>;

export const aiProviderNameSchema = z.enum(['openai', 'gemini']);
export type AiProviderName = z.infer<typeof aiProviderNameSchema>;

export const coachScheduleStrategySchema = z.enum([
  'ordered-rotation',
  'weekly-target-balance',
  'fixed-calendar',
  'minimum-effective-dose',
  'event-prep',
]);
export type CoachScheduleStrategy = z.infer<typeof coachScheduleStrategySchema>;

export const coachAttributionSourceKindSchema = z.enum([
  'generated',
  'manual-log',
  'quick-log',
  'substitution',
  'legacy-inferred',
]);
export type CoachAttributionSourceKind = z.infer<
  typeof coachAttributionSourceKindSchema
>;

export const coachAttributionConfidenceSchema = z.enum([
  'high',
  'medium',
  'low',
]);
export type CoachAttributionConfidence = z.infer<
  typeof coachAttributionConfidenceSchema
>;

export const coachProgramAttributionSchema = z
  .object({
    programId: z.string().min(1),
    programVersion: z.number().int().positive(),
    sourceBlockId: z.string().min(1).optional(),
    addOnBlockIds: z.array(z.string().min(1)).optional(),
    templateId: z.string().min(1).optional(),
    projectionId: z.string().min(1).optional(),
    scheduleStrategy: coachScheduleStrategySchema,
    sourceKind: coachAttributionSourceKindSchema,
    confidence: coachAttributionConfidenceSchema,
  })
  .strict();
export type CoachProgramAttribution = z.infer<
  typeof coachProgramAttributionSchema
>;

export const coachStrategySelectionSchema = z
  .object({
    strategy: coachScheduleStrategySchema,
    reason: z.string().min(1),
  })
  .strict();
export type CoachStrategySelection = z.infer<
  typeof coachStrategySelectionSchema
>;

export const coachProgramRevisionSchema = z
  .object({
    version: z.number().int().positive(),
    previousVersion: z.number().int().positive().optional(),
    scheduleStrategy: coachScheduleStrategySchema,
    previousScheduleStrategy: coachScheduleStrategySchema.optional(),
    reason: z.string().min(1),
    createdAt: z.string().datetime(),
  })
  .strict();
export type CoachProgramRevision = z.infer<typeof coachProgramRevisionSchema>;

export const catalogMatchDecisionSchema = z.enum(['direct', 'adapt', 'none']);
export type CatalogMatchDecision = z.infer<typeof catalogMatchDecisionSchema>;

export const workoutCatalogProvenanceSchema = z
  .object({
    recipeId: z.string(),
    recipeSlug: z.string(),
    ownership: z.string(),
    catalogVersion: z.string(),
    matchDecision: catalogMatchDecisionSchema,
    returnedDirect: z.boolean(),
  })
  .strict();
export type WorkoutCatalogProvenance = z.infer<
  typeof workoutCatalogProvenanceSchema
>;

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
  catalogProvenance: workoutCatalogProvenanceSchema.optional(),
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
  coachProgramAttribution: coachProgramAttributionSchema.optional(),
  catalogProvenance: workoutCatalogProvenanceSchema.optional(),
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
  'balanced-starter',
  'balanced-foundation',
  'balanced-performance',
  'strength-starter',
  'strength-foundation',
  'strength-performance',
  'hypertrophy-starter',
  'hypertrophy-foundation',
  'upper-lower-hypertrophy',
  'ppl-hypertrophy',
  'ppl-conditioning',
  'fat-loss-conditioning',
  'endurance-support',
  'mobility-foundation',
  'busy-travel',
]);
export type TrainingTemplateId = z.infer<typeof trainingTemplateIdSchema>;

export const starterWeekSlotRoleSchema = z.enum([
  'upper',
  'lower',
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
    coachStrategySelection: coachStrategySelectionSchema.optional(),
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

export const adaptiveTrainingPlanSchemaVersionSchema = z.literal(1);
export type AdaptiveTrainingPlanSchemaVersion = z.infer<
  typeof adaptiveTrainingPlanSchemaVersionSchema
>;

export const adaptiveTrainingPlanModeSchema = z.enum(['adaptive']);
export type AdaptiveTrainingPlanMode = z.infer<
  typeof adaptiveTrainingPlanModeSchema
>;

export const adaptiveTrainingPlanStatusSchema = z.enum([
  'active',
  'paused',
  'archived',
]);
export type AdaptiveTrainingPlanStatus = z.infer<
  typeof adaptiveTrainingPlanStatusSchema
>;

export const adaptiveTrainingBlockCategorySchema = z.enum([
  'strength',
  'cardio',
  'conditioning',
  'mobility',
  'recovery',
  'accessory',
  'rest',
]);
export type AdaptiveTrainingBlockCategory = z.infer<
  typeof adaptiveTrainingBlockCategorySchema
>;

export const adaptiveTrainingTargetPrioritySchema = z.enum([
  'primary',
  'secondary',
  'optional',
]);
export type AdaptiveTrainingTargetPriority = z.infer<
  typeof adaptiveTrainingTargetPrioritySchema
>;

export const adaptiveProjectionStatusSchema = z.enum([
  'preferred',
  'projected',
  'pinned',
]);
export type AdaptiveProjectionStatus = z.infer<
  typeof adaptiveProjectionStatusSchema
>;

export const adaptiveWeekdaySchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
export type AdaptiveWeekday = z.infer<typeof adaptiveWeekdaySchema>;

export const adaptiveTypicalWeekFlexibilitySchema = z.enum([
  'flexible',
  'preferred',
  'pinned',
]);
export type AdaptiveTypicalWeekFlexibility = z.infer<
  typeof adaptiveTypicalWeekFlexibilitySchema
>;

export const adaptiveTargetContributionSchema = z
  .object({
    targetId: z.string().min(1),
    count: z.number().positive(),
  })
  .strict();
export type AdaptiveTargetContribution = z.infer<
  typeof adaptiveTargetContributionSchema
>;

export const adaptiveTrainingBlockSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    role: z.string().min(1),
    category: adaptiveTrainingBlockCategorySchema,
    stressTags: z.array(z.string().min(1)).default([]),
    defaultDurationMinutes: z.number().int().positive(),
    targetContributions: z.array(adaptiveTargetContributionSchema).default([]),
    compatibleAddOnBlockIds: z.array(z.string().min(1)).default([]),
    conflictsWithBlockIds: z.array(z.string().min(1)).default([]),
    recoveryGuidance: z.string().optional(),
  })
  .strict();
export type AdaptiveTrainingBlock = z.infer<typeof adaptiveTrainingBlockSchema>;

export const adaptiveTargetAppliesToSchema = z
  .object({
    blockIds: z.array(z.string().min(1)).default([]),
    categories: z.array(adaptiveTrainingBlockCategorySchema).default([]),
    stressTags: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type AdaptiveTargetAppliesTo = z.infer<
  typeof adaptiveTargetAppliesToSchema
>;

export const adaptiveTargetRangeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    appliesTo: adaptiveTargetAppliesToSchema,
    windowDays: z.number().int().positive(),
    minCount: z.number().int().nonnegative(),
    maxCount: z.number().int().nonnegative(),
    idealCount: z.number().int().nonnegative().optional(),
    priority: adaptiveTrainingTargetPrioritySchema,
  })
  .strict()
  .superRefine((range, ctx) => {
    if (range.minCount > range.maxCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minCount must be less than or equal to maxCount',
        path: ['minCount'],
      });
    }

    if (
      range.idealCount !== undefined &&
      (range.idealCount < range.minCount || range.idealCount > range.maxCount)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'idealCount must be inside minCount and maxCount',
        path: ['idealCount'],
      });
    }
  });
export type AdaptiveTargetRange = z.infer<typeof adaptiveTargetRangeSchema>;

export const adaptiveTypicalWeekPreferenceSchema = z
  .object({
    dayOfWeek: adaptiveWeekdaySchema,
    preferredBlockIds: z.array(z.string().min(1)).min(1),
    flexibility: adaptiveTypicalWeekFlexibilitySchema,
  })
  .strict();
export type AdaptiveTypicalWeekPreference = z.infer<
  typeof adaptiveTypicalWeekPreferenceSchema
>;

export const adaptivePlanSessionPreferenceSchema = z
  .object({
    id: z.string().min(1),
    localDate: localDateSchema,
    blockIds: z.array(z.string().min(1)).min(1),
    status: adaptiveProjectionStatusSchema,
    note: z.string().optional(),
  })
  .strict();
export type AdaptivePlanSessionPreference = z.infer<
  typeof adaptivePlanSessionPreferenceSchema
>;

export const adaptiveRecommendationSettingsSchema = z
  .object({
    preferredRotationBlockIds: z.array(z.string().min(1)).default([]),
    allowCompatibleAddOns: z.boolean().default(true),
    protectUpcomingLowerBodyDays: z.number().int().nonnegative().default(1),
  })
  .strict();
export type AdaptiveRecommendationSettings = z.infer<
  typeof adaptiveRecommendationSettingsSchema
>;

export const adaptivePlanTargetProgressSchema = z
  .object({
    targetId: z.string().min(1),
    label: z.string().min(1),
    count: z.number().nonnegative(),
    minCount: z.number().int().nonnegative(),
    maxCount: z.number().int().nonnegative(),
    windowDays: z.number().int().positive(),
  })
  .strict();
export type AdaptivePlanTargetProgress = z.infer<
  typeof adaptivePlanTargetProgressSchema
>;

export const adaptiveRecommendationRationaleSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();
export type AdaptiveRecommendationRationale = z.infer<
  typeof adaptiveRecommendationRationaleSchema
>;

export const adaptivePlanRecommendationSchema = z
  .object({
    id: z.string().min(1),
    planId: z.string().min(1),
    planningDateLocal: localDateSchema,
    primaryBlockId: z.string().min(1),
    addOnBlockIds: z.array(z.string().min(1)).default([]),
    alternativeBlockIds: z.array(z.string().min(1)).default([]),
    targetProgress: z.array(adaptivePlanTargetProgressSchema).default([]),
    rationale: z.array(adaptiveRecommendationRationaleSchema).min(1),
    coachNotes: z.array(z.string().min(1)).default([]),
    projectionStatus: adaptiveProjectionStatusSchema.optional(),
  })
  .strict();
export type AdaptivePlanRecommendation = z.infer<
  typeof adaptivePlanRecommendationSchema
>;

export const coachProjectionSessionStatusSchema = z.enum([
  'projected',
  'pinned',
  'skipped',
  'repaired',
  'conflict',
]);
export type CoachProjectionSessionStatus = z.infer<
  typeof coachProjectionSessionStatusSchema
>;

export const coachProjectionActionTypeSchema = z.enum([
  'skip',
  'pin',
  'unpin',
  'move',
  'generate',
  'keep-pinned',
]);
export type CoachProjectionActionType = z.infer<
  typeof coachProjectionActionTypeSchema
>;

export const coachProjectionConflictWarningSchema = z
  .object({
    id: z.string().min(1),
    projectionId: z.string().min(1),
    localDate: localDateSchema,
    kind: z.enum(['planned-event-conflict', 'unsupported-strategy']),
    message: z.string().min(1),
    eventTitle: z.string().min(1).optional(),
    eventLocalDate: localDateSchema.optional(),
    actions: z.array(coachProjectionActionTypeSchema).default([]),
  })
  .strict();
export type CoachProjectionConflictWarning = z.infer<
  typeof coachProjectionConflictWarningSchema
>;

export const coachProjectedSessionSchema = z
  .object({
    id: z.string().min(1),
    planId: z.string().min(1),
    programVersion: z.number().int().positive(),
    cycleIndex: z.number().int().nonnegative(),
    strategy: coachScheduleStrategySchema,
    sessionIdentityKey: z.string().min(1),
    localDate: localDateSchema,
    sourceBlockId: z.string().min(1).optional(),
    addOnBlockIds: z.array(z.string().min(1)).default([]),
    targetIds: z.array(z.string().min(1)).default([]),
    status: coachProjectionSessionStatusSchema,
    projectionStatus: adaptiveProjectionStatusSchema.optional(),
    blockLabel: z.string().min(1).optional(),
    durationMinutes: z.number().int().positive().optional(),
    workoutId: z.string().min(1).optional(),
    rationale: z.array(adaptiveRecommendationRationaleSchema).default([]),
    coachNotes: z.array(z.string().min(1)).default([]),
    conflictWarningIds: z.array(z.string().min(1)).default([]),
    availableActions: z.array(coachProjectionActionTypeSchema).default([]),
  })
  .strict();
export type CoachProjectedSession = z.infer<typeof coachProjectedSessionSchema>;

export const coachProjectionStrategyStatusSchema = z.enum([
  'ready',
  'unsupported',
]);
export type CoachProjectionStrategyStatus = z.infer<
  typeof coachProjectionStrategyStatusSchema
>;

export const coachProjectionSchema = z
  .object({
    planId: z.string().min(1),
    programVersion: z.number().int().positive(),
    strategy: coachScheduleStrategySchema,
    strategyStatus: coachProjectionStrategyStatusSchema,
    cycleIndex: z.number().int().nonnegative(),
    windowStartLocalDate: localDateSchema,
    windowEndLocalDate: localDateSchema,
    todaySessionId: z.string().min(1).optional(),
    sessions: z.array(coachProjectedSessionSchema).default([]),
    repairNotes: z.array(z.string().min(1)).default([]),
    conflictWarnings: z.array(coachProjectionConflictWarningSchema).default([]),
    targetProgress: z.array(adaptivePlanTargetProgressSchema).default([]),
  })
  .strict();
export type CoachProjection = z.infer<typeof coachProjectionSchema>;

export const coachSessionActionKindSchema = z.enum(['skip']);
export type CoachSessionActionKind = z.infer<
  typeof coachSessionActionKindSchema
>;

export const coachSessionActionSchema = z
  .object({
    id: z.string().min(1).optional(),
    actionKind: coachSessionActionKindSchema,
    programId: z.string().min(1),
    programVersion: z.number().int().positive(),
    strategy: coachScheduleStrategySchema,
    cycleIndex: z.number().int().nonnegative(),
    sessionIdentityKey: z.string().min(1),
    projectionId: z.string().min(1),
    sourceBlockId: z.string().min(1).optional(),
    projectedLocalDate: localDateSchema,
    actionLocalDate: localDateSchema,
    workoutId: z.string().min(1).optional(),
    substitutionWorkoutId: z.string().min(1).optional(),
    substitutionBlockId: z.string().min(1).optional(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type CoachSessionAction = z.infer<typeof coachSessionActionSchema>;

export const adaptiveTrainingPlanSchema = z
  .object({
    schemaVersion: adaptiveTrainingPlanSchemaVersionSchema,
    id: z.string().min(1),
    sourceTemplateId: trainingTemplateIdSchema,
    mode: adaptiveTrainingPlanModeSchema,
    activeFrom: localDateSchema,
    activeUntil: localDateSchema.optional(),
    blocks: z.array(adaptiveTrainingBlockSchema).min(1),
    targetRanges: z.array(adaptiveTargetRangeSchema).min(1),
    typicalWeekPreferences: z
      .array(adaptiveTypicalWeekPreferenceSchema)
      .default([]),
    sessionPreferences: z
      .array(adaptivePlanSessionPreferenceSchema)
      .default([]),
    recommendationSettings: adaptiveRecommendationSettingsSchema,
    programVersion: z.number().int().positive().default(1),
    scheduleStrategy: coachScheduleStrategySchema.optional(),
    strategySelection: coachStrategySelectionSchema.optional(),
    revisions: z.array(coachProgramRevisionSchema).default([]),
    status: adaptiveTrainingPlanStatusSchema,
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const blockIds = new Set<string>();

    plan.blocks.forEach((block, blockIndex) => {
      if (blockIds.has(block.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'block ids must be unique',
          path: ['blocks', blockIndex, 'id'],
        });
      }
      blockIds.add(block.id);

      [
        ...block.compatibleAddOnBlockIds,
        ...block.conflictsWithBlockIds,
      ].forEach((referencedBlockId) => {
        if (referencedBlockId === block.id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'block cannot reference itself as compatible or conflicting',
            path: ['blocks', blockIndex],
          });
        }
      });
    });

    const targetIds = new Set(plan.targetRanges.map((target) => target.id));

    plan.targetRanges.forEach((target, targetIndex) => {
      target.appliesTo.blockIds.forEach((blockId, blockIdIndex) => {
        if (!blockIds.has(blockId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'target range references an unknown block id',
            path: [
              'targetRanges',
              targetIndex,
              'appliesTo',
              'blockIds',
              blockIdIndex,
            ],
          });
        }
      });
    });

    plan.blocks.forEach((block, blockIndex) => {
      block.targetContributions.forEach((contribution, contributionIndex) => {
        if (!targetIds.has(contribution.targetId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'block target contribution references an unknown target id',
            path: [
              'blocks',
              blockIndex,
              'targetContributions',
              contributionIndex,
            ],
          });
        }
      });

      block.compatibleAddOnBlockIds.forEach((blockId, blockIdIndex) => {
        if (!blockIds.has(blockId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'compatible add-on references an unknown block id',
            path: [
              'blocks',
              blockIndex,
              'compatibleAddOnBlockIds',
              blockIdIndex,
            ],
          });
        }
      });

      block.conflictsWithBlockIds.forEach((blockId, blockIdIndex) => {
        if (!blockIds.has(blockId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'conflict references an unknown block id',
            path: ['blocks', blockIndex, 'conflictsWithBlockIds', blockIdIndex],
          });
        }
      });
    });

    plan.typicalWeekPreferences.forEach((preference, preferenceIndex) => {
      preference.preferredBlockIds.forEach((blockId, blockIdIndex) => {
        if (!blockIds.has(blockId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'typical week preference references an unknown block id',
            path: [
              'typicalWeekPreferences',
              preferenceIndex,
              'preferredBlockIds',
              blockIdIndex,
            ],
          });
        }
      });
    });

    plan.sessionPreferences.forEach((session, sessionIndex) => {
      session.blockIds.forEach((blockId, blockIdIndex) => {
        if (!blockIds.has(blockId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'session preference references an unknown block id',
            path: [
              'sessionPreferences',
              sessionIndex,
              'blockIds',
              blockIdIndex,
            ],
          });
        }
      });
    });

    plan.recommendationSettings.preferredRotationBlockIds.forEach(
      (blockId, blockIdIndex) => {
        if (!blockIds.has(blockId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'preferred rotation references an unknown block id',
            path: [
              'recommendationSettings',
              'preferredRotationBlockIds',
              blockIdIndex,
            ],
          });
        }
      }
    );
  });
export type AdaptiveTrainingPlan = z.infer<typeof adaptiveTrainingPlanSchema>;

export const adaptivePlanBlockIntentSchema = z
  .object({
    blockId: z.string().min(1),
    label: z.string().min(1),
    category: adaptiveTrainingBlockCategorySchema,
    role: z.string().min(1).optional(),
    targetDurationMinutes: z.number().int().positive().optional(),
    stressTags: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type AdaptivePlanBlockIntent = z.infer<
  typeof adaptivePlanBlockIntentSchema
>;

export const adaptivePlanIntentSchema = z
  .object({
    planId: z.string().min(1),
    programVersion: z.number().int().positive().optional(),
    scheduleStrategy: coachScheduleStrategySchema.optional(),
    recommendationId: z.string().min(1).optional(),
    projectionId: z.string().min(1).optional(),
    sourceTemplateId: trainingTemplateIdSchema.optional(),
    primaryBlock: adaptivePlanBlockIntentSchema,
    addOnBlocks: z.array(adaptivePlanBlockIntentSchema).default([]),
    targetRangeContext: z.array(adaptivePlanTargetProgressSchema).default([]),
    rationale: z.array(adaptiveRecommendationRationaleSchema).default([]),
    projectionStatus: adaptiveProjectionStatusSchema.optional(),
  })
  .passthrough();
export type AdaptivePlanIntent = z.infer<typeof adaptivePlanIntentSchema>;

export const trainingTemplateDefinitionSchema = z
  .object({
    id: trainingTemplateIdSchema,
    name: z.string(),
    summary: z.string(),
    weeklyRhythm: z.string(),
    defaultScheduleStrategy: coachScheduleStrategySchema,
    defaultScheduleStrategyReason: z.string().min(1),
    durationAssumptions: durationAssumptionsSchema,
    slotSequence: z.array(starterWeekSlotSchema).min(1),
    adaptivePlanTemplate: z
      .object({
        blocks: z.array(adaptiveTrainingBlockSchema).min(1),
        targetRanges: z.array(adaptiveTargetRangeSchema).min(1),
        typicalWeekPreferences: z
          .array(adaptiveTypicalWeekPreferenceSchema)
          .default([]),
        recommendationSettings: adaptiveRecommendationSettingsSchema,
      })
      .strict()
      .optional(),
  })
  .strict();
export type TrainingTemplateDefinition = z.infer<
  typeof trainingTemplateDefinitionSchema
>;

const createSlot = (
  dayOffset: number,
  role: StarterWeekSlotRole,
  label: string,
  targetDurationMinutes: number
): StarterWeekSlot => ({
  id: `day-${dayOffset + 1}-${role}`,
  role,
  label,
  dayOffset,
  targetDurationMinutes,
});

export const ADAPTIVE_BALANCED_FOUNDATION_BLOCKS = [
  {
    id: 'full-body-strength',
    label: 'Full Body Strength',
    role: 'full-body-strength',
    category: 'strength',
    stressTags: ['full-body', 'strength'],
    defaultDurationMinutes: 35,
    targetContributions: [{ targetId: 'strength', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    role: 'conditioning',
    category: 'conditioning',
    stressTags: ['aerobic'],
    defaultDurationMinutes: 30,
    targetContributions: [{ targetId: 'conditioning', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    role: 'mobility',
    category: 'mobility',
    stressTags: ['recovery'],
    defaultDurationMinutes: 20,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: ['full-body-strength', 'conditioning'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'flexible-movement',
    label: 'Flexible Movement',
    role: 'flexible-movement',
    category: 'conditioning',
    stressTags: ['flexible', 'low-impact'],
    defaultDurationMinutes: 30,
    targetContributions: [{ targetId: 'conditioning', count: 0.5 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'rest',
    label: 'Rest',
    role: 'rest',
    category: 'rest',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [],
    conflictsWithBlockIds: [
      'full-body-strength',
      'conditioning',
      'flexible-movement',
    ],
  },
] satisfies AdaptiveTrainingBlock[];

export const ADAPTIVE_BALANCED_FOUNDATION_TARGET_RANGES = [
  {
    id: 'strength',
    label: 'Strength',
    appliesTo: {
      blockIds: ['full-body-strength'],
      categories: ['strength'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 2,
    maxCount: 4,
    idealCount: 2,
    priority: 'primary',
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    appliesTo: {
      blockIds: ['conditioning', 'flexible-movement'],
      categories: ['conditioning'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 3,
    idealCount: 2,
    priority: 'secondary',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    appliesTo: {
      blockIds: ['mobility', 'rest'],
      categories: ['mobility', 'rest'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 3,
    idealCount: 2,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_BALANCED_FOUNDATION_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['full-body-strength'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'wednesday',
    preferredBlockIds: ['conditioning'],
    flexibility: 'flexible',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['full-body-strength'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['flexible-movement'],
    flexibility: 'flexible',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_BALANCED_FOUNDATION_RECOMMENDATION_SETTINGS = {
  preferredRotationBlockIds: [
    'full-body-strength',
    'conditioning',
    'flexible-movement',
  ],
  allowCompatibleAddOns: true,
  protectUpcomingLowerBodyDays: 1,
} satisfies AdaptiveRecommendationSettings;

export const ADAPTIVE_STRENGTH_FOUNDATION_BLOCKS = [
  {
    id: 'strength-heavy',
    label: 'Strength Heavy',
    role: 'strength-heavy',
    category: 'strength',
    stressTags: ['full-body', 'strength', 'heavy'],
    defaultDurationMinutes: 50,
    targetContributions: [{ targetId: 'strength', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
    recoveryGuidance:
      'Keep heavy strength away from the day before hard lower-body events.',
  },
  {
    id: 'strength-volume',
    label: 'Strength Volume',
    role: 'strength-volume',
    category: 'strength',
    stressTags: ['full-body', 'strength', 'volume'],
    defaultDurationMinutes: 45,
    targetContributions: [{ targetId: 'strength', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'lower-strength',
    label: 'Lower Strength',
    role: 'lower-strength',
    category: 'strength',
    stressTags: ['lower-body', 'strength', 'heavy'],
    defaultDurationMinutes: 45,
    targetContributions: [{ targetId: 'strength', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: ['conditioning'],
    recoveryGuidance:
      'Avoid stacking hard conditioning after lower-body strength.',
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    role: 'conditioning',
    category: 'cardio',
    stressTags: ['aerobic'],
    defaultDurationMinutes: 30,
    targetContributions: [{ targetId: 'conditioning', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: ['lower-strength'],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    role: 'mobility',
    category: 'mobility',
    stressTags: ['recovery'],
    defaultDurationMinutes: 20,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [
      'strength-heavy',
      'strength-volume',
      'lower-strength',
      'conditioning',
    ],
    conflictsWithBlockIds: [],
  },
  {
    id: 'rest',
    label: 'Rest',
    role: 'rest',
    category: 'rest',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [],
    conflictsWithBlockIds: [
      'strength-heavy',
      'strength-volume',
      'lower-strength',
      'conditioning',
    ],
  },
] satisfies AdaptiveTrainingBlock[];

export const ADAPTIVE_STRENGTH_FOUNDATION_TARGET_RANGES = [
  {
    id: 'strength',
    label: 'Strength',
    appliesTo: {
      blockIds: ['strength-heavy', 'strength-volume', 'lower-strength'],
      categories: ['strength'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 3,
    maxCount: 4,
    idealCount: 3,
    priority: 'primary',
  },
  {
    id: 'conditioning',
    label: 'Conditioning',
    appliesTo: {
      blockIds: ['conditioning'],
      categories: ['cardio'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 2,
    idealCount: 1,
    priority: 'secondary',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    appliesTo: {
      blockIds: ['mobility', 'rest'],
      categories: ['mobility', 'rest'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 3,
    idealCount: 2,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_STRENGTH_FOUNDATION_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['strength-heavy'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'wednesday',
    preferredBlockIds: ['strength-volume'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['lower-strength'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['mobility'],
    flexibility: 'flexible',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_STRENGTH_FOUNDATION_RECOMMENDATION_SETTINGS = {
  preferredRotationBlockIds: [
    'strength-heavy',
    'strength-volume',
    'lower-strength',
  ],
  allowCompatibleAddOns: true,
  protectUpcomingLowerBodyDays: 1,
} satisfies AdaptiveRecommendationSettings;

export const ADAPTIVE_HYPERTROPHY_FOUNDATION_BLOCKS = [
  {
    id: 'upper-hypertrophy',
    label: 'Upper Hypertrophy',
    role: 'upper-hypertrophy',
    category: 'strength',
    stressTags: ['upper-body', 'hypertrophy', 'volume'],
    defaultDurationMinutes: 50,
    targetContributions: [{ targetId: 'hypertrophy', count: 1 }],
    compatibleAddOnBlockIds: ['easy-cardio', 'mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'lower-hypertrophy',
    label: 'Lower Hypertrophy',
    role: 'lower-hypertrophy',
    category: 'strength',
    stressTags: ['lower-body', 'hypertrophy', 'volume'],
    defaultDurationMinutes: 50,
    targetContributions: [{ targetId: 'hypertrophy', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
    recoveryGuidance:
      'Keep lower-body volume away from hard intervals when possible.',
  },
  {
    id: 'full-body-pump',
    label: 'Full Body Pump',
    role: 'full-body-pump',
    category: 'strength',
    stressTags: ['full-body', 'hypertrophy', 'accessory'],
    defaultDurationMinutes: 45,
    targetContributions: [{ targetId: 'hypertrophy', count: 1 }],
    compatibleAddOnBlockIds: ['easy-cardio', 'mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'easy-cardio',
    label: 'Easy Cardio',
    role: 'easy-cardio',
    category: 'cardio',
    stressTags: ['aerobic', 'low-impact'],
    defaultDurationMinutes: 25,
    targetContributions: [{ targetId: 'cardio', count: 1 }],
    compatibleAddOnBlockIds: [
      'upper-hypertrophy',
      'full-body-pump',
      'mobility',
    ],
    conflictsWithBlockIds: [],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    role: 'mobility',
    category: 'mobility',
    stressTags: ['recovery'],
    defaultDurationMinutes: 20,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [
      'upper-hypertrophy',
      'lower-hypertrophy',
      'full-body-pump',
      'easy-cardio',
    ],
    conflictsWithBlockIds: [],
  },
  {
    id: 'rest',
    label: 'Rest',
    role: 'rest',
    category: 'rest',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [],
    conflictsWithBlockIds: [
      'upper-hypertrophy',
      'lower-hypertrophy',
      'full-body-pump',
      'easy-cardio',
    ],
  },
] satisfies AdaptiveTrainingBlock[];

export const ADAPTIVE_HYPERTROPHY_FOUNDATION_TARGET_RANGES = [
  {
    id: 'hypertrophy',
    label: 'Hypertrophy',
    appliesTo: {
      blockIds: ['upper-hypertrophy', 'lower-hypertrophy', 'full-body-pump'],
      categories: ['strength'],
      stressTags: ['hypertrophy'],
    },
    windowDays: 7,
    minCount: 3,
    maxCount: 4,
    idealCount: 3,
    priority: 'primary',
  },
  {
    id: 'cardio',
    label: 'Cardio',
    appliesTo: {
      blockIds: ['easy-cardio'],
      categories: ['cardio'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 2,
    idealCount: 1,
    priority: 'secondary',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    appliesTo: {
      blockIds: ['mobility', 'rest'],
      categories: ['mobility', 'rest'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 3,
    idealCount: 2,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_HYPERTROPHY_FOUNDATION_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['upper-hypertrophy'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'wednesday',
    preferredBlockIds: ['lower-hypertrophy'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['full-body-pump'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['easy-cardio'],
    flexibility: 'flexible',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_HYPERTROPHY_FOUNDATION_RECOMMENDATION_SETTINGS = {
  preferredRotationBlockIds: [
    'upper-hypertrophy',
    'lower-hypertrophy',
    'full-body-pump',
  ],
  allowCompatibleAddOns: true,
  protectUpcomingLowerBodyDays: 1,
} satisfies AdaptiveRecommendationSettings;

export const ADAPTIVE_HYPERTROPHY_STARTER_TARGET_RANGES = [
  {
    id: 'hypertrophy',
    label: 'Hypertrophy',
    appliesTo: {
      blockIds: ['upper-hypertrophy', 'lower-hypertrophy', 'full-body-pump'],
      categories: ['strength'],
      stressTags: ['hypertrophy'],
    },
    windowDays: 7,
    minCount: 2,
    maxCount: 3,
    idealCount: 2,
    priority: 'primary',
  },
  {
    id: 'cardio',
    label: 'Cardio',
    appliesTo: {
      blockIds: ['easy-cardio'],
      categories: ['cardio'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 2,
    idealCount: 1,
    priority: 'secondary',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    appliesTo: {
      blockIds: ['mobility', 'rest'],
      categories: ['mobility', 'rest'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 4,
    idealCount: 2,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_HYPERTROPHY_STARTER_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['full-body-pump'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'wednesday',
    preferredBlockIds: ['easy-cardio'],
    flexibility: 'flexible',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['full-body-pump'],
    flexibility: 'preferred',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_UPPER_LOWER_HYPERTROPHY_TARGET_RANGES = [
  {
    id: 'hypertrophy',
    label: 'Hypertrophy',
    appliesTo: {
      blockIds: ['upper-hypertrophy', 'lower-hypertrophy', 'full-body-pump'],
      categories: ['strength'],
      stressTags: ['hypertrophy'],
    },
    windowDays: 7,
    minCount: 4,
    maxCount: 5,
    idealCount: 4,
    priority: 'primary',
  },
  {
    id: 'cardio',
    label: 'Cardio',
    appliesTo: {
      blockIds: ['easy-cardio'],
      categories: ['cardio'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 2,
    idealCount: 1,
    priority: 'secondary',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    appliesTo: {
      blockIds: ['mobility', 'rest'],
      categories: ['mobility', 'rest'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 3,
    idealCount: 2,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_UPPER_LOWER_HYPERTROPHY_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['upper-hypertrophy'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'tuesday',
    preferredBlockIds: ['lower-hypertrophy'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'thursday',
    preferredBlockIds: ['upper-hypertrophy'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['easy-cardio'],
    flexibility: 'flexible',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['lower-hypertrophy'],
    flexibility: 'preferred',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_PPL_CONDITIONING_BLOCKS = [
  {
    id: 'push',
    label: 'Push',
    role: 'push',
    category: 'strength',
    stressTags: ['upper-body', 'push'],
    defaultDurationMinutes: 50,
    targetContributions: [{ targetId: 'lift', count: 1 }],
    compatibleAddOnBlockIds: ['easy-cardio', 'abs-accessory', 'mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'pull',
    label: 'Pull',
    role: 'pull',
    category: 'strength',
    stressTags: ['upper-body', 'pull'],
    defaultDurationMinutes: 50,
    targetContributions: [{ targetId: 'lift', count: 1 }],
    compatibleAddOnBlockIds: ['easy-cardio', 'abs-accessory', 'mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'legs',
    label: 'Legs',
    role: 'legs',
    category: 'strength',
    stressTags: ['lower-body', 'heavy'],
    defaultDurationMinutes: 50,
    targetContributions: [{ targetId: 'lift', count: 1 }],
    compatibleAddOnBlockIds: ['abs-accessory', 'mobility'],
    conflictsWithBlockIds: ['sprint'],
    recoveryGuidance:
      'Avoid heavy lower-body stacking before hikes, sports, or sprint work.',
  },
  {
    id: 'easy-cardio',
    label: 'Easy Cardio',
    role: 'easy-cardio',
    category: 'cardio',
    stressTags: ['low-impact', 'aerobic'],
    defaultDurationMinutes: 25,
    targetContributions: [{ targetId: 'cardio', count: 1 }],
    compatibleAddOnBlockIds: ['push', 'pull', 'mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'sprint',
    label: 'Sprint',
    role: 'sprint',
    category: 'conditioning',
    stressTags: ['lower-body', 'high-impact', 'intense'],
    defaultDurationMinutes: 30,
    targetContributions: [
      { targetId: 'cardio', count: 1 },
      { targetId: 'sprint', count: 1 },
    ],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: ['legs'],
    recoveryGuidance:
      'Keep sprint work away from heavy legs and lower-body events.',
  },
  {
    id: 'abs-accessory',
    label: 'Abs / Accessory',
    role: 'abs-accessory',
    category: 'accessory',
    stressTags: ['core', 'accessory'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'accessory', count: 1 }],
    compatibleAddOnBlockIds: [
      'push',
      'pull',
      'legs',
      'easy-cardio',
      'mobility',
    ],
    conflictsWithBlockIds: [],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    role: 'mobility',
    category: 'mobility',
    stressTags: ['recovery'],
    defaultDurationMinutes: 20,
    targetContributions: [{ targetId: 'rest', count: 1 }],
    compatibleAddOnBlockIds: ['push', 'pull', 'legs', 'easy-cardio', 'sprint'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'rest',
    label: 'Rest',
    role: 'rest',
    category: 'rest',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'rest', count: 1 }],
    compatibleAddOnBlockIds: [],
    conflictsWithBlockIds: ['push', 'pull', 'legs', 'easy-cardio', 'sprint'],
  },
] satisfies AdaptiveTrainingBlock[];

export const ADAPTIVE_PPL_CONDITIONING_TARGET_RANGES = [
  {
    id: 'lift',
    label: 'Lift',
    appliesTo: {
      blockIds: ['push', 'pull', 'legs'],
      categories: ['strength'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 3,
    maxCount: 5,
    idealCount: 3,
    priority: 'primary',
  },
  {
    id: 'cardio',
    label: 'Cardio',
    appliesTo: {
      blockIds: ['easy-cardio', 'sprint'],
      categories: ['cardio', 'conditioning'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 2,
    maxCount: 3,
    idealCount: 2,
    priority: 'secondary',
  },
  {
    id: 'sprint',
    label: 'Sprint',
    appliesTo: {
      blockIds: ['sprint'],
      categories: ['conditioning'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 1,
    idealCount: 1,
    priority: 'secondary',
  },
  {
    id: 'rest',
    label: 'Rest / Recovery',
    appliesTo: {
      blockIds: ['rest', 'mobility'],
      categories: ['rest', 'mobility'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 0,
    maxCount: 2,
    idealCount: 1,
    priority: 'optional',
  },
  {
    id: 'accessory',
    label: 'Abs / Accessory',
    appliesTo: {
      blockIds: ['abs-accessory'],
      categories: ['accessory'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 0,
    maxCount: 3,
    idealCount: 1,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_PPL_CONDITIONING_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['push'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'tuesday',
    preferredBlockIds: ['easy-cardio'],
    flexibility: 'flexible',
  },
  {
    dayOfWeek: 'wednesday',
    preferredBlockIds: ['pull'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['legs'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['sprint'],
    flexibility: 'flexible',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_PPL_CONDITIONING_RECOMMENDATION_SETTINGS = {
  preferredRotationBlockIds: ['push', 'pull', 'legs'],
  allowCompatibleAddOns: true,
  protectUpcomingLowerBodyDays: 1,
} satisfies AdaptiveRecommendationSettings;

export const ADAPTIVE_PPL_HYPERTROPHY_BLOCKS = [
  {
    id: 'push',
    label: 'Push',
    role: 'push',
    category: 'strength',
    stressTags: ['upper-body', 'push', 'hypertrophy'],
    defaultDurationMinutes: 50,
    targetContributions: [{ targetId: 'hypertrophy', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'pull',
    label: 'Pull',
    role: 'pull',
    category: 'strength',
    stressTags: ['upper-body', 'pull', 'hypertrophy'],
    defaultDurationMinutes: 50,
    targetContributions: [{ targetId: 'hypertrophy', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'legs',
    label: 'Legs',
    role: 'legs',
    category: 'strength',
    stressTags: ['lower-body', 'hypertrophy', 'heavy'],
    defaultDurationMinutes: 50,
    targetContributions: [{ targetId: 'hypertrophy', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
    recoveryGuidance:
      'Keep heavy lower-body work away from hard running or sport when possible.',
  },
  {
    id: 'upper-pump',
    label: 'Upper Pump',
    role: 'upper-pump',
    category: 'strength',
    stressTags: ['upper-body', 'hypertrophy', 'accessory'],
    defaultDurationMinutes: 45,
    targetContributions: [{ targetId: 'hypertrophy', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'lower-pump',
    label: 'Lower Pump',
    role: 'lower-pump',
    category: 'strength',
    stressTags: ['lower-body', 'hypertrophy', 'accessory'],
    defaultDurationMinutes: 45,
    targetContributions: [{ targetId: 'hypertrophy', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    role: 'mobility',
    category: 'mobility',
    stressTags: ['recovery'],
    defaultDurationMinutes: 20,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [
      'push',
      'pull',
      'legs',
      'upper-pump',
      'lower-pump',
    ],
    conflictsWithBlockIds: [],
  },
  {
    id: 'rest',
    label: 'Rest',
    role: 'rest',
    category: 'rest',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [],
    conflictsWithBlockIds: ['push', 'pull', 'legs', 'upper-pump', 'lower-pump'],
  },
] satisfies AdaptiveTrainingBlock[];

export const ADAPTIVE_PPL_HYPERTROPHY_TARGET_RANGES = [
  {
    id: 'hypertrophy',
    label: 'Hypertrophy',
    appliesTo: {
      blockIds: ['push', 'pull', 'legs', 'upper-pump', 'lower-pump'],
      categories: ['strength'],
      stressTags: ['hypertrophy'],
    },
    windowDays: 7,
    minCount: 5,
    maxCount: 6,
    idealCount: 5,
    priority: 'primary',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    appliesTo: {
      blockIds: ['mobility', 'rest'],
      categories: ['mobility', 'rest'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 3,
    idealCount: 2,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_PPL_HYPERTROPHY_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['push'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'tuesday',
    preferredBlockIds: ['pull'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'wednesday',
    preferredBlockIds: ['legs'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['upper-pump'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['lower-pump'],
    flexibility: 'preferred',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_PPL_HYPERTROPHY_RECOMMENDATION_SETTINGS = {
  preferredRotationBlockIds: [
    'push',
    'pull',
    'legs',
    'upper-pump',
    'lower-pump',
  ],
  allowCompatibleAddOns: true,
  protectUpcomingLowerBodyDays: 1,
} satisfies AdaptiveRecommendationSettings;

export const ADAPTIVE_FAT_LOSS_CONDITIONING_BLOCKS = [
  {
    id: 'strength-circuit',
    label: 'Strength Circuit',
    role: 'strength-circuit',
    category: 'strength',
    stressTags: ['full-body', 'strength', 'circuit'],
    defaultDurationMinutes: 40,
    targetContributions: [{ targetId: 'strength', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'zone2-cardio',
    label: 'Zone 2 Cardio',
    role: 'zone2-cardio',
    category: 'cardio',
    stressTags: ['aerobic', 'low-impact'],
    defaultDurationMinutes: 35,
    targetContributions: [{ targetId: 'conditioning', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'intervals',
    label: 'Intervals',
    role: 'intervals',
    category: 'conditioning',
    stressTags: ['high-impact', 'intense'],
    defaultDurationMinutes: 25,
    targetContributions: [
      { targetId: 'conditioning', count: 1 },
      { targetId: 'intervals', count: 1 },
    ],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
    recoveryGuidance:
      'Use low-impact intervals when joints or lower-body fatigue are limiting.',
  },
  {
    id: 'mobility',
    label: 'Mobility',
    role: 'mobility',
    category: 'mobility',
    stressTags: ['recovery'],
    defaultDurationMinutes: 20,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: ['strength-circuit', 'zone2-cardio', 'intervals'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'flexible-conditioning',
    label: 'Flexible Conditioning',
    role: 'flexible-conditioning',
    category: 'conditioning',
    stressTags: ['flexible', 'low-impact'],
    defaultDurationMinutes: 25,
    targetContributions: [{ targetId: 'conditioning', count: 0.5 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'rest',
    label: 'Rest',
    role: 'rest',
    category: 'rest',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [],
    conflictsWithBlockIds: [
      'strength-circuit',
      'zone2-cardio',
      'intervals',
      'flexible-conditioning',
    ],
  },
] satisfies AdaptiveTrainingBlock[];

export const ADAPTIVE_FAT_LOSS_CONDITIONING_TARGET_RANGES = [
  {
    id: 'conditioning',
    label: 'Conditioning',
    appliesTo: {
      blockIds: ['zone2-cardio', 'intervals', 'flexible-conditioning'],
      categories: ['cardio', 'conditioning'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 3,
    maxCount: 5,
    idealCount: 3,
    priority: 'primary',
  },
  {
    id: 'strength',
    label: 'Strength',
    appliesTo: {
      blockIds: ['strength-circuit'],
      categories: ['strength'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 2,
    maxCount: 3,
    idealCount: 2,
    priority: 'secondary',
  },
  {
    id: 'intervals',
    label: 'Intervals',
    appliesTo: {
      blockIds: ['intervals'],
      categories: ['conditioning'],
      stressTags: ['intense'],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 2,
    idealCount: 1,
    priority: 'secondary',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    appliesTo: {
      blockIds: ['mobility', 'rest'],
      categories: ['mobility', 'rest'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 3,
    idealCount: 2,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_FAT_LOSS_CONDITIONING_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['strength-circuit'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'tuesday',
    preferredBlockIds: ['zone2-cardio'],
    flexibility: 'flexible',
  },
  {
    dayOfWeek: 'thursday',
    preferredBlockIds: ['strength-circuit'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['intervals'],
    flexibility: 'flexible',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_FAT_LOSS_CONDITIONING_RECOMMENDATION_SETTINGS = {
  preferredRotationBlockIds: ['strength-circuit', 'zone2-cardio', 'intervals'],
  allowCompatibleAddOns: true,
  protectUpcomingLowerBodyDays: 1,
} satisfies AdaptiveRecommendationSettings;

export const ADAPTIVE_ENDURANCE_SUPPORT_BLOCKS = [
  {
    id: 'easy-cardio',
    label: 'Easy Cardio',
    role: 'easy-cardio',
    category: 'cardio',
    stressTags: ['aerobic', 'low-impact'],
    defaultDurationMinutes: 40,
    targetContributions: [{ targetId: 'cardio', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'intervals',
    label: 'Intervals',
    role: 'intervals',
    category: 'conditioning',
    stressTags: ['high-impact', 'intense'],
    defaultDurationMinutes: 30,
    targetContributions: [
      { targetId: 'cardio', count: 1 },
      { targetId: 'intervals', count: 1 },
    ],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: ['strength-support'],
    recoveryGuidance:
      'Avoid hard intervals directly after lower-body strength or sport.',
  },
  {
    id: 'strength-support',
    label: 'Strength Support',
    role: 'strength-support',
    category: 'strength',
    stressTags: ['full-body', 'strength'],
    defaultDurationMinutes: 35,
    targetContributions: [{ targetId: 'strength', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    role: 'mobility',
    category: 'mobility',
    stressTags: ['recovery'],
    defaultDurationMinutes: 20,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: ['easy-cardio', 'intervals', 'strength-support'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'rest',
    label: 'Rest',
    role: 'rest',
    category: 'rest',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [],
    conflictsWithBlockIds: ['easy-cardio', 'intervals', 'strength-support'],
  },
] satisfies AdaptiveTrainingBlock[];

export const ADAPTIVE_ENDURANCE_SUPPORT_TARGET_RANGES = [
  {
    id: 'cardio',
    label: 'Cardio',
    appliesTo: {
      blockIds: ['easy-cardio', 'intervals'],
      categories: ['cardio', 'conditioning'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 2,
    maxCount: 4,
    idealCount: 2,
    priority: 'primary',
  },
  {
    id: 'strength',
    label: 'Strength Support',
    appliesTo: {
      blockIds: ['strength-support'],
      categories: ['strength'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 2,
    idealCount: 2,
    priority: 'secondary',
  },
  {
    id: 'intervals',
    label: 'Intervals',
    appliesTo: {
      blockIds: ['intervals'],
      categories: ['conditioning'],
      stressTags: ['intense'],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 1,
    idealCount: 1,
    priority: 'secondary',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    appliesTo: {
      blockIds: ['mobility', 'rest'],
      categories: ['mobility', 'rest'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 3,
    idealCount: 2,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_ENDURANCE_SUPPORT_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['easy-cardio'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'wednesday',
    preferredBlockIds: ['strength-support'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['intervals'],
    flexibility: 'flexible',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['strength-support'],
    flexibility: 'flexible',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_ENDURANCE_SUPPORT_RECOMMENDATION_SETTINGS = {
  preferredRotationBlockIds: ['easy-cardio', 'strength-support', 'intervals'],
  allowCompatibleAddOns: true,
  protectUpcomingLowerBodyDays: 1,
} satisfies AdaptiveRecommendationSettings;

export const ADAPTIVE_MOBILITY_FOUNDATION_BLOCKS = [
  {
    id: 'mobility-flow',
    label: 'Mobility Flow',
    role: 'mobility-flow',
    category: 'mobility',
    stressTags: ['mobility', 'recovery'],
    defaultDurationMinutes: 25,
    targetContributions: [{ targetId: 'mobility', count: 1 }],
    compatibleAddOnBlockIds: ['stability-strength'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'stability-strength',
    label: 'Stability Strength',
    role: 'stability-strength',
    category: 'strength',
    stressTags: ['stability', 'full-body', 'low-impact'],
    defaultDurationMinutes: 30,
    targetContributions: [
      { targetId: 'strength', count: 1 },
      { targetId: 'mobility', count: 0.5 },
    ],
    compatibleAddOnBlockIds: ['mobility-flow'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'easy-cardio',
    label: 'Easy Cardio',
    role: 'easy-cardio',
    category: 'cardio',
    stressTags: ['aerobic', 'low-impact'],
    defaultDurationMinutes: 25,
    targetContributions: [{ targetId: 'cardio', count: 1 }],
    compatibleAddOnBlockIds: ['mobility-flow'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'recovery',
    label: 'Recovery',
    role: 'recovery',
    category: 'recovery',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'mobility', count: 0.5 }],
    compatibleAddOnBlockIds: [],
    conflictsWithBlockIds: [
      'mobility-flow',
      'stability-strength',
      'easy-cardio',
    ],
  },
] satisfies AdaptiveTrainingBlock[];

export const ADAPTIVE_MOBILITY_FOUNDATION_TARGET_RANGES = [
  {
    id: 'mobility',
    label: 'Mobility',
    appliesTo: {
      blockIds: ['mobility-flow', 'stability-strength', 'recovery'],
      categories: ['mobility', 'recovery'],
      stressTags: ['mobility'],
    },
    windowDays: 7,
    minCount: 3,
    maxCount: 5,
    idealCount: 3,
    priority: 'primary',
  },
  {
    id: 'strength',
    label: 'Stability Strength',
    appliesTo: {
      blockIds: ['stability-strength'],
      categories: ['strength'],
      stressTags: ['stability'],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 2,
    idealCount: 1,
    priority: 'secondary',
  },
  {
    id: 'cardio',
    label: 'Easy Cardio',
    appliesTo: {
      blockIds: ['easy-cardio'],
      categories: ['cardio'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 0,
    maxCount: 2,
    idealCount: 1,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_MOBILITY_FOUNDATION_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['mobility-flow'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'wednesday',
    preferredBlockIds: ['stability-strength'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['mobility-flow'],
    flexibility: 'preferred',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['easy-cardio'],
    flexibility: 'flexible',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_MOBILITY_FOUNDATION_RECOMMENDATION_SETTINGS = {
  preferredRotationBlockIds: [
    'mobility-flow',
    'stability-strength',
    'easy-cardio',
  ],
  allowCompatibleAddOns: true,
  protectUpcomingLowerBodyDays: 1,
} satisfies AdaptiveRecommendationSettings;

export const ADAPTIVE_BUSY_TRAVEL_BLOCKS = [
  {
    id: 'quick-strength',
    label: 'Quick Strength',
    role: 'quick-strength',
    category: 'strength',
    stressTags: ['full-body', 'minimal-equipment'],
    defaultDurationMinutes: 25,
    targetContributions: [{ targetId: 'strength', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'quick-conditioning',
    label: 'Quick Conditioning',
    role: 'quick-conditioning',
    category: 'conditioning',
    stressTags: ['minimal-equipment', 'aerobic'],
    defaultDurationMinutes: 20,
    targetContributions: [{ targetId: 'movement', count: 1 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'mobility',
    label: 'Mobility',
    role: 'mobility',
    category: 'mobility',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: ['quick-strength', 'quick-conditioning'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'flexible-movement',
    label: 'Flexible Movement',
    role: 'flexible-movement',
    category: 'conditioning',
    stressTags: ['flexible', 'minimal-equipment'],
    defaultDurationMinutes: 20,
    targetContributions: [{ targetId: 'movement', count: 0.5 }],
    compatibleAddOnBlockIds: ['mobility'],
    conflictsWithBlockIds: [],
  },
  {
    id: 'rest',
    label: 'Rest',
    role: 'rest',
    category: 'rest',
    stressTags: ['recovery'],
    defaultDurationMinutes: 15,
    targetContributions: [{ targetId: 'recovery', count: 1 }],
    compatibleAddOnBlockIds: [],
    conflictsWithBlockIds: [
      'quick-strength',
      'quick-conditioning',
      'flexible-movement',
    ],
  },
] satisfies AdaptiveTrainingBlock[];

export const ADAPTIVE_BUSY_TRAVEL_TARGET_RANGES = [
  {
    id: 'strength',
    label: 'Strength',
    appliesTo: {
      blockIds: ['quick-strength'],
      categories: ['strength'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 2,
    maxCount: 4,
    idealCount: 2,
    priority: 'primary',
  },
  {
    id: 'movement',
    label: 'Movement',
    appliesTo: {
      blockIds: ['quick-conditioning', 'flexible-movement'],
      categories: ['conditioning'],
      stressTags: ['minimal-equipment'],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 4,
    idealCount: 2,
    priority: 'secondary',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    appliesTo: {
      blockIds: ['mobility', 'rest'],
      categories: ['mobility', 'rest'],
      stressTags: [],
    },
    windowDays: 7,
    minCount: 1,
    maxCount: 4,
    idealCount: 2,
    priority: 'optional',
  },
] satisfies AdaptiveTargetRange[];

export const ADAPTIVE_BUSY_TRAVEL_TYPICAL_WEEK = [
  {
    dayOfWeek: 'monday',
    preferredBlockIds: ['quick-strength'],
    flexibility: 'flexible',
  },
  {
    dayOfWeek: 'wednesday',
    preferredBlockIds: ['mobility'],
    flexibility: 'flexible',
  },
  {
    dayOfWeek: 'friday',
    preferredBlockIds: ['quick-conditioning'],
    flexibility: 'flexible',
  },
  {
    dayOfWeek: 'saturday',
    preferredBlockIds: ['flexible-movement'],
    flexibility: 'flexible',
  },
] satisfies AdaptiveTypicalWeekPreference[];

export const ADAPTIVE_BUSY_TRAVEL_RECOMMENDATION_SETTINGS = {
  preferredRotationBlockIds: [
    'quick-strength',
    'quick-conditioning',
    'flexible-movement',
  ],
  allowCompatibleAddOns: true,
  protectUpcomingLowerBodyDays: 1,
} satisfies AdaptiveRecommendationSettings;

type AdaptivePlanTemplateDefinition = NonNullable<
  TrainingTemplateDefinition['adaptivePlanTemplate']
>;

const WEEKDAYS: AdaptiveWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const roleToAdaptiveBlock = (slot: StarterWeekSlot): AdaptiveTrainingBlock => {
  switch (slot.role) {
    case 'upper':
    case 'lower':
    case 'push':
    case 'pull':
    case 'legs':
    case 'full-body':
      return {
        id: slot.role,
        label: slot.label,
        role: slot.role,
        category: 'strength',
        stressTags:
          slot.role === 'legs'
            ? ['lower-body', 'strength']
            : slot.role === 'lower'
            ? ['lower-body', 'strength']
            : slot.role === 'full-body'
            ? ['full-body', 'strength']
            : slot.role === 'upper'
            ? ['upper-body', 'strength']
            : ['upper-body', slot.role],
        defaultDurationMinutes: slot.targetDurationMinutes,
        targetContributions: [{ targetId: 'strength', count: 1 }],
        compatibleAddOnBlockIds: ['mobility'],
        conflictsWithBlockIds:
          slot.role === 'legs' || slot.role === 'lower' ? ['sprint'] : [],
      };
    case 'conditioning':
      return {
        id: 'conditioning',
        label: slot.label,
        role: slot.role,
        category: 'cardio',
        stressTags: ['aerobic'],
        defaultDurationMinutes: slot.targetDurationMinutes,
        targetContributions: [{ targetId: 'cardio', count: 1 }],
        compatibleAddOnBlockIds: ['mobility'],
        conflictsWithBlockIds: [],
      };
    case 'sprint':
      return {
        id: 'sprint',
        label: slot.label,
        role: slot.role,
        category: 'conditioning',
        stressTags: ['lower-body', 'high-impact', 'intense'],
        defaultDurationMinutes: slot.targetDurationMinutes,
        targetContributions: [
          { targetId: 'cardio', count: 1 },
          { targetId: 'sprint', count: 1 },
        ],
        compatibleAddOnBlockIds: ['mobility'],
        conflictsWithBlockIds: ['legs'],
      };
    case 'mobility':
      return {
        id: 'mobility',
        label: slot.label,
        role: slot.role,
        category: 'mobility',
        stressTags: ['recovery'],
        defaultDurationMinutes: slot.targetDurationMinutes,
        targetContributions: [{ targetId: 'recovery', count: 1 }],
        compatibleAddOnBlockIds: [],
        conflictsWithBlockIds: [],
      };
    case 'recovery':
      return {
        id: 'rest',
        label: slot.label,
        role: slot.role,
        category: 'rest',
        stressTags: ['recovery'],
        defaultDurationMinutes: slot.targetDurationMinutes,
        targetContributions: [{ targetId: 'recovery', count: 1 }],
        compatibleAddOnBlockIds: [],
        conflictsWithBlockIds: [],
      };
    case 'flexible':
      return {
        id: 'flexible',
        label: slot.label,
        role: slot.role,
        category: 'conditioning',
        stressTags: ['flexible'],
        defaultDurationMinutes: slot.targetDurationMinutes,
        targetContributions: [{ targetId: 'flexible', count: 1 }],
        compatibleAddOnBlockIds: ['mobility'],
        conflictsWithBlockIds: [],
      };
  }
};

const targetLabelById: Record<string, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  conditioning: 'Conditioning',
  sprint: 'Sprint',
  intervals: 'Intervals',
  hypertrophy: 'Hypertrophy',
  mobility: 'Mobility',
  movement: 'Movement',
  recovery: 'Recovery',
  flexible: 'Flexible',
};

const createAdaptivePlanTemplateFromSlots = (
  template: Pick<TrainingTemplateDefinition, 'slotSequence'>
): AdaptivePlanTemplateDefinition => {
  const rawBlocks = [
    ...new Map(
      template.slotSequence.map((slot) => {
        const block = roleToAdaptiveBlock(slot);
        return [block.id, block] as const;
      })
    ).values(),
  ];
  const blockIdSet = new Set(rawBlocks.map((block) => block.id));
  const blocks = rawBlocks.map((block) => ({
    ...block,
    compatibleAddOnBlockIds: block.compatibleAddOnBlockIds.filter((blockId) =>
      blockIdSet.has(blockId)
    ),
    conflictsWithBlockIds: block.conflictsWithBlockIds.filter((blockId) =>
      blockIdSet.has(blockId)
    ),
  }));
  const contributionCounts = new Map<string, number>();

  template.slotSequence.forEach((slot) => {
    roleToAdaptiveBlock(slot).targetContributions.forEach((contribution) => {
      contributionCounts.set(
        contribution.targetId,
        (contributionCounts.get(contribution.targetId) ?? 0) +
          contribution.count
      );
    });
  });

  const targetRanges = [...contributionCounts.entries()].map(
    ([targetId, count]) => {
      const minCount =
        targetId === 'recovery' ? 0 : Math.max(1, Math.floor(count));
      return {
        id: targetId,
        label: targetLabelById[targetId] ?? targetId,
        appliesTo: {
          blockIds: blocks
            .filter((block) =>
              block.targetContributions.some(
                (contribution) => contribution.targetId === targetId
              )
            )
            .map((block) => block.id),
          categories: [],
          stressTags: [],
        },
        windowDays: 7,
        minCount,
        maxCount: Math.max(minCount, Math.ceil(count) + 1),
        idealCount: Math.ceil(count),
        priority:
          targetId === 'strength' || targetId === 'cardio'
            ? 'primary'
            : 'secondary',
      } satisfies AdaptiveTargetRange;
    }
  );

  return {
    blocks,
    targetRanges,
    typicalWeekPreferences: template.slotSequence.map((slot) => ({
      dayOfWeek: WEEKDAYS[slot.dayOffset % WEEKDAYS.length],
      preferredBlockIds: [roleToAdaptiveBlock(slot).id],
      flexibility: 'preferred',
    })),
    recommendationSettings: {
      preferredRotationBlockIds: blocks
        .filter(
          (block) => block.category !== 'rest' && block.category !== 'mobility'
        )
        .map((block) => block.id),
      allowCompatibleAddOns: true,
      protectUpcomingLowerBodyDays: 1,
    },
  };
};

const getAdaptivePlanTemplate = (
  template: TrainingTemplateDefinition
): AdaptivePlanTemplateDefinition =>
  template.adaptivePlanTemplate ??
  createAdaptivePlanTemplateFromSlots(template);

const BALANCED_STARTER_SLOT_SEQUENCE = [
  createSlot(0, 'full-body', 'Full body strength', 30),
  createSlot(1, 'recovery', 'Recovery', 15),
  createSlot(2, 'conditioning', 'Easy cardio', 25),
  createSlot(3, 'mobility', 'Mobility', 20),
  createSlot(4, 'full-body', 'Full body strength', 30),
  createSlot(5, 'flexible', 'Flexible movement', 20),
  createSlot(6, 'recovery', 'Recovery', 15),
] satisfies StarterWeekSlot[];

const BALANCED_PERFORMANCE_SLOT_SEQUENCE = [
  createSlot(0, 'full-body', 'Full body strength', 45),
  createSlot(1, 'conditioning', 'Conditioning', 35),
  createSlot(2, 'full-body', 'Full body strength', 45),
  createSlot(3, 'mobility', 'Mobility', 20),
  createSlot(4, 'full-body', 'Full body strength', 45),
  createSlot(5, 'sprint', 'Intervals', 30),
  createSlot(6, 'recovery', 'Recovery', 20),
] satisfies StarterWeekSlot[];

const STRENGTH_STARTER_SLOT_SEQUENCE = [
  createSlot(0, 'full-body', 'Full body strength', 35),
  createSlot(1, 'recovery', 'Recovery', 15),
  createSlot(2, 'mobility', 'Mobility', 20),
  createSlot(3, 'full-body', 'Full body strength', 35),
  createSlot(4, 'recovery', 'Recovery', 15),
  createSlot(5, 'conditioning', 'Easy conditioning', 25),
  createSlot(6, 'recovery', 'Recovery', 15),
] satisfies StarterWeekSlot[];

const STRENGTH_PERFORMANCE_SLOT_SEQUENCE = [
  createSlot(0, 'full-body', 'Heavy strength', 55),
  createSlot(1, 'mobility', 'Mobility', 20),
  createSlot(2, 'full-body', 'Volume strength', 50),
  createSlot(3, 'conditioning', 'Conditioning', 30),
  createSlot(4, 'lower', 'Lower strength', 50),
  createSlot(5, 'upper', 'Upper strength', 45),
  createSlot(6, 'recovery', 'Recovery', 20),
] satisfies StarterWeekSlot[];

const HYPERTROPHY_STARTER_SLOT_SEQUENCE = [
  createSlot(0, 'full-body', 'Full body hypertrophy', 35),
  createSlot(1, 'mobility', 'Mobility', 20),
  createSlot(2, 'conditioning', 'Easy cardio', 25),
  createSlot(3, 'recovery', 'Recovery', 15),
  createSlot(4, 'full-body', 'Full body hypertrophy', 35),
  createSlot(5, 'flexible', 'Optional pump', 20),
  createSlot(6, 'recovery', 'Recovery', 15),
] satisfies StarterWeekSlot[];

const UPPER_LOWER_HYPERTROPHY_SLOT_SEQUENCE = [
  createSlot(0, 'upper', 'Upper lift', 45),
  createSlot(1, 'lower', 'Lower lift', 45),
  createSlot(2, 'mobility', 'Mobility', 20),
  createSlot(3, 'upper', 'Upper lift', 45),
  createSlot(4, 'conditioning', 'Easy cardio', 25),
  createSlot(5, 'lower', 'Lower lift', 45),
  createSlot(6, 'recovery', 'Recovery', 20),
] satisfies StarterWeekSlot[];

const PPL_HYPERTROPHY_SLOT_SEQUENCE = [
  createSlot(0, 'push', 'Push', 50),
  createSlot(1, 'pull', 'Pull', 50),
  createSlot(2, 'legs', 'Legs', 50),
  createSlot(3, 'recovery', 'Recovery', 20),
  createSlot(4, 'upper', 'Upper pump', 45),
  createSlot(5, 'lower', 'Lower pump', 45),
  createSlot(6, 'recovery', 'Recovery', 20),
] satisfies StarterWeekSlot[];

const PPL_CONDITIONING_SLOT_SEQUENCE = [
  createSlot(0, 'push', 'Push', 50),
  createSlot(1, 'conditioning', 'Easy cardio', 25),
  createSlot(2, 'pull', 'Pull', 50),
  createSlot(3, 'recovery', 'Recovery', 20),
  createSlot(4, 'legs', 'Legs', 50),
  createSlot(5, 'sprint', 'Sprint conditioning', 30),
  createSlot(6, 'recovery', 'Recovery', 20),
] satisfies StarterWeekSlot[];

export const TRAINING_TEMPLATE_DEFINITIONS: Record<
  TrainingTemplateId,
  TrainingTemplateDefinition
> = {
  'balanced-starter': {
    id: 'balanced-starter',
    name: 'Balanced starter',
    summary:
      'A low-friction start with two strength days, easy cardio, and recovery.',
    weeklyRhythm: '2 strength days, 1 easy cardio day, mobility and recovery',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Balanced starter prioritizes weekly exposure balance over a strict session order.',
    durationAssumptions: { targetMinutes: 30, minimumUsefulMinutes: 15 },
    slotSequence: BALANCED_STARTER_SLOT_SEQUENCE,
    adaptivePlanTemplate: createAdaptivePlanTemplateFromSlots({
      slotSequence: BALANCED_STARTER_SLOT_SEQUENCE,
    }),
  },
  'balanced-foundation': {
    id: 'balanced-foundation',
    name: 'Balanced foundation',
    summary: 'A simple mix of strength, conditioning, mobility, and recovery.',
    weeklyRhythm: '3 strength / conditioning days, 2 recovery or mobility days',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Balanced foundation prioritizes weekly target balance across strength, conditioning, and recovery.',
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
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_BALANCED_FOUNDATION_BLOCKS,
      targetRanges: ADAPTIVE_BALANCED_FOUNDATION_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_BALANCED_FOUNDATION_TYPICAL_WEEK,
      recommendationSettings:
        ADAPTIVE_BALANCED_FOUNDATION_RECOMMENDATION_SETTINGS,
    },
  },
  'balanced-performance': {
    id: 'balanced-performance',
    name: 'Balanced performance',
    summary:
      'A balanced advanced week with strength, conditioning, intervals, and recovery.',
    weeklyRhythm:
      '3 strength days, 2 conditioning exposures, mobility and recovery',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Balanced performance prioritizes weekly target balance across strength and conditioning exposures.',
    durationAssumptions: { targetMinutes: 45, minimumUsefulMinutes: 30 },
    slotSequence: BALANCED_PERFORMANCE_SLOT_SEQUENCE,
    adaptivePlanTemplate: createAdaptivePlanTemplateFromSlots({
      slotSequence: BALANCED_PERFORMANCE_SLOT_SEQUENCE,
    }),
  },
  'strength-starter': {
    id: 'strength-starter',
    name: 'Strength starter',
    summary:
      'Two full-body strength days with plenty of space to practice and recover.',
    weeklyRhythm: '2 strength days, 1 easy conditioning day, recovery between',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Strength starter prioritizes weekly strength practice without requiring a strict block sequence.',
    durationAssumptions: { targetMinutes: 35, minimumUsefulMinutes: 20 },
    slotSequence: STRENGTH_STARTER_SLOT_SEQUENCE,
    adaptivePlanTemplate: createAdaptivePlanTemplateFromSlots({
      slotSequence: STRENGTH_STARTER_SLOT_SEQUENCE,
    }),
  },
  'strength-foundation': {
    id: 'strength-foundation',
    name: 'Strength foundation',
    summary: 'Full-body strength exposures with enough recovery to progress.',
    weeklyRhythm:
      '3 strength days, 1 conditioning day, recovery between harder days',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Strength foundation prioritizes weekly strength exposure balance with recovery spacing.',
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
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_STRENGTH_FOUNDATION_BLOCKS,
      targetRanges: ADAPTIVE_STRENGTH_FOUNDATION_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_STRENGTH_FOUNDATION_TYPICAL_WEEK,
      recommendationSettings:
        ADAPTIVE_STRENGTH_FOUNDATION_RECOMMENDATION_SETTINGS,
    },
  },
  'strength-performance': {
    id: 'strength-performance',
    name: 'Strength performance',
    summary:
      'Four strength exposures with conditioning and recovery placed around harder days.',
    weeklyRhythm: '4 strength days, 1 conditioning day, mobility and recovery',
    defaultScheduleStrategy: 'ordered-rotation',
    defaultScheduleStrategyReason:
      'Strength performance has distinct strength exposures that benefit from rotating through planned blocks.',
    durationAssumptions: { targetMinutes: 55, minimumUsefulMinutes: 35 },
    slotSequence: STRENGTH_PERFORMANCE_SLOT_SEQUENCE,
    adaptivePlanTemplate: createAdaptivePlanTemplateFromSlots({
      slotSequence: STRENGTH_PERFORMANCE_SLOT_SEQUENCE,
    }),
  },
  'hypertrophy-starter': {
    id: 'hypertrophy-starter',
    name: 'Hypertrophy starter',
    summary:
      'Two approachable muscle-building days with light cardio and recovery.',
    weeklyRhythm:
      '2 hypertrophy days, 1 easy cardio day, mobility and recovery',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Hypertrophy starter prioritizes weekly hypertrophy exposure balance without a strict sequence.',
    durationAssumptions: { targetMinutes: 35, minimumUsefulMinutes: 20 },
    slotSequence: HYPERTROPHY_STARTER_SLOT_SEQUENCE,
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_HYPERTROPHY_FOUNDATION_BLOCKS,
      targetRanges: ADAPTIVE_HYPERTROPHY_STARTER_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_HYPERTROPHY_STARTER_TYPICAL_WEEK,
      recommendationSettings:
        ADAPTIVE_HYPERTROPHY_FOUNDATION_RECOMMENDATION_SETTINGS,
    },
  },
  'hypertrophy-foundation': {
    id: 'hypertrophy-foundation',
    name: 'Hypertrophy foundation',
    summary: 'Simple muscle-building exposures with recovery and light cardio.',
    weeklyRhythm:
      '3 hypertrophy days, 1 easy cardio day, mobility and recovery',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Hypertrophy foundation prioritizes weekly hypertrophy target balance with recovery.',
    durationAssumptions: { targetMinutes: 45, minimumUsefulMinutes: 30 },
    slotSequence: [
      createSlot(0, 'full-body', 'Upper lift', 45),
      createSlot(1, 'mobility', 'Mobility', 20),
      createSlot(2, 'full-body', 'Lower lift', 45),
      createSlot(3, 'recovery', 'Recovery', 20),
      createSlot(4, 'full-body', 'Full body pump', 45),
      createSlot(5, 'conditioning', 'Easy cardio', 25),
      createSlot(6, 'recovery', 'Recovery', 20),
    ],
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_HYPERTROPHY_FOUNDATION_BLOCKS,
      targetRanges: ADAPTIVE_HYPERTROPHY_FOUNDATION_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_HYPERTROPHY_FOUNDATION_TYPICAL_WEEK,
      recommendationSettings:
        ADAPTIVE_HYPERTROPHY_FOUNDATION_RECOMMENDATION_SETTINGS,
    },
  },
  'upper-lower-hypertrophy': {
    id: 'upper-lower-hypertrophy',
    name: 'Upper/lower hypertrophy',
    summary:
      'Four spaced upper/lower lifting days with a light cardio touchpoint.',
    weeklyRhythm: '4 lift days, 1 easy cardio day, recovery after lower work',
    defaultScheduleStrategy: 'ordered-rotation',
    defaultScheduleStrategyReason:
      'Upper/lower hypertrophy depends on rotating through distinct upper and lower lifting blocks.',
    durationAssumptions: { targetMinutes: 45, minimumUsefulMinutes: 30 },
    slotSequence: UPPER_LOWER_HYPERTROPHY_SLOT_SEQUENCE,
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_HYPERTROPHY_FOUNDATION_BLOCKS,
      targetRanges: ADAPTIVE_UPPER_LOWER_HYPERTROPHY_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_UPPER_LOWER_HYPERTROPHY_TYPICAL_WEEK,
      recommendationSettings:
        ADAPTIVE_HYPERTROPHY_FOUNDATION_RECOMMENDATION_SETTINGS,
    },
  },
  'ppl-hypertrophy': {
    id: 'ppl-hypertrophy',
    name: 'PPL hypertrophy',
    summary:
      'An advanced five-day lifting week with a PPL wave and upper/lower pump work.',
    weeklyRhythm: '5 lift days with recovery after the first PPL wave',
    defaultScheduleStrategy: 'ordered-rotation',
    defaultScheduleStrategyReason:
      'PPL hypertrophy depends on rotating through a sequence of split lifting blocks.',
    durationAssumptions: { targetMinutes: 50, minimumUsefulMinutes: 35 },
    slotSequence: PPL_HYPERTROPHY_SLOT_SEQUENCE,
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_PPL_HYPERTROPHY_BLOCKS,
      targetRanges: ADAPTIVE_PPL_HYPERTROPHY_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_PPL_HYPERTROPHY_TYPICAL_WEEK,
      recommendationSettings: ADAPTIVE_PPL_HYPERTROPHY_RECOMMENDATION_SETTINGS,
    },
  },
  'ppl-conditioning': {
    id: 'ppl-conditioning',
    name: 'Lift conditioning',
    summary: 'Lifting days spaced around easy cardio and sprint conditioning.',
    weeklyRhythm: '3 lift days, 1 easy cardio day, 1 sprint day',
    defaultScheduleStrategy: 'ordered-rotation',
    defaultScheduleStrategyReason:
      'Lift conditioning depends on rotating through push, pull, and legs while balancing conditioning.',
    durationAssumptions: { targetMinutes: 50, minimumUsefulMinutes: 35 },
    slotSequence: PPL_CONDITIONING_SLOT_SEQUENCE,
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_PPL_CONDITIONING_BLOCKS,
      targetRanges: ADAPTIVE_PPL_CONDITIONING_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_PPL_CONDITIONING_TYPICAL_WEEK,
      recommendationSettings: ADAPTIVE_PPL_CONDITIONING_RECOMMENDATION_SETTINGS,
    },
  },
  'fat-loss-conditioning': {
    id: 'fat-loss-conditioning',
    name: 'Fat-loss conditioning',
    summary: 'Conditioning-first training with enough strength to hold muscle.',
    weeklyRhythm:
      '2 strength circuits, 2 conditioning days, mobility and recovery',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Fat-loss conditioning prioritizes weekly conditioning and strength exposure balance.',
    durationAssumptions: { targetMinutes: 35, minimumUsefulMinutes: 20 },
    slotSequence: [
      createSlot(0, 'full-body', 'Strength circuit', 35),
      createSlot(1, 'conditioning', 'Zone 2 cardio', 35),
      createSlot(2, 'mobility', 'Mobility', 20),
      createSlot(3, 'full-body', 'Strength circuit', 35),
      createSlot(4, 'sprint', 'Intervals', 25),
      createSlot(5, 'flexible', 'Flexible conditioning', 25),
      createSlot(6, 'recovery', 'Recovery', 20),
    ],
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_FAT_LOSS_CONDITIONING_BLOCKS,
      targetRanges: ADAPTIVE_FAT_LOSS_CONDITIONING_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_FAT_LOSS_CONDITIONING_TYPICAL_WEEK,
      recommendationSettings:
        ADAPTIVE_FAT_LOSS_CONDITIONING_RECOMMENDATION_SETTINGS,
    },
  },
  'endurance-support': {
    id: 'endurance-support',
    name: 'Endurance support',
    summary: 'Cardio-forward training with strength support and recovery.',
    weeklyRhythm:
      '2 cardio days, 2 support strength days, mobility and recovery',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Endurance support prioritizes weekly cardio, strength support, and recovery balance.',
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
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_ENDURANCE_SUPPORT_BLOCKS,
      targetRanges: ADAPTIVE_ENDURANCE_SUPPORT_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_ENDURANCE_SUPPORT_TYPICAL_WEEK,
      recommendationSettings:
        ADAPTIVE_ENDURANCE_SUPPORT_RECOMMENDATION_SETTINGS,
    },
  },
  'mobility-foundation': {
    id: 'mobility-foundation',
    name: 'Mobility foundation',
    summary: 'Mobility-led training with stability strength and easy movement.',
    weeklyRhythm:
      '3 mobility sessions, 1 stability strength day, optional easy cardio',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Mobility foundation prioritizes weekly mobility exposure balance with optional support work.',
    durationAssumptions: { targetMinutes: 25, minimumUsefulMinutes: 15 },
    slotSequence: [
      createSlot(0, 'mobility', 'Mobility flow', 25),
      createSlot(1, 'recovery', 'Recovery', 15),
      createSlot(2, 'full-body', 'Stability strength', 30),
      createSlot(3, 'mobility', 'Mobility flow', 25),
      createSlot(4, 'conditioning', 'Easy cardio', 25),
      createSlot(5, 'flexible', 'Flexible movement', 20),
      createSlot(6, 'recovery', 'Recovery', 15),
    ],
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_MOBILITY_FOUNDATION_BLOCKS,
      targetRanges: ADAPTIVE_MOBILITY_FOUNDATION_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_MOBILITY_FOUNDATION_TYPICAL_WEEK,
      recommendationSettings:
        ADAPTIVE_MOBILITY_FOUNDATION_RECOMMENDATION_SETTINGS,
    },
  },
  'busy-travel': {
    id: 'busy-travel',
    name: 'Busy travel',
    summary:
      'Short, low-friction sessions for minimal equipment or travel weeks.',
    weeklyRhythm:
      'Short strength, mobility, and flexible conditioning sessions',
    defaultScheduleStrategy: 'weekly-target-balance',
    defaultScheduleStrategyReason:
      'Busy travel prioritizes flexible weekly target balance around limited time and equipment.',
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
    adaptivePlanTemplate: {
      blocks: ADAPTIVE_BUSY_TRAVEL_BLOCKS,
      targetRanges: ADAPTIVE_BUSY_TRAVEL_TARGET_RANGES,
      typicalWeekPreferences: ADAPTIVE_BUSY_TRAVEL_TYPICAL_WEEK,
      recommendationSettings: ADAPTIVE_BUSY_TRAVEL_RECOMMENDATION_SETTINGS,
    },
  },
};

export const supportsAdaptiveTrainingPlan = (
  templateId: TrainingTemplateId
): boolean => Boolean(TRAINING_TEMPLATE_DEFINITIONS[templateId]);

const minimalEquipment = new Set([
  'Bodyweight',
  'Resistance Bands',
  'Jump Rope',
]);

export const selectTrainingTemplateId = (
  answers: OnboardingAnswers
): TrainingTemplateId => {
  const hasGymAccess =
    answers.environment === 'gym' || answers.equipment.includes(GYM_EQUIPMENT);
  const onlyMinimalEquipment =
    answers.equipment.length > 0 &&
    answers.equipment.every((item) => minimalEquipment.has(item));

  if (answers.goal === 'mobility') {
    return 'mobility-foundation';
  }

  if (answers.environment === 'travel') {
    return 'busy-travel';
  }

  if (answers.goal === 'run-cardio') {
    return 'endurance-support';
  }

  if (answers.goal === 'lose-fat') {
    return 'fat-loss-conditioning';
  }

  if (answers.goal === 'build-strength') {
    if (answers.experienceLevel === 'beginner') {
      return 'strength-starter';
    }

    return answers.experienceLevel === 'advanced'
      ? 'strength-performance'
      : 'strength-foundation';
  }

  if (answers.goal === 'build-muscle') {
    if (onlyMinimalEquipment) {
      return 'busy-travel';
    }

    if (answers.experienceLevel === 'beginner') {
      return 'hypertrophy-starter';
    }

    if (hasGymAccess) {
      return answers.experienceLevel === 'advanced'
        ? 'ppl-hypertrophy'
        : 'upper-lower-hypertrophy';
    }

    return 'hypertrophy-foundation';
  }

  if (onlyMinimalEquipment) {
    return 'busy-travel';
  }

  if (answers.experienceLevel === 'beginner') {
    return 'balanced-starter';
  }

  return answers.experienceLevel === 'advanced'
    ? 'balanced-performance'
    : 'balanced-foundation';
};

export const createTrainingBlueprintFromOnboarding = (
  answers: OnboardingAnswers,
  options: {
    editStatus?: TrainingBlueprintEditStatus;
    horizonDays?: number;
    updatedAt?: string;
  } = {}
): TrainingBlueprint => {
  const template =
    TRAINING_TEMPLATE_DEFINITIONS[selectTrainingTemplateId(answers)];
  const coachStrategySelection = selectCoachStrategyForTemplate(template.id);

  return trainingBlueprintSchema.parse({
    templateId: template.id,
    onboardingAnswers: answers,
    weeklyRhythm: template.weeklyRhythm,
    coachStrategySelection,
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

export const selectCoachStrategyForTemplate = (
  templateId: TrainingTemplateId
): CoachStrategySelection => {
  const template = TRAINING_TEMPLATE_DEFINITIONS[templateId];
  return coachStrategySelectionSchema.parse({
    strategy: template.defaultScheduleStrategy,
    reason: template.defaultScheduleStrategyReason,
  });
};

export const createAdaptiveTrainingPlanFromTemplate = (
  templateId: TrainingTemplateId,
  options: {
    id?: string;
    activeFrom: LocalDate;
    activeUntil?: LocalDate;
    updatedAt: string;
  }
): AdaptiveTrainingPlan => {
  const templateDefinition = TRAINING_TEMPLATE_DEFINITIONS[templateId];
  const template = getAdaptivePlanTemplate(templateDefinition);
  const strategySelection = selectCoachStrategyForTemplate(templateId);

  return adaptiveTrainingPlanSchema.parse({
    schemaVersion: 1,
    id: options.id ?? `${templateId}-adaptive-plan`,
    sourceTemplateId: templateId,
    mode: 'adaptive',
    activeFrom: options.activeFrom,
    activeUntil: options.activeUntil,
    blocks: template.blocks,
    targetRanges: template.targetRanges,
    typicalWeekPreferences: template.typicalWeekPreferences,
    sessionPreferences: [],
    recommendationSettings: template.recommendationSettings,
    programVersion: 1,
    scheduleStrategy: strategySelection.strategy,
    strategySelection,
    revisions: [],
    status: 'active',
    updatedAt: options.updatedAt,
  });
};

export const migrateAdaptiveTrainingPlanToCoachProgramAware = (
  plan: AdaptiveTrainingPlan
): AdaptiveTrainingPlan => {
  const parsed = adaptiveTrainingPlanSchema.parse(plan);
  const strategySelection =
    parsed.strategySelection ??
    selectCoachStrategyForTemplate(parsed.sourceTemplateId);

  return adaptiveTrainingPlanSchema.parse({
    ...parsed,
    programVersion: parsed.programVersion ?? 1,
    scheduleStrategy: parsed.scheduleStrategy ?? strategySelection.strategy,
    strategySelection,
    revisions: parsed.revisions ?? [],
  });
};

export const createCoachProgramStrategyRevision = (
  plan: AdaptiveTrainingPlan,
  input: {
    scheduleStrategy: CoachScheduleStrategy;
    reason: string;
    createdAt: string;
  }
): AdaptiveTrainingPlan => {
  const current = migrateAdaptiveTrainingPlanToCoachProgramAware(plan);
  const revision = coachProgramRevisionSchema.parse({
    version: current.programVersion + 1,
    previousVersion: current.programVersion,
    scheduleStrategy: input.scheduleStrategy,
    previousScheduleStrategy: current.scheduleStrategy,
    reason: input.reason,
    createdAt: input.createdAt,
  });

  return adaptiveTrainingPlanSchema.parse({
    ...current,
    programVersion: revision.version,
    scheduleStrategy: revision.scheduleStrategy,
    strategySelection: {
      strategy: revision.scheduleStrategy,
      reason: revision.reason,
    },
    revisions: [...current.revisions, revision],
    updatedAt: input.createdAt,
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
    coachProgramAttribution: coachProgramAttributionSchema.optional(),
  })
  .strict();
export type WorkoutLogPayload = z.infer<typeof workoutLogPayloadSchema>;

export const offlineHintSchema = z.object({
  offline: z.boolean().default(false),
  requiresApiKey: z.boolean().default(false),
  message: z.string().optional(),
});
export type OfflineHint = z.infer<typeof offlineHintSchema>;

export const generationStatusSchema = z.object({
  state: z.enum(['idle', 'pending', 'error']),
  submittedAt: z.string().nullable(),
  etaSeconds: z.number().int().positive().optional(),
  message: z.string().optional(),
});
export type GenerationStatus = z.infer<typeof generationStatusSchema>;

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
  fallback: string[] = []
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
  action: QuickActionPreset
): Partial<GenerationRequest> => {
  // For equipment, only use stagedValue (explicit user choice), not the default display value.
  // This allows the API layer to fall back to user profile equipment when not explicitly set.
  const source =
    action.key === 'equipment'
      ? action.stagedValue
      : action.stagedValue ?? action.value;

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
  base: Partial<GenerationRequest> = {}
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
    // Optional explicit intent when generating from an adaptive training plan recommendation.
    adaptivePlanIntent: adaptivePlanIntentSchema.optional(),
    // Explicit generation route. Defaults are resolved by callers, not inferred from provider state.
    creationMode: workoutCreationModeSchema.optional(),
    // Optional provider selection and model override
    provider: aiProviderSchema.optional(),
  })
  .strict();
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

const generationContextSessionSchema = workoutSessionSummarySchema.extend({
  perceivedEffort: workoutEnergySchema.optional(),
  notes: z.string().optional(),
  exerciseNames: z.array(z.string()).max(30).optional(),
  completedSetCount: z.number().int().nonnegative().optional(),
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
  // Whether generation may use AI-backed planning. Disabled users request library workouts explicitly.
  aiFeaturesEnabled: z.boolean().default(true),
  // First-run onboarding answers and setup state for template-based planning.
  onboardingAnswers: onboardingAnswersSchema.optional(),
  onboardingSetupStatus: trainingBlueprintSetupStatusSchema.optional(),
  // Accepted or adjusted template-derived training structure.
  trainingBlueprint: trainingBlueprintSchema.optional(),
  // Active adaptive plan. Stored locally so CE and hosted use the same planning model.
  adaptiveTrainingPlan: adaptiveTrainingPlanSchema.optional(),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const resolveWorkoutCreationMode = (
  preferences: Pick<UserPreferences, 'aiFeaturesEnabled'>
): WorkoutCreationMode =>
  preferences.aiFeaturesEnabled === false ? 'library' : 'auto';

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
  coachProgramAttribution: coachProgramAttributionSchema.optional(),
});
export type QuickLogPayload = z.infer<typeof quickLogPayloadSchema>;
