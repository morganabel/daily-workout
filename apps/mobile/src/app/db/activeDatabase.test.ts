import { createTestDatabase } from './test-database';
import {
  deactivateMobileDataScope,
  discardMobileDataScope,
  getActiveDatabase,
  getActiveRepositories,
  setActiveDatabaseForTests,
} from './activeDatabase';

describe('active mobile data scope', () => {
  afterEach(() => {
    deactivateMobileDataScope();
  });

  it('fails closed when no principal scope is active', async () => {
    deactivateMobileDataScope();
    expect(() => getActiveDatabase()).toThrow('mobile_data_scope_unavailable');
    expect(() => getActiveRepositories()).toThrow(
      'mobile_data_scope_unavailable'
    );
  });

  it('switches explicit repository containers between isolated databases', async () => {
    const databaseA = createTestDatabase();
    const databaseB = createTestDatabase();

    setActiveDatabaseForTests(
      databaseA,
      'scope_aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa'
    );
    const repositoriesA = getActiveRepositories();
    const userA = await repositoriesA.user.getOrCreateUser();

    setActiveDatabaseForTests(
      databaseB,
      'scope_bbbbbbbb-bbbb-7bbb-8bbb-bbbbbbbbbbbb'
    );
    const repositoriesB = getActiveRepositories();
    expect(repositoriesB).not.toBe(repositoriesA);
    await expect(repositoriesB.user.getUser()).resolves.toBeNull();
    const userB = await repositoriesB.user.getOrCreateUser();
    expect(userB.id).not.toBe(userA.id);

    setActiveDatabaseForTests(
      databaseA,
      'scope_aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa'
    );
    await expect(getActiveRepositories().user.getUser()).resolves.toMatchObject(
      {
        id: userA.id,
      }
    );
  });

  it('clears and unmounts a discarded scope', async () => {
    const database = createTestDatabase();
    const scope = 'scope_cccccccc-cccc-7ccc-8ccc-cccccccccccc';
    setActiveDatabaseForTests(database, scope);
    await getActiveRepositories().user.getOrCreateUser();

    await discardMobileDataScope(scope);

    expect(() => getActiveRepositories()).toThrow(
      'mobile_data_scope_unavailable'
    );
    setActiveDatabaseForTests(database, scope);
    await expect(getActiveRepositories().user.getUser()).resolves.toBeNull();
  });
});
