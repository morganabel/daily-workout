import type {
  GenerationStatus,
  TodayPlan,
} from '@workout-agent/shared';
import type { LlmSchemaVersion } from './llm-transformer';

export type GenerationState = {
  plan: TodayPlan | null;
  generationStatus: GenerationStatus;
  /**
   * Metadata about the transformation that was applied to create this plan.
   * This is internal server state used for debugging and monitoring.
   */
  transformationMetadata?: {
    /** The LLM schema version used to parse and transform the response */
    schemaVersion: LlmSchemaVersion;
    /** Timestamp when the transformation was performed */
    transformedAt: string;
  };
};

const stateByDevice = new Map<string, GenerationState>();

const createIdleStatus = (): GenerationStatus => ({
  state: 'idle',
  submittedAt: null,
});

const cloneStatus = (status: GenerationStatus): GenerationStatus => ({
  state: status.state,
  submittedAt: status.submittedAt,
  etaSeconds: status.etaSeconds,
  message: status.message,
});

const ensureState = (deviceToken: string): GenerationState => {
  let state = stateByDevice.get(deviceToken);
  if (!state) {
    state = {
      plan: null,
      generationStatus: createIdleStatus(),
    };
    stateByDevice.set(deviceToken, state);
  }
  return state;
};

export const DEFAULT_GENERATION_ETA_SECONDS = 18;

export function getGenerationState(deviceToken: string): GenerationState {
  const state = ensureState(deviceToken);
  return {
    plan: state.plan,
    generationStatus: cloneStatus(state.generationStatus),
  };
}

export function markGenerationPending(
  deviceToken: string,
  etaSeconds: number = DEFAULT_GENERATION_ETA_SECONDS,
) {
  const state = ensureState(deviceToken);
  state.generationStatus = {
    state: 'pending',
    submittedAt: new Date().toISOString(),
    etaSeconds,
  };
}

export function persistGeneratedPlan(
  deviceToken: string,
  plan: TodayPlan,
  metadata?: {
    schemaVersion?: LlmSchemaVersion;
  },
) {
  const state = ensureState(deviceToken);
  state.plan = plan;
  state.generationStatus = createIdleStatus();

  // Record transformation metadata if provided
  if (metadata?.schemaVersion) {
    state.transformationMetadata = {
      schemaVersion: metadata.schemaVersion,
      transformedAt: new Date().toISOString(),
    };
  }
}

export function setGenerationError(deviceToken: string, message: string) {
  const state = ensureState(deviceToken);
  state.generationStatus = {
    state: 'error',
    submittedAt:
      state.generationStatus.submittedAt ?? new Date().toISOString(),
    message,
  };
}

export function clearStoredPlan(deviceToken: string) {
  const state = ensureState(deviceToken);
  state.plan = null;
  state.generationStatus = createIdleStatus();
}

export function resetGenerationStore() {
  stateByDevice.clear();
}
