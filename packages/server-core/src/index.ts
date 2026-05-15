export const PROTOCOL_VERSION = '1.0.0';

// Export core types
export type {
  AuthProvider,
  AuthResult,
  ExerciseCandidatePool,
  ExerciseCandidateDiagnostics,
  ExerciseCandidateReference,
  ModelPromptCapture,
  GenerationStore,
  GenerationState,
  TransformationMetadata,
  ModelRouter,
  StageOnePlanner,
  StageOnePlanningOptions,
  GenerationResult,
  ModelGenerationOptions,
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
  UsagePolicy,
  PolicyResult,
  Entitlements,
  MeteringSink,
  UsageEvent,
} from './types';

// Export CE default implementations
export {
  StubAuthProvider,
  InMemoryGenerationStore,
  NoOpUsagePolicy,
  NoOpMeteringSink,
} from './defaults';

// Export handler factories
export {
  createGenerateHandler,
  createLogWorkoutHandler,
  type GenerateHandlerDeps,
  type GenerateHandlerConfig,
  type LogWorkoutHandlerDeps,
} from './handlers';

// Export utilities
export {
  createErrorResponse,
  buildExerciseCandidatePool,
  rerankExerciseCandidatePool,
  determineStageOnePlanningActivation,
  derivePlanningBrief,
  loadGenerationContext,
  type ApiError,
  type ApiErrorCode,
  type BuildExerciseCandidatePoolParams,
  type DetermineStageOnePlanningActivationParams,
  type DerivePlanningBriefParams,
  type ExerciseCandidatePoolSummary,
  type GenerationRequestWithContext,
  safeLog,
  redactSecrets,
  redactSecretsAndPii,
  redactSensitiveStrings,
  getLogger,
  createLogger,
  getOrCreateRequestId,
  attachRequestId,
  getUrlPath,
  createRequestContext,
  type Logger,
  type LoggerContext,
  type LogLevel,
  type RequestContext,
} from './utils';

export {
  runHardChecksForScenario,
  summarizeHardFailures,
} from './evaluation/hard-checks';
