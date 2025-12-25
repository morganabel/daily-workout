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
