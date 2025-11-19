import { Model } from '@nozbe/watermelondb';
import { field, date, children, readonly } from '@nozbe/watermelondb/decorators';
import Exercise from './Exercise';

export default class Workout extends Model {
  static table = 'workouts';
  static associations = {
    exercises: { type: 'has_many', foreignKey: 'workout_id' },
  } as const;

  @field('name') name!: string;
  @field('status') status!: 'planned' | 'completed' | 'skipped';
  @date('scheduled_date') scheduledDate?: number;
  @date('completed_at') completedAt?: number;
  @field('duration_seconds') durationSeconds?: number;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;

  @children('exercises') exercises!: any;
}
