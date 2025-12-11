import type {
  GenerationRequest,
  GenerationContext,
} from '@workout-agent/shared';
import type { GenerationResult, AiProviderOptions } from './ai-providers/types';
import { AiGenerationError } from './ai-providers/types';
import {
  getProvider,
  getDefaultProviderName,
} from './ai-providers/registry';

export type GeneratePlanOptions = {
  apiKey?: string;
  model?: string;
  apiBaseUrl?: string;
  provider?: 'openai' | 'gemini';
  useVertexAi?: boolean;
  client?: unknown;
};

/**
 * Calls the AI provider to generate a TodayPlan payload.
 * Throws AiGenerationError on provider or parsing failures.
 *
 * When previousResponseId is provided, uses conversational follow-up instead of
 * full structured request, allowing the LLM to reference the previous workout.
 */
export async function generateTodayPlanAI(
  request: GenerationRequest,
  context: GenerationContext,
  options: GeneratePlanOptions,
): Promise<GenerationResult> {
  if (!options.apiKey && !options.useVertexAi) {
    throw new AiGenerationError('Missing API key', 'NO_API_KEY');
  }

  const providerName = options.provider ?? getDefaultProviderName();
  const provider = getProvider(providerName);

  if (!provider) {
    throw new AiGenerationError(
      `Provider '${providerName}' is not registered`,
      'REQUEST_FAILED',
    );
  }

  const providerOptions: AiProviderOptions = {
    apiKey: options.apiKey,
    model: options.model,
    apiBaseUrl: options.apiBaseUrl,
    client: options.client,
    useVertexAi: options.useVertexAi,
  };

  return provider.generate(request, context, providerOptions);
}

// Re-export for backward compatibility
export { AiGenerationError } from './ai-providers/types';
export type { GenerationResult } from './ai-providers/types';
