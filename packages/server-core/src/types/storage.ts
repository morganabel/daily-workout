import type { GenerationStatus, TodayPlan } from '@workout-agent/shared';

/**
 * Metadata about LLM transformation
 */
export interface TransformationMetadata {
  /** The LLM schema version used to parse and transform the response */
  schemaVersion: string;
  /** Timestamp when the transformation was performed */
  transformedAt: string;
}

/**
 * Generation state stored per device
 */
export interface GenerationState {
  plan: TodayPlan | null;
  generationStatus: GenerationStatus;
  /**
   * Metadata about the LLM transformation that was applied to create `plan`.
   *
   * This is internal server state used for debugging and monitoring.
   * It is intentionally optional because not all plans go through the LLM
   * transformation layer (e.g. mock plans or legacy flows).
   */
  transformationMetadata?: TransformationMetadata;
}

/**
 * GenerationStore defines how the server persists generation state.
 * Implementations can use in-memory Map (OSS default), Redis, or a database.
 */
export interface GenerationStore {
  /**
   * Get generation state for a device
   */
  getState(deviceToken: string): Promise<GenerationState>;

  /**
   * Mark generation as pending with estimated completion time
   */
  markPending(deviceToken: string, etaSeconds: number): Promise<void>;

  /**
   * Persist a generated plan and mark generation as complete
   */
  persistPlan(
    deviceToken: string,
    plan: TodayPlan,
    metadata?: { schemaVersion?: string }
  ): Promise<void>;

  /**
   * Record a generation error
   */
  setError(deviceToken: string, message: string): Promise<void>;

  /**
   * Clear stored plan for a device
   */
  clearPlan(deviceToken: string): Promise<void>;
}
