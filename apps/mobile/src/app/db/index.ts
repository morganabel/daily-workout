import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import { migrations } from './migrations';
import User from './models/User';
import Workout from './models/Workout';
import Exercise from './models/Exercise';
import Set from './models/Set';

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
