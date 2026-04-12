export const PROTOCOL_VERSION = '1.0.0';

// Export core types
export type {
  AuthProvider,
  AuthResult,
  ExerciseCandidatePool,
  ExerciseCandidateReference,
  GenerationStore,
  GenerationState,
  TransformationMetadata,
  ModelRouter,
  GenerationResult,
  ModelGenerationOptions,
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
  createSnapshotHandler,
  createGenerateHandler,
  createLogWorkoutHandler,
  type SnapshotHandlerDeps,
  type GenerateHandlerDeps,
  type GenerateHandlerConfig,
  type LogWorkoutHandlerDeps,
} from './handlers';

// Export utilities
export {
  createErrorResponse,
  buildQuickActions,
  buildExerciseCandidatePool,
  loadGenerationContext,
  type ApiError,
  type ApiErrorCode,
  type BuildExerciseCandidatePoolParams,
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
