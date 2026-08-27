import { createTestDatabase } from './test-database';

describe('scoped database creation', () => {
  afterEach(() => {
    jest.dontMock('./databaseAdapter');
  });

  it('uses the storage scope in the production database name', () => {
    const createDatabaseAdapter = jest.fn(() => {
      return createTestDatabase().adapter.underlyingAdapter;
    });

    jest.doMock('./databaseAdapter', () => ({ createDatabaseAdapter }));
    jest.isolateModules(() => {
      const { createDatabase } =
        jest.requireActual<typeof import('./index')>('./index');

      createDatabase('scope_aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa');
    });

    expect(createDatabaseAdapter).toHaveBeenCalledWith(
      'leveza_scope_aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa'
    );
  });
});
