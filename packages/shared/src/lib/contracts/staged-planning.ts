import { z } from 'zod';

export const planningLoadCeilingSchema = z.enum([
  'low',
  'moderate',
  'high',
  'unknown',
]);
export type PlanningLoadCeiling = z.infer<typeof planningLoadCeilingSchema>;

export const planningStageOneModeSchema = z.enum([
  'single-pass',
  'llm-assisted',
]);
export type PlanningStageOneMode = z.infer<typeof planningStageOneModeSchema>;

export const planningStageOneReasonSchema = z.enum([
  'smart-focus',
  'recent-event-conflict',
  'dense-notes',
  'regeneration-feedback',
]);
export type PlanningStageOneReason = z.infer<
  typeof planningStageOneReasonSchema
>;

export const planningStageOneConfidenceSchema = z.enum([
  'low',
  'medium',
  'high',
]);
export type PlanningStageOneConfidence = z.infer<
  typeof planningStageOneConfidenceSchema
>;

export const planningNoveltyTargetSchema = z.enum(['low', 'medium', 'high']);
export type PlanningNoveltyTarget = z.infer<typeof planningNoveltyTargetSchema>;

export const planningStageOneActivationSchema = z
  .object({
    mode: planningStageOneModeSchema,
    shouldRun: z.boolean(),
    reasons: z.array(planningStageOneReasonSchema),
  })
  .strict();
export type PlanningStageOneActivation = z.infer<
  typeof planningStageOneActivationSchema
>;

export const stageOnePlannerArtifactSchema = z
  .object({
    mode: z.literal('llm-assisted'),
    confidence: planningStageOneConfidenceSchema,
    planningIntent: z.string().min(1),
    resolvedFocus: z.string().min(1).optional(),
    protectStressors: z.array(z.string()),
    avoidStressors: z.array(z.string()),
    styleBiases: z.array(z.string()),
    loadBias: planningLoadCeilingSchema.optional(),
    noveltyTarget: planningNoveltyTargetSchema.optional(),
    rerankHints: z.array(z.string()),
    candidateInstructions: z.array(z.string()),
  })
  .strict();
export type StageOnePlannerArtifact = z.infer<
  typeof stageOnePlannerArtifactSchema
>;
