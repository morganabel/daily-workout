/**
 * Better Auth client for mobile
 *
 * Provides authentication functionality with:
 * - Anonymous sign-in for frictionless first-run
 * - Email/password as upgrade path
 * - Google OAuth in the system browser when the server advertises it
 * - Session persistence using Expo SecureStore
 * - Per-backend session isolation via storagePrefix
 */

import { createAuthClient } from 'better-auth/react';
import { anonymousClient } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { resetRevenueCatLogin } from './billing-client';
import { backendDescriptor } from './backendDescriptor';
import { hasCompletedGoogleSignIn } from './google-auth-verification';
import { fetchServerCapabilities } from './server-capabilities';
import { retryExistingAccountSignIn } from './existingAccountSignIn';
import {
  completePendingAccountTransition,
  discardStorageScopeForUser,
  getOrCreateStorageScopeForUser,
  getOrCreateStubSubjectId,
  getPendingAccountTransition,
  getStorageScopeForAuthenticatedUser,
  preparePendingAccountTransition,
} from '../storage/accountTransition';
import {
  activateMobileDataScope,
  deactivateMobileDataScope,
  discardMobileDataScope,
} from '../db/activeDatabase';
import { removeByokConfigForStorageScope } from '../storage/byokKey';

const API_BASE_URL = backendDescriptor.baseURL;

const APP_SCHEME = 'leveza';
const STORAGE_PREFIX = backendDescriptor.authStoragePrefix;

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
export const { useSession, signIn, signUp } = authClient;

export const signOut: typeof authClient.signOut = async (...args) => {
  const result = await authClient.signOut(...args);
  if (!('error' in result) || !result.error) {
    deactivateMobileDataScope();
  }
  try {
    await resetRevenueCatLogin();
  } catch (error) {
    console.warn(
      '[auth-client] Failed to reset RevenueCat session on sign-out',
      error
    );
  }
  return result;
};

export type GoogleSignInResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'unavailable' | 'conflict' | 'failed';
      message: string;
    };

export type SessionUser = { id: string; isAnonymous?: boolean };

export async function discardAnonymousAccount(
  anonymousUser: SessionUser,
  anonymousCookie: string | null
): Promise<void> {
  if (!anonymousUser.isAnonymous || !anonymousCookie) {
    throw new Error('anonymous_account_session_missing');
  }
  const deleted = await authClient.deleteAnonymousUser({
    fetchOptions: {
      headers: { Cookie: anonymousCookie },
    },
  });
  if (deleted.error) {
    throw new Error('anonymous_account_delete_failed');
  }

  const storageScopeId = await discardStorageScopeForUser(anonymousUser.id);
  const cleanupTasks: Promise<unknown>[] = [resetRevenueCatLogin()];
  if (storageScopeId) {
    cleanupTasks.push(
      removeByokConfigForStorageScope(storageScopeId),
      discardMobileDataScope(storageScopeId)
    );
  } else {
    deactivateMobileDataScope();
  }

  const cleanupResults = await Promise.allSettled(cleanupTasks);
  if (cleanupResults.some((result) => result.status === 'rejected')) {
    console.warn('[auth-client] Anonymous local cleanup was incomplete');
  }
}

export function getAccountTransitionErrorMessage(
  error: {
    code?: string;
  } | null
): string | null {
  if (
    error?.code === 'target_has_application_state' ||
    error?.code === 'source_target_conflict'
  ) {
    return 'This existing account already has data and cannot be combined automatically. Your anonymous data was kept unchanged.';
  }
  return null;
}

export async function prepareAuthAccountTransition(
  provider: 'credential' | 'google'
): Promise<SessionUser | null> {
  const session = await authClient.getSession();
  const user = session.data?.user as SessionUser | undefined;
  if (!user) return null;
  if (user.isAnonymous) {
    await preparePendingAccountTransition(user.id, provider);
  }
  return user;
}

async function verifyServerAccountTransition(
  sourceUserId: string,
  targetUserId: string
): Promise<boolean> {
  const cookie = await authClient.getCookie();
  const response = await fetch(
    `${API_BASE_URL}/api/account-transition/status?sourceUserId=${encodeURIComponent(
      sourceUserId
    )}`,
    {
      headers: cookie ? { Cookie: cookie } : undefined,
    }
  );
  if (!response.ok) return false;
  const body = (await response.json()) as {
    sourceUserId?: string;
    targetUserId?: string;
    state?: string;
  };
  return (
    body.sourceUserId === sourceUserId &&
    body.targetUserId === targetUserId &&
    body.state === 'completed'
  );
}

export async function verifyAuthAccountTransition(
  previousUser: SessionUser | null,
  expectedProvider: 'credential' | 'google'
): Promise<boolean> {
  const refreshed = await authClient.getSession({
    query: { disableCookieCache: true },
  });
  const currentUser = refreshed.data?.user as SessionUser | undefined;
  if (refreshed.error || !currentUser || currentUser.isAnonymous) return false;

  const accounts = await authClient.listAccounts();
  if (
    accounts.error ||
    !(accounts.data ?? []).some(
      (account) =>
        account.providerId === expectedProvider &&
        account.userId === currentUser.id
    )
  ) {
    return false;
  }

  if (previousUser?.isAnonymous) {
    if (
      !(await verifyServerAccountTransition(previousUser.id, currentUser.id))
    ) {
      return false;
    }
  }

  if (previousUser?.isAnonymous) {
    const storageScopeId = await completePendingAccountTransition(
      previousUser.id,
      currentUser.id
    );
    activateMobileDataScope(storageScopeId);
  } else {
    activateMobileDataScope(
      await getOrCreateStorageScopeForUser(currentUser.id)
    );
  }
  return true;
}

export async function activateCurrentAuthenticatedDataScope(): Promise<boolean> {
  const session = await authClient.getSession({
    query: { disableCookieCache: true },
  });
  const user = session.data?.user as SessionUser | undefined;
  const userId = user?.id.trim();
  if (session.error || !userId) return false;

  const storageScopeId = await getStorageScopeForAuthenticatedUser(userId);
  if (!storageScopeId) return resumePendingAccountTransition();

  activateMobileDataScope(storageScopeId);
  return true;
}

export async function activateStubDataScope(): Promise<void> {
  const stubSubjectId = await getOrCreateStubSubjectId();
  activateMobileDataScope(await getOrCreateStorageScopeForUser(stubSubjectId));
}

export async function resumePendingAccountTransition(): Promise<boolean> {
  const pending = await getPendingAccountTransition();
  if (!pending) return false;
  return verifyAuthAccountTransition(
    { id: pending.sourceUserId, isAnonymous: true },
    pending.provider
  );
}

/**
 * Start Google OAuth through Better Auth's Expo browser flow.
 *
 * The callback is intentionally relative: the Expo client converts it to the
 * app scheme (`leveza://`) and the server validates it
 * against TRUSTED_ORIGINS.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    const meta = await fetchServerCapabilities();
    if (!meta?.auth.googleAvailable) {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'Google sign-in is not enabled on this server.',
      };
    }

    let previousUser = await prepareAuthAccountTransition('google');
    const anonymousCookie = previousUser?.isAnonymous
      ? await authClient.getCookie()
      : null;
    const attempted = await retryExistingAccountSignIn(
      previousUser,
      () =>
        authClient.signIn.social({
          provider: 'google',
          callbackURL: '/',
        }),
      (user) => discardAnonymousAccount(user, anonymousCookie)
    );
    const result = attempted.result;
    previousUser = attempted.previousUser;

    if (result.error) {
      const conflictMessage = getAccountTransitionErrorMessage(result.error);
      return {
        ok: false,
        reason: conflictMessage ? 'conflict' : 'failed',
        message: conflictMessage ?? 'Google sign-in failed. Please try again.',
      };
    }

    // The Expo browser plugin returns normally on cancellation and when its
    // callback has no cookie. Prove that OAuth actually completed before any
    // caller navigates as though the user signed in.
    const [refreshedSession, linkedAccounts] = await Promise.all([
      authClient.getSession({
        query: { disableCookieCache: true },
      }),
      authClient.listAccounts(),
    ]);
    const currentUser = refreshedSession.data?.user as
      | { id: string; isAnonymous?: boolean }
      | undefined;
    const accounts = (linkedAccounts.data ?? []) as Array<{
      providerId: string;
      userId: string;
    }>;

    if (
      refreshedSession.error ||
      linkedAccounts.error ||
      !hasCompletedGoogleSignIn(previousUser, currentUser, accounts) ||
      !(await verifyAuthAccountTransition(previousUser, 'google'))
    ) {
      return {
        ok: false,
        reason: 'failed',
        message: 'Google sign-in was not completed. Please try again.',
      };
    }

    return { ok: true };
  } catch (error) {
    console.error('[auth-client] Google sign-in error:', error);
    return {
      ok: false,
      reason: 'failed',
      message: 'Google sign-in failed. Please try again.',
    };
  }
}

export {
  fetchServerCapabilities,
  getCurrentServerCapabilities,
} from './server-capabilities';

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
      console.error(
        '[auth-client] Anonymous sign-in failed:',
        result.error.message
      );
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
export async function getSessionCookie(): Promise<string | null> {
  try {
    const cookies = await authClient.getCookie();
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
