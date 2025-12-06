import type {
  GenerationRequest,
  GenerationContext,
  TodayPlan,
} from '@workout-agent/shared';

export type AiProviderName = 'openai' | 'gemini';

export interface AiProviderOptions {
  apiKey: string;
  model?: string;
  apiBaseUrl?: string;
}

export interface GenerationResult {
  plan: TodayPlan;
  responseId: string;
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

