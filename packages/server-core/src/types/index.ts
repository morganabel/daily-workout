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
  CatalogSeed,
  ModelPromptCapture,
  GenerationResult,
  ModelGenerationOptions,
} from './model-router';
export type {
  StageOnePlanner,
  StageOnePlanningOptions,
} from './stage-one-planner';
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
  PlanningUserConstraints,
  PlanningVariationMode,
  StageOnePlannerArtifact,
} from './planning';
export type { UsagePolicy, PolicyResult, Entitlements } from './policy';
export type { MeteringSink, UsageEvent } from './metering';
