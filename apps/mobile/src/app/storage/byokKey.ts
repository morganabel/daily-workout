import * as SecureStore from 'expo-secure-store';

const BYOK_KEY = 'byokApiKey';

export async function getByokApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(BYOK_KEY);
  } catch (error) {
    console.warn('Failed to get BYOK key:', error);
    return null;
  }
}

export async function setByokApiKey(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(BYOK_KEY, key);
  } catch (error) {
    console.error('Failed to store BYOK key:', error);
    throw error;
  }
}

export async function removeByokApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BYOK_KEY);
  } catch (error) {
    console.warn('Failed to remove BYOK key:', error);
  }
}
