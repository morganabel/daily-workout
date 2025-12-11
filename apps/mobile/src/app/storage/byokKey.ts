import * as SecureStore from 'expo-secure-store';
import type { AiProvider } from '@workout-agent/shared';

const BYOK_KEY = 'byokApiKey';
const BYOK_PROVIDER_KEY = 'byokProvider';

export type ByokConfig = {
  apiKey: string;
  provider: AiProvider['name'];
};

/**
 * Get the stored BYOK API key (legacy - for backward compatibility)
 * @deprecated Use getByokConfig instead
 */
export async function getByokApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(BYOK_KEY);
  } catch (error) {
    console.warn('Failed to get BYOK key:', error);
    return null;
  }
}

/**
 * Get the stored BYOK configuration (provider + key)
 */
export async function getByokConfig(): Promise<ByokConfig | null> {
  try {
    const apiKey = await SecureStore.getItemAsync(BYOK_KEY);
    const providerStr = await SecureStore.getItemAsync(BYOK_PROVIDER_KEY);
    
    if (!apiKey) {
      return null;
    }
    
    // Default to 'openai' for legacy keys without provider
    const provider = (providerStr === 'gemini' ? 'gemini' : 'openai') as AiProvider['name'];
    
    return { apiKey, provider };
  } catch (error) {
    console.error('Failed to read BYOK config:', error);
    return null;
  }
}

/**
 * Store BYOK configuration (provider + key)
 */
export async function setByokConfig(config: ByokConfig): Promise<void> {
  try {
    await SecureStore.setItemAsync(BYOK_KEY, config.apiKey);
    await SecureStore.setItemAsync(BYOK_PROVIDER_KEY, config.provider);
  } catch (error) {
    console.error('Failed to store BYOK config:', error);
    throw error;
  }
}

/**
 * Store BYOK API key (legacy - for backward compatibility)
 * @deprecated Use setByokConfig instead
 */
export async function setByokApiKey(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(BYOK_KEY, key);
    // Default to openai for legacy calls
    await SecureStore.setItemAsync(BYOK_PROVIDER_KEY, 'openai');
  } catch (error) {
    console.error('Failed to store BYOK key:', error);
    throw error;
  }
}

export async function removeByokApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BYOK_KEY);
    await SecureStore.deleteItemAsync(BYOK_PROVIDER_KEY);
  } catch (error) {
    console.warn('Failed to remove BYOK key:', error);
  }
}
