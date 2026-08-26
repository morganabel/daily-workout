import * as SecureStore from 'expo-secure-store';
import { v7 as uuidv7 } from 'uuid';
import {
  completePendingAccountTransition,
  getOrCreateStorageScopeForUser,
  getPendingAccountTransition,
  getStorageScopeForUser,
  preparePendingAccountTransition,
} from './accountTransition';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const values = new Map<string, string>();
const mockedUuidv7 = uuidv7 as unknown as jest.Mock;

beforeEach(() => {
  values.clear();
  mockedUuidv7.mockReturnValue('00000000-0000-7000-8000-000000000001');
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(
    async (key: string) => values.get(key) ?? null
  );
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(
    async (key: string, value: string) => {
      values.set(key, value);
    }
  );
});

describe('account transition storage binding', () => {
  it('persists pending A/S before auth and atomically rebinds S to B', async () => {
    const pending = await preparePendingAccountTransition(
      'anonymous-a',
      'google'
    );
    expect(pending).toEqual(
      expect.objectContaining({
        sourceUserId: 'anonymous-a',
        storageScopeId: 'scope_00000000-0000-7000-8000-000000000001',
        provider: 'google',
      })
    );
    await expect(getPendingAccountTransition()).resolves.toEqual(pending);

    await expect(
      completePendingAccountTransition('anonymous-a', 'authenticated-b')
    ).resolves.toBe('scope_00000000-0000-7000-8000-000000000001');
    await expect(getStorageScopeForUser('anonymous-a')).resolves.toBeNull();
    await expect(getStorageScopeForUser('authenticated-b')).resolves.toBe(
      'scope_00000000-0000-7000-8000-000000000001'
    );
    await expect(getPendingAccountTransition()).resolves.toBeNull();
  });

  it('gives an unrelated account a different scope without claiming A', async () => {
    mockedUuidv7
      .mockReturnValueOnce('00000000-0000-7000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-7000-8000-000000000002');
    const sourceScope = await getOrCreateStorageScopeForUser('anonymous-a');
    const unrelatedScope =
      await getOrCreateStorageScopeForUser('authenticated-b');

    expect(unrelatedScope).not.toBe(sourceScope);
    await expect(getStorageScopeForUser('anonymous-a')).resolves.toBe(
      sourceScope
    );
    await expect(getStorageScopeForUser('authenticated-b')).resolves.toBe(
      unrelatedScope
    );
  });

  it('keeps the pending record when the target already owns another scope', async () => {
    mockedUuidv7
      .mockReturnValueOnce('00000000-0000-7000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-7000-8000-000000000002');
    await preparePendingAccountTransition('authenticated-b', 'credential');
    await preparePendingAccountTransition('anonymous-a', 'google');

    await expect(
      completePendingAccountTransition('anonymous-a', 'authenticated-b')
    ).rejects.toThrow('account_transition_target_scope_conflict');
    await expect(getPendingAccountTransition()).resolves.toEqual(
      expect.objectContaining({ sourceUserId: 'anonymous-a' })
    );
  });
});
