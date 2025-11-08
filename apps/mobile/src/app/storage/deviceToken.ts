/**
 * DeviceToken storage utilities
 */

import * as SecureStore from 'expo-secure-store';

const DEVICE_TOKEN_KEY = 'deviceToken';

/**
 * Get stored device token
 */
export async function getDeviceToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
  } catch (error) {
    console.warn('Failed to get device token:', error);
    return null;
  }
}

/**
 * Store device token
 */
export async function setDeviceToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store device token:', error);
    throw error;
  }
}

/**
 * Remove device token
 */
export async function removeDeviceToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
  } catch (error) {
    console.warn('Failed to remove device token:', error);
  }
}

