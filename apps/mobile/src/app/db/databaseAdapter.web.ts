import LokiJSAdapter from 'nitromelondb/adapters/lokijs';

import { migrations } from './migrations';
import { schema } from './schema';

export function createDatabaseAdapter(dbName: string): LokiJSAdapter {
  return new LokiJSAdapter({
    dbName,
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    onSetUpError: (error) => {
      console.error('Scoped database failed to load', error);
    },
  });
}
