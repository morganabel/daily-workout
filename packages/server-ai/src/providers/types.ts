import type {
  ExerciseCandidatePool,
  ModelPromptCapture,
  PlanningBrief,
} from '@workout-agent-ce/server-core';
import type {
  GenerationRequest,
  GenerationContext,
  TodayPlan,
} from '@workout-agent/shared';
import type { LlmSchemaVersion } from '../llm-transformer';

export type AiProviderName = 'openai' | 'gemini';

export interface AiProviderOptions {
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  candidatePool?: ExerciseCandidatePool;
  planningBrief?: PlanningBrief;
  // Optional passthrough client for testing/mocking
  client?: unknown;
  /**
   * When true, use Vertex AI (ADC) instead of API key.
   * Requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.
   */
  useVertexAi?: boolean;
  promptRecorder?: (capture: ModelPromptCapture) => void;
}

export interface GenerationResult {
  plan: TodayPlan;
  responseId: string;
  /**
   * The LLM schema version that was used to transform the response.
   * This is recorded in generation metadata for debugging and monitoring.
   */
  schemaVersion: LlmSchemaVersion;
}

export interface AiProvider {
  /**
   * Generate a workout plan using the AI provider.
   * @throws {AiGenerationError} on provider or parsing failures
   */
  generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: AiProviderOptions,
  ): Promise<GenerationResult>;
}

export class AiGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_API_KEY' | 'REQUEST_FAILED' | 'INVALID_RESPONSE',
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AiGenerationError';
  }
}
