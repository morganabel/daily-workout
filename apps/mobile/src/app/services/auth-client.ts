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
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import type { MetaResponse } from '@workout-agent/shared';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

// `/api/meta` is stable; keep it fresh-ish but don't spam the server.
// We use stale-while-revalidate: serve cached value immediately and refresh in background.
const SERVER_CAPABILITIES_TTL_MS = 10 * 60_000; // 10 minutes

let cachedServerCapabilities:
  | { data: MetaResponse | null; fetchedAt: number }
  | null = null;
let inFlightServerCapabilities: Promise<MetaResponse | null> | null = null;

async function refreshServerCapabilities(): Promise<MetaResponse | null> {
  if (inFlightServerCapabilities) {
    return inFlightServerCapabilities;
  }

  inFlightServerCapabilities = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/meta`);
      if (!response.ok) {
        console.warn('[auth-client] Failed to fetch server capabilities');
        // Keep the last known value, but bump timestamp so we don't thrash retries.
        const data = cachedServerCapabilities?.data ?? null;
        cachedServerCapabilities = { data, fetchedAt: Date.now() };
        return data;
      }

      const data = (await response.json()) as MetaResponse;
      cachedServerCapabilities = { data, fetchedAt: Date.now() };
      return data;
    } catch (error) {
      console.warn('[auth-client] Error fetching server capabilities:', error);
      // Keep the last known value, but bump timestamp so we don't thrash retries.
      const data = cachedServerCapabilities?.data ?? null;
      cachedServerCapabilities = { data, fetchedAt: Date.now() };
      return data;
    } finally {
      inFlightServerCapabilities = null;
    }
  })();

  return inFlightServerCapabilities;
}

/**
 * Derive a deterministic storage prefix from the backend URL.
 * This ensures sessions from different backends don't collide.
 */
function createStoragePrefix(baseURL: string): string {
  // Expo's built-in hashing (`expo-crypto`) is async; `storagePrefix` must be a sync string.
  // So we derive a stable, readable prefix from the backend URL instead of hashing.
  try {
    const url = new URL(baseURL);
    const host = url.hostname.replace(/[^a-z0-9]/gi, '_');
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    return `auth_${host}_${port}`;
  } catch {
    const normalized = baseURL
      .toLowerCase()
      .replace(/\/$/, '')
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32);
    return `auth_${normalized || 'default'}`;
  }
}

const APP_SCHEME = 'workout-agent-ce-mobile';
const STORAGE_PREFIX = createStoragePrefix(API_BASE_URL);

/**
 * Create the Better Auth client
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: STORAGE_PREFIX,
      storage: SecureStore,
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
  const now = Date.now();
  const cached = cachedServerCapabilities;

  // Fresh cache: return immediately.
  if (cached && now - cached.fetchedAt < SERVER_CAPABILITIES_TTL_MS) {
    return cached.data;
  }

  // Stale cache: return immediately (optimistic) and refresh in background.
  if (cached) {
    void refreshServerCapabilities();
    return cached.data;
  }

  // No cache: we have to fetch (callers can decide whether to await).
  return refreshServerCapabilities();
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
 * Get the current session cookie string for authenticated API requests.
 *
 * On Expo native, cookies are managed by `@better-auth/expo/client` and persisted
 * in SecureStore. For non-auth endpoints (your own API routes), you must attach
 * this cookie string manually as `Cookie: <value>`.
 *
 * IMPORTANT: Never log the returned cookie string.
 */
export function getSessionCookie(): string | null {
  try {
    const cookies = authClient.getCookie();
    if (!cookies) {
      return null;
    }
    const trimmed = cookies.trim();
    return trimmed.length > 0 ? trimmed : null;
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
