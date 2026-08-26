import * as SecureStore from 'expo-secure-store';
import { v7 as uuidv7 } from 'uuid';
import { backendDescriptor } from '../services/backendDescriptor';

const REGISTRY_KEY = `account_transition_${backendDescriptor.backendId}`;
const STUB_SUBJECT_KEY = `${REGISTRY_KEY}_stub_subject`;

export type PendingTransition = {
  backendId: string;
  sourceUserId: string;
  storageScopeId: string;
  provider: 'credential' | 'google';
};

type StorageRegistry = {
  version: 1;
  bindings: Record<string, string>;
  pending?: PendingTransition;
};

const emptyRegistry = (): StorageRegistry => ({ version: 1, bindings: {} });
let mutationQueue: Promise<void> = Promise.resolve();

async function readRegistry(): Promise<StorageRegistry> {
  const stored = await SecureStore.getItemAsync(REGISTRY_KEY);
  if (!stored) return emptyRegistry();
  try {
    const value = JSON.parse(stored) as Partial<StorageRegistry>;
    if (value.version !== 1 || !value.bindings) return emptyRegistry();
    return value as StorageRegistry;
  } catch {
    return emptyRegistry();
  }
}

async function mutateRegistry<T>(
  mutation: (registry: StorageRegistry) => T | Promise<T>
): Promise<T> {
  let resolveResult!: (value: T) => void;
  let rejectResult!: (reason: unknown) => void;
  const result = new Promise<T>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  mutationQueue = mutationQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        const registry = await readRegistry();
        const value = await mutation(registry);
        await SecureStore.setItemAsync(REGISTRY_KEY, JSON.stringify(registry));
        resolveResult(value);
      } catch (error) {
        rejectResult(error);
      }
    });
  await mutationQueue;
  return result;
}

export async function preparePendingAccountTransition(
  sourceUserId: string,
  provider: 'credential' | 'google'
): Promise<PendingTransition> {
  return mutateRegistry((registry) => {
    const storageScopeId =
      registry.bindings[sourceUserId] ?? `scope_${uuidv7()}`;
    registry.bindings[sourceUserId] = storageScopeId;
    registry.pending = {
      backendId: backendDescriptor.backendId,
      sourceUserId,
      storageScopeId,
      provider,
    };
    return registry.pending;
  });
}

export async function getOrCreateStorageScopeForUser(
  userId: string
): Promise<string> {
  if (!userId.trim()) throw new Error('account_transition_subject_missing');
  return mutateRegistry((registry) => {
    const existing = registry.bindings[userId];
    if (existing) return existing;
    const storageScopeId = `scope_${uuidv7()}`;
    registry.bindings[userId] = storageScopeId;
    return storageScopeId;
  });
}

export async function getStorageScopeForAuthenticatedUser(
  userId: string
): Promise<string | null> {
  if (!userId.trim()) throw new Error('account_transition_subject_missing');
  return mutateRegistry((registry) => {
    if (registry.pending && registry.pending.sourceUserId !== userId) {
      return null;
    }
    const existing = registry.bindings[userId];
    if (existing) return existing;
    const storageScopeId = `scope_${uuidv7()}`;
    registry.bindings[userId] = storageScopeId;
    return storageScopeId;
  });
}

export async function getOrCreateStubSubjectId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(STUB_SUBJECT_KEY);
  if (existing) return existing;
  const created = `stub_${uuidv7()}`;
  await SecureStore.setItemAsync(STUB_SUBJECT_KEY, created);
  return created;
}

export async function completePendingAccountTransition(
  sourceUserId: string,
  targetUserId: string
): Promise<string> {
  return mutateRegistry((registry) => {
    const pending = registry.pending;
    if (
      !pending ||
      pending.backendId !== backendDescriptor.backendId ||
      pending.sourceUserId !== sourceUserId
    ) {
      throw new Error('account_transition_pending_record_missing');
    }
    const currentTargetScope = registry.bindings[targetUserId];
    if (
      currentTargetScope !== undefined &&
      currentTargetScope !== pending.storageScopeId
    ) {
      throw new Error('account_transition_target_scope_conflict');
    }

    delete registry.bindings[sourceUserId];
    registry.bindings[targetUserId] = pending.storageScopeId;
    delete registry.pending;
    return pending.storageScopeId;
  });
}

export async function getPendingAccountTransition(): Promise<PendingTransition | null> {
  return (await readRegistry()).pending ?? null;
}

export async function getStorageScopeForUser(
  userId: string
): Promise<string | null> {
  return (await readRegistry()).bindings[userId] ?? null;
}

export async function discardStorageScopeForUser(
  userId: string
): Promise<string | null> {
  if (!userId.trim()) throw new Error('account_transition_subject_missing');
  return mutateRegistry((registry) => {
    const storageScopeId = registry.bindings[userId] ?? null;
    delete registry.bindings[userId];
    if (registry.pending?.sourceUserId === userId) {
      delete registry.pending;
    }
    return storageScopeId;
  });
}
