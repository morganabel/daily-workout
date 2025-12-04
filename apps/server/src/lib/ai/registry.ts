import { AiProvider } from './providers/types';
import { OpenAiProvider } from './providers/openai';
import { GoogleGenAiProvider } from './providers/google';
import { OpenAiChatProvider } from './providers/openai-compatible';

export const providers: Record<string, AiProvider> = {
  openai: new OpenAiProvider(),
  gemini: new GoogleGenAiProvider(),
  deepseek: new OpenAiChatProvider(
    'deepseek',
    'https://api.deepseek.com',
    'deepseek-chat',
  ),
  mistral: new OpenAiChatProvider(
    'mistral',
    'https://api.mistral.ai/v1',
    'mistral-small-latest',
  ),
  groq: new OpenAiChatProvider(
    'groq',
    'https://api.groq.com/openai/v1',
    'llama3-8b-8192',
  ),
};

export function getProvider(id: string): AiProvider | undefined {
  return providers[id];
}
