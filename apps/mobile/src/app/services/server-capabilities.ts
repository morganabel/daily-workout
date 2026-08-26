import * as SecureStore from 'expo-secure-store';
import { metaResponseSchema, type MetaResponse } from '@workout-agent/shared';

import { backendDescriptor } from './backendDescriptor';

const SERVER_CAPABILITIES_TTL_MS = 10 * 60_000;
export const STARTUP_CAPABILITIES_WAIT_MS = 1_500;
const STORAGE_KEY = `server_capabilities_v1_${backendDescriptor.backendId}`;
const LOG_FAILURES =
  process.env.EXPO_PUBLIC_LOG_SERVER_CAPABILITIES_FAILURES === 'true';

export const BUNDLED_SERVER_CAPABILITIES: MetaResponse = {
  protocolVersion: '1.0.0',
  edition: 'HOSTED',
  auth: {
    enabled: true,
    methods: ['anonymous', 'email'],
    anonymousAvailable: true,
    emailAvailable: true,
    googleAvailable: true,
    accountTransitionAvailable: true,
  },
  billing: {
    enabled: false,
    showUpgradeUi: false,
    purchaseMethod: 'none',
    allowByok: true,
  },
};

type CachedCapabilities = {
  data: MetaResponse;
  fetchedAt: number;
};

type StoredCapabilities = CachedCapabilities & {
  version: 1;
};

let cachedCapabilities: CachedCapabilities | null = null;
let hydrationPromise: Promise<void> | null = null;
let refreshPromise: Promise<MetaResponse | null> | null = null;

const parseStoredCapabilities = (raw: string): StoredCapabilities | null => {
  try {
    const value = JSON.parse(raw) as Partial<StoredCapabilities>;
    if (
      value.version !== 1 ||
      typeof value.fetchedAt !== 'number' ||
      !Number.isFinite(value.fetchedAt)
    ) {
      return null;
    }
    const parsed = metaResponseSchema.safeParse(value.data);
    if (!parsed.success) return null;
    return { version: 1, fetchedAt: value.fetchedAt, data: parsed.data };
  } catch {
    return null;
  }
};

const hydrateCapabilities = (): Promise<void> => {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (!raw) return;
      const stored = parseStoredCapabilities(raw);
      if (
        stored &&
        (!cachedCapabilities || stored.fetchedAt > cachedCapabilities.fetchedAt)
      ) {
        cachedCapabilities = {
          data: stored.data,
          fetchedAt: stored.fetchedAt,
        };
      }
    } catch {
      // Last-known capabilities are an optimization, never a startup dependency.
    }
  })();
  return hydrationPromise;
};

const persistCapabilities = async (
  capabilities: CachedCapabilities
): Promise<void> => {
  try {
    const stored: StoredCapabilities = { version: 1, ...capabilities };
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The in-memory value remains usable when persistence is unavailable.
  }
};

const refreshServerCapabilities = (): Promise<MetaResponse | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${backendDescriptor.baseURL}/api/meta`);
      if (!response.ok) {
        if (LOG_FAILURES) {
          console.warn(
            `[server-capabilities] /api/meta returned ${response.status}`
          );
        }
        return null;
      }

      const parsed = metaResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        if (LOG_FAILURES) {
          console.warn('[server-capabilities] /api/meta returned invalid data');
        }
        return null;
      }

      const next = { data: parsed.data, fetchedAt: Date.now() };
      cachedCapabilities = next;
      void persistCapabilities(next);
      return next.data;
    } catch (error) {
      if (LOG_FAILURES) {
        console.warn(
          '[server-capabilities] Failed to refresh /api/meta',
          error
        );
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Resolve capabilities for ordinary in-app consumers. Last-known values are
 * returned immediately and refreshed in the background when stale.
 */
export async function fetchServerCapabilities(): Promise<MetaResponse> {
  await hydrateCapabilities();
  const cached = cachedCapabilities;

  if (!cached || Date.now() - cached.fetchedAt >= SERVER_CAPABILITIES_TTL_MS) {
    void refreshServerCapabilities();
  }

  return cached?.data ?? BUNDLED_SERVER_CAPABILITIES;
}

/**
 * Synchronous snapshot for initial UI state. Before local storage hydration,
 * the bundled managed-service defaults are the best-known capabilities.
 */
export function getCurrentServerCapabilities(): MetaResponse {
  return cachedCapabilities?.data ?? BUNDLED_SERVER_CAPABILITIES;
}

/**
 * Give local storage a bounded opportunity to hydrate the last-known value.
 * Remote refresh never gates launch and is only used to update future reads.
 */
export async function resolveStartupServerCapabilities(
  waitMs = STARTUP_CAPABILITIES_WAIT_MS
): Promise<MetaResponse> {
  const hydration = hydrateCapabilities();
  let hydrationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  await Promise.race([
    hydration,
    new Promise<void>((resolve) => {
      hydrationTimeoutId = setTimeout(resolve, waitMs);
    }),
  ]);
  if (hydrationTimeoutId) clearTimeout(hydrationTimeoutId);

  const cached = cachedCapabilities;
  if (!cached || Date.now() - cached.fetchedAt >= SERVER_CAPABILITIES_TTL_MS) {
    void refreshServerCapabilities();
  }
  return getCurrentServerCapabilities();
}

export function resetServerCapabilitiesCacheForTests(): void {
  cachedCapabilities = null;
  hydrationPromise = null;
  refreshPromise = null;
}
