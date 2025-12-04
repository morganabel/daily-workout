import type {
  GenerationRequest,
  GenerationContext,
  TodayPlan,
} from '@workout-agent/shared';

export type GeneratePlanOptions = {
  apiKey: string;
  apiBaseUrl?: string; // For custom providers
  model?: string;
  providerId?: string;
};

export type AiProviderResult = {
  plan: TodayPlan;
  responseId: string;
};

export interface AiProvider {
  id: string;
  generatePlan(
    request: GenerationRequest,
    context: GenerationContext,
    options: GeneratePlanOptions,
  ): Promise<AiProviderResult>;
}
