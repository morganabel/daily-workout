import * as SecureStore from 'expo-secure-store';
import type { AiProvider } from '@leveza/shared';
import { getActiveStorageScopeId } from '../db/activeDatabase';

const LEGACY_BYOK_KEY = 'byokApiKey';
const LEGACY_PROVIDER_KEY = 'byokProvider';
const LEGACY_CLEANUP_MARKER = 'scopedByokCleanupV1';

export type ByokConfig = {
  apiKey: string;
  provider: AiProvider['name'];
};

const scopedKeys = (dataScopeId: string) => ({
  apiKey: `byok.${dataScopeId}.apiKey`,
  provider: `byok.${dataScopeId}.provider`,
});

async function ensureLegacyByokRemoved(): Promise<void> {
  if (await SecureStore.getItemAsync(LEGACY_CLEANUP_MARKER)) return;
  await SecureStore.deleteItemAsync(LEGACY_BYOK_KEY);
  await SecureStore.deleteItemAsync(LEGACY_PROVIDER_KEY);
  await SecureStore.setItemAsync(LEGACY_CLEANUP_MARKER, '1');
}

export async function getByokConfig(): Promise<ByokConfig | null> {
  const dataScopeId = getActiveStorageScopeId();
  await ensureLegacyByokRemoved();
  const keys = scopedKeys(dataScopeId);
  try {
    const [apiKey, providerStr] = await Promise.all([
      SecureStore.getItemAsync(keys.apiKey),
      SecureStore.getItemAsync(keys.provider),
    ]);
    if (!apiKey) return null;

    const provider: AiProvider['name'] =
      providerStr === 'gemini' || providerStr === 'openrouter'
        ? providerStr
        : 'openai';
    return { apiKey, provider };
  } catch (error) {
    console.error('Failed to read scoped BYOK config:', error);
    return null;
  }
}

export async function setByokConfig(config: ByokConfig): Promise<void> {
  const dataScopeId = getActiveStorageScopeId();
  await ensureLegacyByokRemoved();
  const keys = scopedKeys(dataScopeId);
  try {
    await SecureStore.setItemAsync(keys.apiKey, config.apiKey);
    await SecureStore.setItemAsync(keys.provider, config.provider);
  } catch (error) {
    console.error('Failed to store scoped BYOK config:', error);
    throw error;
  }
}

export async function removeByokConfig(): Promise<void> {
  const dataScopeId = getActiveStorageScopeId();
  await removeByokConfigForStorageScope(dataScopeId);
}

export async function removeByokConfigForStorageScope(
  dataScopeId: string
): Promise<void> {
  await ensureLegacyByokRemoved();
  const keys = scopedKeys(dataScopeId);
  try {
    await SecureStore.deleteItemAsync(keys.apiKey);
    await SecureStore.deleteItemAsync(keys.provider);
  } catch (error) {
    console.warn('Failed to remove scoped BYOK config:', error);
  }
}
