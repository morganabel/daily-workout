import type { Database } from '@nozbe/watermelondb';
import { CoachSessionActionRepository } from './repositories/CoachSessionActionRepository';
import { PlannedEventRepository } from './repositories/PlannedEventRepository';
import { UserRepository } from './repositories/UserRepository';
import { WorkoutRepository } from './repositories/WorkoutRepository';

export type MobileRepositoryContainer = {
  coachSessionAction: CoachSessionActionRepository;
  plannedEvent: PlannedEventRepository;
  user: UserRepository;
  workout: WorkoutRepository;
};

export function createRepositoryContainer(
  database: Database
): MobileRepositoryContainer {
  return {
    coachSessionAction: new CoachSessionActionRepository(database),
    plannedEvent: new PlannedEventRepository(database),
    user: new UserRepository(database),
    workout: new WorkoutRepository(database),
  };
}
