import { z } from 'zod';

import {
  generationContextSchema,
  generationRequestSchema,
  todayPlanSchema,
} from './workouts';
import {
  stageOnePlannerArtifactSchema,
  type StageOnePlannerArtifact,
} from './staged-planning';

export const MIN_GENERATION_EVALUATION_SCENARIOS = 50;

export const evaluationScenarioIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type EvaluationScenarioId = z.infer<typeof evaluationScenarioIdSchema>;

export const evaluationScenarioTagSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type EvaluationScenarioTag = z.infer<typeof evaluationScenarioTagSchema>;

export const evaluationScenarioModeSchema = z.enum(['initial', 'regeneration']);
export type EvaluationScenarioMode = z.infer<
  typeof evaluationScenarioModeSchema
>;

export const evaluationGenerationRequestSchema = generationRequestSchema.omit({
  provider: true,
});
export type EvaluationGenerationRequest = z.infer<
  typeof evaluationGenerationRequestSchema
>;

export const hardCheckNameSchema = z.enum([
  'schema-validity',
  'duration-fit',
  'focus-fit',
  'equipment-fit',
  'required-exercise-terms',
  'injury-safety',
  'avoid-list-safety',
  'upcoming-event-sensitivity',
  'regeneration-difference',
]);
export type HardCheckName = z.infer<typeof hardCheckNameSchema>;

export const hardCheckStatusSchema = z.enum(['pass', 'fail', 'not-applicable']);
export type HardCheckStatus = z.infer<typeof hardCheckStatusSchema>;

export const generationEvaluationHardExpectationsSchema = z
  .object({
    requireSchemaValidity: z.boolean().default(true),
    durationToleranceMinutes: z.number().int().nonnegative().default(10),
    requiredFocus: z.string().optional(),
    disallowedFocuses: z.array(z.string()).max(5).default([]),
    requireOnlyAvailableEquipment: z.boolean().default(true),
    requiredExerciseTerms: z.array(z.string()).max(20).default([]),
    bannedExerciseTerms: z.array(z.string()).max(20).default([]),
    requireRegenerationDifference: z.boolean().default(false),
    requireUpcomingEventSensitivity: z.boolean().default(false),
    notes: z.array(z.string()).max(10).default([]),
  })
  .strict();
export type GenerationEvaluationHardExpectations = z.infer<
  typeof generationEvaluationHardExpectationsSchema
>;

export const generationEvaluationScenarioSchema = z
  .object({
    id: evaluationScenarioIdSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(evaluationScenarioTagSchema).min(2).max(12),
    mode: evaluationScenarioModeSchema,
    request: evaluationGenerationRequestSchema,
    context: generationContextSchema.optional(),
    baselinePlan: todayPlanSchema.optional(),
    hardExpectations: generationEvaluationHardExpectationsSchema,
    softReviewHints: z.array(z.string()).max(8).optional(),
  })
  .strict()
  .superRefine((scenario, ctx) => {
    const hasRegenerationInputs =
      Boolean(scenario.request.previousResponseId) ||
      Boolean(scenario.request.feedback?.length);

    if (scenario.mode === 'initial' && hasRegenerationInputs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'initial scenarios cannot include previousResponseId or feedback',
        path: ['request'],
      });
    }

    if (scenario.mode === 'regeneration') {
      if (!scenario.request.previousResponseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'regeneration scenarios require previousResponseId',
          path: ['request', 'previousResponseId'],
        });
      }

      if (!scenario.request.feedback?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'regeneration scenarios require at least one feedback value',
          path: ['request', 'feedback'],
        });
      }

      if (!scenario.hardExpectations.requireRegenerationDifference) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'regeneration scenarios must require regeneration difference',
          path: ['hardExpectations', 'requireRegenerationDifference'],
        });
      }

      if (!scenario.baselinePlan) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'regeneration scenarios require a baselinePlan',
          path: ['baselinePlan'],
        });
      }
    }

    if (
      scenario.hardExpectations.requireUpcomingEventSensitivity &&
      scenario.hardExpectations.disallowedFocuses.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'upcoming-event sensitivity checks require disallowedFocuses heuristics',
        path: ['hardExpectations', 'disallowedFocuses'],
      });
    }

    if (
      scenario.hardExpectations.requireUpcomingEventSensitivity &&
      !scenario.request.upcomingEvents?.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'upcoming-event sensitivity checks require upcomingEvents on the request',
        path: ['request', 'upcomingEvents'],
      });
    }
  });
export type GenerationEvaluationScenario = z.infer<
  typeof generationEvaluationScenarioSchema
>;

export const generationEvaluationCorpusSchema = z
  .object({
    version: z.string().min(1),
    rubricVersion: z.string().min(1),
    scenarios: z
      .array(generationEvaluationScenarioSchema)
      .min(MIN_GENERATION_EVALUATION_SCENARIOS),
  })
  .strict()
  .superRefine((corpus, ctx) => {
    const ids = new Set<string>();
    const titles = new Set<string>();
    let regenerationCount = 0;

    corpus.scenarios.forEach((scenario, index) => {
      if (ids.has(scenario.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate scenario id '${scenario.id}'`,
          path: ['scenarios', index, 'id'],
        });
      }
      ids.add(scenario.id);

      const normalizedTitle = scenario.title.trim().toLowerCase();
      if (titles.has(normalizedTitle)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate scenario title '${scenario.title}'`,
          path: ['scenarios', index, 'title'],
        });
      }
      titles.add(normalizedTitle);

      if (scenario.mode === 'regeneration') {
        regenerationCount += 1;
      }
    });

    if (regenerationCount < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'corpus must include at least 8 regeneration scenarios',
        path: ['scenarios'],
      });
    }
  });
export type GenerationEvaluationCorpus = z.infer<
  typeof generationEvaluationCorpusSchema
>;

export const generationEvaluationProviderSchema = z.enum([
  'openai',
  'gemini',
  'fixture',
]);
export type GenerationEvaluationProvider = z.infer<
  typeof generationEvaluationProviderSchema
>;

export const generationEvaluationRunStatusSchema = z.enum([
  'success',
  'generation-error',
  'validation-error',
  'skipped',
]);
export type GenerationEvaluationRunStatus = z.infer<
  typeof generationEvaluationRunStatusSchema
>;

export const generationEvaluationExecutionSourceSchema = z.enum([
  'live',
  'fixture',
]);
export type GenerationEvaluationExecutionSource = z.infer<
  typeof generationEvaluationExecutionSourceSchema
>;

export const generationEvaluationHardCheckResultSchema = z
  .object({
    name: hardCheckNameSchema,
    status: hardCheckStatusSchema,
    message: z.string().optional(),
  })
  .strict();
export type GenerationEvaluationHardCheckResult = z.infer<
  typeof generationEvaluationHardCheckResultSchema
>;

export const softReviewDimensionSchema = z.enum([
  'clarity',
  'plausibility',
  'novelty',
  'appeal',
  'goal-fit',
]);
export type SoftReviewDimension = z.infer<typeof softReviewDimensionSchema>;

export const softReviewReviewerSchema = z.enum(['manual', 'ai']);
export type SoftReviewReviewer = z.infer<typeof softReviewReviewerSchema>;

export const generationEvaluationSoftReviewScoreSchema = z
  .object({
    dimension: softReviewDimensionSchema,
    score: z.number().int().min(1).max(5),
    rationale: z.string().optional(),
  })
  .strict();
export type GenerationEvaluationSoftReviewScore = z.infer<
  typeof generationEvaluationSoftReviewScoreSchema
>;

export const generationEvaluationSoftReviewResultSchema = z
  .object({
    reviewer: softReviewReviewerSchema,
    rubricVersion: z.string().min(1),
    scores: z.array(generationEvaluationSoftReviewScoreSchema).min(1),
    notes: z.string().optional(),
  })
  .strict();
export type GenerationEvaluationSoftReviewResult = z.infer<
  typeof generationEvaluationSoftReviewResultSchema
>;

export const generationEvaluationProviderPromptSchema = z
  .object({
    provider: generationEvaluationProviderSchema,
    model: z.string().min(1).optional(),
    schemaVersion: z.string().min(1).optional(),
    isRegeneration: z.boolean(),
    phase: z.enum(['stage-one-planner', 'stage-two-generation']).optional(),
    content: z.string().min(1),
  })
  .strict();
export type GenerationEvaluationProviderPrompt = z.infer<
  typeof generationEvaluationProviderPromptSchema
>;

export const generationEvaluationPlannerArtifactSchema =
  stageOnePlannerArtifactSchema;
export type GenerationEvaluationPlannerArtifact = StageOnePlannerArtifact;

export const generationEvaluationPlannerSummarySchema = z
  .object({
    usedStageOne: z.boolean(),
    artifact: generationEvaluationPlannerArtifactSchema.optional(),
    stageOnePrompt: generationEvaluationProviderPromptSchema.optional(),
  })
  .strict();
export type GenerationEvaluationPlannerSummary = z.infer<
  typeof generationEvaluationPlannerSummarySchema
>;

export const generationEvaluationLatencySchema = z
  .object({
    totalRequestMs: z.number().int().nonnegative(),
    stageOnePlannerMs: z.number().int().nonnegative().optional(),
    stageTwoGenerationMs: z.number().int().nonnegative().optional(),
  })
  .strict();
export type GenerationEvaluationLatency = z.infer<
  typeof generationEvaluationLatencySchema
>;

export const generationEvaluationAverageLatencySchema = z
  .object({
    totalRequestMs: z.number().nonnegative(),
    stageOnePlannerMs: z.number().nonnegative().optional(),
    stageTwoGenerationMs: z.number().nonnegative().optional(),
  })
  .strict();
export type GenerationEvaluationAverageLatency = z.infer<
  typeof generationEvaluationAverageLatencySchema
>;

export const generationEvaluationCatalogDecisionSchema = z.enum([
  'skipped',
  'returned',
  'provider',
  'no-match',
  'unknown',
]);
export type GenerationEvaluationCatalogDecision = z.infer<
  typeof generationEvaluationCatalogDecisionSchema
>;

export const generationEvaluationCatalogRoutingSchema = z
  .object({
    creationMode: z.enum(['auto', 'library', 'ai']),
    catalogDecision: generationEvaluationCatalogDecisionSchema,
    returnedSource: z.enum(['ai', 'manual', 'library']).optional(),
    providerInvoked: z.boolean(),
    providerPromptCaptured: z.boolean(),
    catalogReturned: z.boolean(),
  })
  .strict();
export type GenerationEvaluationCatalogRouting = z.infer<
  typeof generationEvaluationCatalogRoutingSchema
>;

export const generationEvaluationReportEntrySchema = z
  .object({
    scenarioId: evaluationScenarioIdSchema,
    scenarioTitle: z.string().min(1),
    scenarioDescription: z.string().min(1),
    scenarioTags: z.array(evaluationScenarioTagSchema),
    scenarioMode: evaluationScenarioModeSchema,
    runId: z.string().min(1),
    provider: generationEvaluationProviderSchema,
    executionSource: generationEvaluationExecutionSourceSchema,
    status: generationEvaluationRunStatusSchema,
    request: evaluationGenerationRequestSchema,
    context: generationContextSchema.optional(),
    baselinePlan: todayPlanSchema.optional(),
    hardChecks: z.array(generationEvaluationHardCheckResultSchema),
    softReview: generationEvaluationSoftReviewResultSchema.optional(),
    latencyMs: generationEvaluationLatencySchema,
    catalogRouting: generationEvaluationCatalogRoutingSchema,
    plannerSummary: generationEvaluationPlannerSummarySchema,
    providerPrompt: generationEvaluationProviderPromptSchema.optional(),
    plan: todayPlanSchema.optional(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
  })
  .strict();
export type GenerationEvaluationReportEntry = z.infer<
  typeof generationEvaluationReportEntrySchema
>;

export const generationEvaluationReportSchema = z
  .object({
    corpusVersion: z.string().min(1),
    rubricVersion: z.string().min(1),
    generatedAt: z.string().datetime(),
    summary: z
      .object({
        totalEntries: z.number().int().nonnegative(),
        successfulEntries: z.number().int().nonnegative(),
        failedEntries: z.number().int().nonnegative(),
        liveEntries: z.number().int().nonnegative(),
        fixtureEntries: z.number().int().nonnegative(),
        executionSourceCounts: z.record(
          z.string(),
          z.number().int().nonnegative()
        ),
        hardFailureCounts: z.record(z.string(), z.number().int().nonnegative()),
        averageLatencyMs: generationEvaluationAverageLatencySchema,
        averageLatencyByProvider: z.record(
          z.string(),
          generationEvaluationAverageLatencySchema
        ),
      })
      .strict(),
    entries: z.array(generationEvaluationReportEntrySchema),
  })
  .strict();
export type GenerationEvaluationReport = z.infer<
  typeof generationEvaluationReportSchema
>;

export function validateGenerationEvaluationCorpus(
  corpus: unknown
): GenerationEvaluationCorpus {
  return generationEvaluationCorpusSchema.parse(corpus);
}
