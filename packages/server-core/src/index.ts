export const PROTOCOL_VERSION = '1.0.0';

// Export core types
export type {
  AuthProvider,
  AuthResult,
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

// Export OSS default implementations
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
  loadGenerationContext,
  type ApiError,
  type ApiErrorCode,
  type GenerationRequestWithContext,
} from './utils';
