import {
  GenerationRequest,
  GenerationContext,
} from '@workout-agent/shared';
import { getProvider } from './ai/registry';
import { GeneratePlanOptions, AiProviderResult } from './ai/providers/types';
import { AiGenerationError } from './ai/utils';

export type { GeneratePlanOptions };
export type GenerationResult = AiProviderResult;
export { AiGenerationError };

export async function generateTodayPlanAI(
  request: GenerationRequest,
  context: GenerationContext,
  options: GeneratePlanOptions,
): Promise<GenerationResult> {
  const providerId = options.providerId || 'openai';
  const provider = getProvider(providerId);

  if (!provider) {
    throw new AiGenerationError(
      `Unknown provider: ${providerId}`,
      'REQUEST_FAILED',
    );
  }

  return provider.generatePlan(request, context, options);
}
