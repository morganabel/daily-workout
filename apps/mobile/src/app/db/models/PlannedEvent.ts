import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class PlannedEvent extends Model {
  static override table = 'planned_events';

  @field('kind') kind!: string;
  @field('title') title!: string;
  @field('local_date') localDate!: string;
  @field('created_at_timezone') createdAtTimezone!: string;
  @date('starts_at') startsAt?: number;
  @date('ends_at') endsAt?: number;
  @field('all_day') allDay?: boolean;
  @field('duration_minutes') durationMinutes?: number;
  @field('intensity') intensity?: string;
  @field('tags_json') tagsJson?: string;
  @field('notes') notes?: string;
  @field('status') status?: string;
  @field('linked_workout_id') linkedWorkoutId?: string;
  @field('details_json') detailsJson?: string;
  @field('metadata_json') metadataJson?: string;
  @date('archived_at') archivedAt?: number;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;
}
