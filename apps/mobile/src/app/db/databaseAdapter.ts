import SQLiteAdapter from 'nitromelondb/adapters/sqlite';

import { migrations } from './migrations';
import { schema } from './schema';

export function createDatabaseAdapter(dbName: string): SQLiteAdapter {
  return new SQLiteAdapter({
    dbName,
    schema,
    migrations,
    jsi: true,
    onSetUpError: (error) => {
      console.error('Scoped database failed to load', error);
    },
  });
}
