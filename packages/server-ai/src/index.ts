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
  StageOnePlanner,
  StageOnePlanningOptions,
} from '@workout-agent-ce/server-core';
import type {
  GenerationRequest,
  GenerationContext,
} from '@workout-agent/shared';
import {
  registerProvider,
  getProvider,
  getDefaultProviderName,
  isSupportedProvider,
  resetProviders,
} from './providers/registry';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { attachGeneratedIds } from './providers/utils';
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

function ensureProvidersRegistered() {
  registerProvider('openai', new OpenAIProvider());
  registerProvider('gemini', new GeminiProvider());
}

/**
 * Default ModelRouter implementation using the provider registry.
 * This is the shared LLM behavior for both OSS and hosted deployments.
 */
export class DefaultModelRouter implements ModelRouter {
  constructor() {
    ensureProvidersRegistered();
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
      candidatePool: options.candidatePool,
      catalogSeed: options.catalogSeed,
      planningBrief: options.planningBrief,
      stageOneArtifact: options.stageOneArtifact,
      model: options.model,
      promptRecorder: options.promptRecorder,
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

export class DefaultStageOnePlanner implements StageOnePlanner {
  constructor() {
    ensureProvidersRegistered();
  }

  async plan(
    request: GenerationRequest,
    context: GenerationContext,
    options: StageOnePlanningOptions
  ) {
    if (!options.apiKey && !options.useVertexAi) {
      throw new AiGenerationError('Missing API key', 'NO_API_KEY');
    }

    const providerName = options.provider ?? getDefaultProviderName();
    const provider = getProvider(providerName as AiProviderName);

    if (!provider) {
      throw new AiGenerationError(
        `Provider '${providerName}' is not registered`,
        'REQUEST_FAILED'
      );
    }

    const providerOptions: AiProviderOptions = {
      apiKey: options.apiKey,
      candidatePool: options.candidatePool,
      planningBrief: options.planningBrief,
      model: options.model,
      promptRecorder: options.promptRecorder,
      useVertexAi: options.useVertexAi,
    };

    return provider.planStageOne(request, context, providerOptions);
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
  registerProvider, // For testing
  attachGeneratedIds,
};

// Export provider classes for custom router implementations
export { OpenAIProvider, GeminiProvider };
