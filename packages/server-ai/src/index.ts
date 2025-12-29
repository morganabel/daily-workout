/**
 * Server AI package - shareable LLM implementation for workout generation
 *
 * This package implements the ModelRouter interface from server-core
 * and provides OpenAI/Gemini providers, prompts, and transformation logic.
 */

import type {
  ModelRouter,
  GenerationResult,
  ModelGenerationOptions,
} from '@workout-agent-ce/server-core';
import type { GenerationRequest, GenerationContext } from '@workout-agent/shared';
import {
  registerProvider,
  getProvider,
  getDefaultProviderName,
  isSupportedProvider,
  resetProviders,
} from './providers/registry';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import type {
  AiProviderOptions,
  AiProvider,
  AiProviderName,
} from './providers/types';
import { AiGenerationError } from './providers/types';
import {
  transformLlmResponse,
  selectSchemaVersion,
  getDefaultSchemaVersion,
  getSchemaForVersion,
  type LlmSchemaVersion,
  type TransformerConfig,
} from './llm-transformer';

/**
 * Default ModelRouter implementation using the provider registry.
 * This is the shared LLM behavior for both OSS and hosted deployments.
 */
export class DefaultModelRouter implements ModelRouter {
  constructor() {
    // Register providers on instantiation
    registerProvider('openai', new OpenAIProvider());
    registerProvider('gemini', new GeminiProvider());
  }

  async generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: ModelGenerationOptions
  ): Promise<GenerationResult> {
    if (!options.apiKey && !options.useVertexAi) {
      throw new AiGenerationError('Missing API key', 'NO_API_KEY');
    }

    const providerName = options.provider ?? this.getDefaultProvider();
    const provider = getProvider(providerName as AiProviderName);

    if (!provider) {
      throw new AiGenerationError(
        `Provider '${providerName}' is not registered`,
        'REQUEST_FAILED'
      );
    }

    const providerOptions: AiProviderOptions = {
      apiKey: options.apiKey,
      model: options.model,
      useVertexAi: options.useVertexAi,
    };

    return provider.generate(request, context, providerOptions);
  }

  isSupportedProvider(provider: string): boolean {
    return isSupportedProvider(provider);
  }

  getDefaultProvider(): string {
    return getDefaultProviderName();
  }
}

// Re-export types and utilities
export type {
  AiProvider,
  AiProviderName,
  AiProviderOptions,
  LlmSchemaVersion,
  TransformerConfig,
};
export {
  AiGenerationError,
  transformLlmResponse,
  selectSchemaVersion,
  getDefaultSchemaVersion,
  getSchemaForVersion,
  resetProviders, // For testing
};

// Export provider classes for custom router implementations
export { OpenAIProvider, GeminiProvider };
