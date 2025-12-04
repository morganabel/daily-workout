import * as SecureStore from 'expo-secure-store';

const BYOK_KEY = 'byokApiKey';
const BYOK_PROVIDER_ID = 'byokProviderId';

export async function getByokApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(BYOK_KEY);
  } catch (error) {
    console.warn('Failed to get BYOK key:', error);
    return null;
  }
}

export async function getByokProviderId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(BYOK_PROVIDER_ID);
  } catch (error) {
    console.warn('Failed to get BYOK provider ID:', error);
    return null;
  }
}

export async function setByokConfiguration(
  key: string,
  providerId: string,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(BYOK_KEY, key);
    await SecureStore.setItemAsync(BYOK_PROVIDER_ID, providerId);
  } catch (error) {
    console.error('Failed to store BYOK config:', error);
    throw error;
  }
}

export async function setByokApiKey(key: string): Promise<void> {
  // Default to openai if using legacy setter
  return setByokConfiguration(key, 'openai');
}

export async function removeByokConfiguration(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BYOK_KEY);
    await SecureStore.deleteItemAsync(BYOK_PROVIDER_ID);
  } catch (error) {
    console.warn('Failed to remove BYOK config:', error);
  }
}

export const removeByokApiKey = removeByokConfiguration;
