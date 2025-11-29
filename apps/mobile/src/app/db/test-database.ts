/**
 * Test database using LokiJS adapter (in-memory, no native bindings required)
 */
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { schema } from './schema';
import User from './models/User';
import Workout from './models/Workout';
import Exercise from './models/Exercise';
import Set from './models/Set';

export function createTestDatabase(): Database {
  const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });

  return new Database({
    adapter,
    modelClasses: [User, Workout, Exercise, Set],
  });
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

