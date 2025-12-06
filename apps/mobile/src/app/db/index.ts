import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';
import { v7 as uuidv7 } from 'uuid';

import { schema } from './schema';
import { migrations } from './migrations';
import User from './models/User';
import Workout from './models/Workout';
import Exercise from './models/Exercise';
import Set from './models/Set';

// Ensure all new records use UUIDv7 ids (to match backend format)
setGenerator(() => uuidv7());

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true, /* Platform.OS === 'ios' */
  onSetUpError: error => {
    // Database failed to load -- offer the user to reload the app or log out
    console.error('Database failed to load', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    User,
    Workout,
    Exercise,
    Set,
  ],
});
