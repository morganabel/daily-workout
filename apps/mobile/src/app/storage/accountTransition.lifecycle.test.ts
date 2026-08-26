import { setGenerator } from 'nitromelondb/utils/common/randomId';
import * as SecureStore from 'expo-secure-store';
import { v7 as uuidv7 } from 'uuid';

import {
  activateMobileDataScope,
  deactivateMobileDataScope,
} from '../db/activeDatabase';
import { resetScopedTestDatabases } from '../db/test-database';
import { backendDescriptor } from '../services/backendDescriptor';
import {
  completePendingAccountTransition,
  getOrCreateStorageScopeForUser,
  getPendingAccountTransition,
  getStorageScopeForAuthenticatedUser,
  getStorageScopeForUser,
  preparePendingAccountTransition,
} from './accountTransition';
import { getByokConfig, setByokConfig } from './byokKey';

const registryKey = `account_transition_${backendDescriptor.backendId}`;

setGenerator(() => uuidv7());

describe('account transition local storage lifecycle', () => {
  beforeEach(async () => {
    resetScopedTestDatabases();
    deactivateMobileDataScope();
    await SecureStore.deleteItemAsync(registryKey);
    await SecureStore.deleteItemAsync('scopedByokCleanupV1');
    jest.clearAllMocks();
  });

  afterEach(() => {
    deactivateMobileDataScope();
  });

  it('hands the same SQLite and BYOK scope to B without exposing it to an unrelated account', async () => {
    const sourceUserId = 'anonymous-a';
    const targetUserId = 'authenticated-b';
    const unrelatedUserId = 'authenticated-c';
    const sourceScope = await getOrCreateStorageScopeForUser(sourceUserId);
    const sourceRepositories = activateMobileDataScope(sourceScope);

    await sourceRepositories.user.updatePreferences({
      equipment: ['Dumbbells'],
      experienceLevel: 'intermediate',
    });
    await setByokConfig({ provider: 'openai', apiKey: 'source-scope-key' });

    const pending = await preparePendingAccountTransition(
      sourceUserId,
      'credential'
    );
    expect(pending.storageScopeId).toBe(sourceScope);

    deactivateMobileDataScope();
    await expect(getPendingAccountTransition()).resolves.toEqual(pending);

    const targetScope = await completePendingAccountTransition(
      sourceUserId,
      targetUserId
    );
    expect(targetScope).toBe(sourceScope);
    await expect(getStorageScopeForUser(sourceUserId)).resolves.toBeNull();
    await expect(getStorageScopeForUser(targetUserId)).resolves.toBe(
      sourceScope
    );

    const repeatedTargetScope = await getStorageScopeForAuthenticatedUser(
      targetUserId
    );
    expect(repeatedTargetScope).toBe(sourceScope);
    if (!repeatedTargetScope) {
      throw new Error('Expected the target storage scope to remain bound');
    }
    const targetRepositories = activateMobileDataScope(repeatedTargetScope);
    await expect(targetRepositories.user.getPreferences()).resolves.toEqual(
      expect.objectContaining({
        equipment: ['Dumbbells'],
        experienceLevel: 'intermediate',
      })
    );
    await expect(getByokConfig()).resolves.toEqual({
      provider: 'openai',
      apiKey: 'source-scope-key',
    });

    const unrelatedScope = await getOrCreateStorageScopeForUser(
      unrelatedUserId
    );
    expect(unrelatedScope).not.toBe(sourceScope);
    const unrelatedRepositories = activateMobileDataScope(unrelatedScope);
    await expect(unrelatedRepositories.user.getUser()).resolves.toBeNull();
    await expect(getByokConfig()).resolves.toBeNull();
  });
});
