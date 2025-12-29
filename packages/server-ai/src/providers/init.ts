import { registerProvider } from './registry';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

/**
 * Initialize and register all AI providers.
 * This should be called during server startup.
 */
export function initializeProviders(): void {
  registerProvider('openai', new OpenAIProvider());
  registerProvider('gemini', new GeminiProvider());
}

