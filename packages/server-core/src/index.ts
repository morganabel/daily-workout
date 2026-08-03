export const PROTOCOL_VERSION = '1.0.0';

// Export core types
export type {
  AuthProvider,
  AuthResult,
  CatalogSeed,
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
  ModelCallRecorder,
  ModelCallUsage,
  GenerationUsageSummary,
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
  type GenerateHandlerDeps,
  type GenerateHandlerConfig,
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
  resolveProviderCredential,
  type ProviderCredentialSource,
  type ResolvedProviderCredential,
  type ResolveProviderCredentialParams,
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
