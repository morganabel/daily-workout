import type { AiProvider, AiProviderName } from './types';

const providers = new Map<AiProviderName, AiProvider>();

export function registerProvider(name: AiProviderName, provider: AiProvider): void {
  providers.set(name, provider);
}

export function getProvider(name: AiProviderName): AiProvider | undefined {
  return providers.get(name);
}

export function getDefaultProviderName(): AiProviderName {
  const envProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (envProvider === 'gemini') {
    return 'gemini';
  }
  return 'openai'; // Default to OpenAI
}

export function isSupportedProvider(name: string): name is AiProviderName {
  return name === 'openai' || name === 'gemini';
}

