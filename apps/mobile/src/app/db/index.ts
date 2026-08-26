import { Database } from 'nitromelondb';
import { setGenerator } from 'nitromelondb/utils/common/randomId';
import { v7 as uuidv7 } from 'uuid';

import { createDatabaseAdapter } from './databaseAdapter';
import User from './models/User';
import Workout from './models/Workout';
import PlannedEvent from './models/PlannedEvent';
import CoachSessionAction from './models/CoachSessionAction';
import Exercise from './models/Exercise';
import Set from './models/Set';

// Ensure all new records use UUIDv7 ids (to match backend format)
setGenerator(() => uuidv7());

const SCOPE_PATTERN =
  /^scope_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDatabase(dataScopeId: string): Database {
  if (!SCOPE_PATTERN.test(dataScopeId)) {
    throw new Error('invalid_mobile_data_scope');
  }

  const adapter = createDatabaseAdapter(`workout_agent_${dataScopeId}`);

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
