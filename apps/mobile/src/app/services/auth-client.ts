/**
 * Better Auth client for mobile
 *
 * Provides authentication functionality with:
 * - Anonymous sign-in for frictionless first-run
 * - Email/password as upgrade path
 * - Session persistence using Expo SecureStore
 * - Per-backend session isolation via storagePrefix
 */

import { createAuthClient } from 'better-auth/react';
import { anonymousClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { MetaResponse } from '@workout-agent/shared';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

/**
 * Derives a storage prefix from the backend URL.
 * This ensures sessions from different backends don't collide.
 */
async function deriveStoragePrefix(url: string): Promise<string> {
  // Normalize URL: lowercase, remove trailing slash
  const normalizedUrl = url.toLowerCase().replace(/\/$/, '');

  // Hash the URL using SHA-256 and take first 8 characters
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalizedUrl
  );

  return `auth_${hash.substring(0, 8)}`;
}

// Storage prefix (computed lazily)
let cachedStoragePrefix: string | null = null;

async function getStoragePrefix(): Promise<string> {
  if (!cachedStoragePrefix) {
    cachedStoragePrefix = await deriveStoragePrefix(API_BASE_URL);
  }
  return cachedStoragePrefix;
}

/**
 * Secure storage implementation using Expo SecureStore
 * with per-backend key prefixing
 */
const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const prefix = await getStoragePrefix();
    const prefixedKey = `${prefix}_${key}`;
    try {
      return await SecureStore.getItemAsync(prefixedKey);
    } catch {
      // Don't log the key value for security
      console.warn('[auth-client] Failed to get item from secure storage');
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const prefix = await getStoragePrefix();
    const prefixedKey = `${prefix}_${key}`;
    try {
      await SecureStore.setItemAsync(prefixedKey, value);
    } catch (error) {
      // Don't log the value for security
      console.warn('[auth-client] Failed to set item in secure storage');
      throw error;
    }
  },
  removeItem: async (key: string): Promise<void> => {
    const prefix = await getStoragePrefix();
    const prefixedKey = `${prefix}_${key}`;
    try {
      await SecureStore.deleteItemAsync(prefixedKey);
    } catch {
      console.warn('[auth-client] Failed to remove item from secure storage');
    }
  },
};

/**
 * Create the Better Auth client
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    expoClient({
      scheme: 'workout-agent-ce-mobile',
      storage: secureStorage,
    }),
    anonymousClient(),
  ],
});

// Export session hook and utilities
export const { useSession, signIn, signUp, signOut } = authClient;

/**
 * Fetch server capabilities from /api/meta
 */
export async function fetchServerCapabilities(): Promise<MetaResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/meta`);
    if (!response.ok) {
      console.warn('[auth-client] Failed to fetch server capabilities');
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('[auth-client] Error fetching server capabilities:', error);
    return null;
  }
}

/**
 * Check if the server supports Better Auth
 */
export async function isAuthEnabled(): Promise<boolean> {
  const meta = await fetchServerCapabilities();
  return meta?.auth.enabled ?? false;
}

/**
 * Sign in anonymously if the server supports it.
 * This is the default flow for first-run experience.
 */
export async function signInAnonymously(): Promise<boolean> {
  try {
    const meta = await fetchServerCapabilities();
    if (!meta?.auth.anonymousAvailable) {
      console.log('[auth-client] Anonymous auth not available on this server');
      return false;
    }

    const result = await authClient.signIn.anonymous();
    if (result.error) {
      console.error('[auth-client] Anonymous sign-in failed:', result.error.message);
      return false;
    }

    console.log('[auth-client] Anonymous sign-in successful');
    return true;
  } catch (error) {
    console.error('[auth-client] Anonymous sign-in error:', error);
    return false;
  }
}

/**
 * Get the current session token for API requests.
 * Returns null if not authenticated.
 *
 * IMPORTANT: Never log the returned token.
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    const session = await authClient.getSession();
    return session.data?.session.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if user has an active session
 */
export async function hasActiveSession(): Promise<boolean> {
  try {
    const session = await authClient.getSession();
    return !!session.data?.session;
  } catch {
    return false;
  }
}
