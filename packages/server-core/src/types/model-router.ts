import type { GenerationRequest, GenerationContext, TodayPlan } from '@workout-agent/shared';

/**
 * Result from a model generation call
 */
export interface GenerationResult {
  plan: TodayPlan;
  responseId?: string;
  schemaVersion?: string;
}

/**
 * Options for model generation
 */
export interface ModelGenerationOptions {
  /**
   * API key for the provider (BYOK or server-managed)
   * IMPORTANT: Keys should be treated as secrets and never logged or persisted
   */
  apiKey?: string;

  /**
   * Model name to use (provider-specific)
   */
  model?: string;

  /**
   * Whether to use Vertex AI for Gemini (server-configured)
   */
  useVertexAi?: boolean;

  /**
   * Provider to use
   */
  provider?: 'openai' | 'gemini';
}

/**
 * ModelRouter defines how the server generates workout plans using LLMs.
 * Implementations can use OpenAI/Gemini directly (OSS default), add caching,
 * proxy through a gateway, or use custom models.
 */
export interface ModelRouter {
  /**
   * Generate a workout plan using an LLM
   * @throws Error if generation fails
   */
  generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: ModelGenerationOptions
  ): Promise<GenerationResult>;

  /**
   * Check if a provider is supported
   */
  isSupportedProvider(provider: string): boolean;

  /**
   * Get the default provider name
   */
  getDefaultProvider(): string;
}
