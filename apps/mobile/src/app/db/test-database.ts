/**
 * Test database using LokiJS adapter (in-memory, no native bindings required)
 */
import { Database } from 'nitromelondb';
import LokiJSAdapter from 'nitromelondb/adapters/lokijs';

import { schema } from './schema';
import User from './models/User';
import Workout from './models/Workout';
import PlannedEvent from './models/PlannedEvent';
import CoachSessionAction from './models/CoachSessionAction';
import Exercise from './models/Exercise';
import Set from './models/Set';

export function createTestDatabase(): Database {
  const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    extraLokiOptions: {
      autosave: false,
    },
  });

  return new Database({
    adapter,
    modelClasses: [
      User,
      Workout,
      PlannedEvent,
      CoachSessionAction,
      Exercise,
      Set,
    ],
  });
}

const scopedTestDatabases = new Map<string, Database>();

export function getTestDatabaseForScope(dataScopeId: string): Database {
  let database = scopedTestDatabases.get(dataScopeId);
  if (!database) {
    database = createTestDatabase();
    scopedTestDatabases.set(dataScopeId, database);
  }
  return database;
}

export function resetScopedTestDatabases(): void {
  scopedTestDatabases.clear();
}

// Singleton test database for tests that need a shared instance
let testDatabase: Database | null = null;

export function getTestDatabase(): Database {
  if (!testDatabase) {
    testDatabase = createTestDatabase();
  }
  return testDatabase;
}

export function resetTestDatabase(): void {
  testDatabase = null;
}
