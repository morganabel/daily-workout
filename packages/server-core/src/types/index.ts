/**
 * Core type definitions for dependency injection
 */

export type { AuthProvider, AuthResult } from './auth';
export type {
  GenerationStore,
  GenerationState,
  TransformationMetadata,
} from './storage';
export type {
  ModelRouter,
  ExerciseCandidatePool,
  ExerciseCandidateDiagnostics,
  ExerciseCandidateReference,
  ModelPromptCapture,
  GenerationResult,
  ModelGenerationOptions,
} from './model-router';
export type {
  PlanningBrief,
  PlanningBlockIntent,
  PlanningEventProtection,
  PlanningFallbackMode,
  PlanningFocusMode,
  PlanningLoadCeiling,
  PlanningNoveltyTarget,
  PlanningRegenerationMode,
  PlanningRegenerationSummary,
  PlanningStageOneActivation,
  PlanningStageOneConfidence,
  PlanningStageOneMode,
  PlanningStageOneReason,
  PlanningVariationMode,
  StageOnePlannerArtifact,
} from './planning';
export type { UsagePolicy, PolicyResult, Entitlements } from './policy';
export type { MeteringSink, UsageEvent } from './metering';
