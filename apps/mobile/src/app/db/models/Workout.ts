import { Model, Query } from '@nozbe/watermelondb';
import { field, date, children, readonly } from '@nozbe/watermelondb/decorators';
import Exercise from './Exercise';

export default class Workout extends Model {
  static override table = 'workouts';
  static override associations = {
    exercises: { type: 'has_many', foreignKey: 'workout_id' },
  } as const;

  @field('name') name!: string;
  @field('status') status!: 'planned' | 'completed' | 'skipped';
  @field('remote_id') remoteId?: string;
  @field('focus') focus?: string;
  @field('summary') summary?: string;
  @field('energy') energy?: string;
  @field('source') source?: string;
  @field('equipment_json') equipmentJson?: string;
  @field('plan_json') planJson?: string;
  @date('scheduled_date') scheduledDate?: number;
  @date('completed_at') completedAt?: number;
  @field('duration_seconds') durationSeconds?: number;
  @date('archived_at') archivedAt?: number;
  // OpenAI response ID for conversation context when regenerating
  @field('response_id') responseId?: string;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;

  @children('exercises') exercises!: Query<Exercise>;
}
