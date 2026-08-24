import * as SecureStore from 'expo-secure-store';
import { getActiveDatabase, setActiveDatabaseForTests } from '../db/activeDatabase';
import { getByokConfig, removeByokConfig, setByokConfig } from './byokKey';

const database = getActiveDatabase();
const scopeA = 'scope_aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa';
const scopeB = 'scope_bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb';

describe('BYOK provider storage', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    setActiveDatabaseForTests(database, scopeA);
    await removeByokConfig();
    setActiveDatabaseForTests(database, scopeB);
    await removeByokConfig();
    setActiveDatabaseForTests(database, scopeA);
  });

  it('preserves OpenRouter as the selected provider', async () => {
    await setByokConfig({
      provider: 'openrouter',
      apiKey: 'sk-or-v1-test-key',
    });

    await expect(getByokConfig()).resolves.toEqual({
      provider: 'openrouter',
      apiKey: 'sk-or-v1-test-key',
    });
  });

  it('uses SecureStore-safe scoped keys when no BYOK config exists', async () => {
    jest.mocked(SecureStore.getItemAsync).mockClear();

    await expect(getByokConfig()).resolves.toBeNull();

    const requestedKeys = jest
      .mocked(SecureStore.getItemAsync)
      .mock.calls.map(([key]) => key);
    expect(requestedKeys).toEqual(
      expect.arrayContaining([
        `byok.${scopeA}.apiKey`,
        `byok.${scopeA}.provider`,
      ])
    );
    expect(requestedKeys.every((key) => /^[\w.-]+$/.test(key))).toBe(true);
  });

  it('does not expose one scope key to another scope', async () => {
    await setByokConfig({ provider: 'gemini', apiKey: 'scope-a-key' });
    setActiveDatabaseForTests(database, scopeB);

    await expect(getByokConfig()).resolves.toBeNull();
    await setByokConfig({ provider: 'openai', apiKey: 'scope-b-key' });
    setActiveDatabaseForTests(database, scopeA);
    await expect(getByokConfig()).resolves.toEqual({
      provider: 'gemini',
      apiKey: 'scope-a-key',
    });
  });

  it('never falls back to legacy device-wide keys', async () => {
    await SecureStore.deleteItemAsync('scopedByokCleanupV1');
    await SecureStore.setItemAsync('byokApiKey', 'legacy-key');
    await SecureStore.setItemAsync('byokProvider', 'openai');
    jest.mocked(SecureStore.deleteItemAsync).mockClear();

    await expect(getByokConfig()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('byokApiKey');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('byokProvider');
    await expect(SecureStore.getItemAsync('byokApiKey')).resolves.toBeNull();
    await expect(SecureStore.getItemAsync('byokProvider')).resolves.toBeNull();
  });
});
