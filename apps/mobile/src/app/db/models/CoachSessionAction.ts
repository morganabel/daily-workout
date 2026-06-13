import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class CoachSessionAction extends Model {
  static override table = 'coach_session_actions';

  @field('action_kind') actionKind: string;
  @field('program_id') programId: string;
  @field('program_version') programVersion: number;
  @field('strategy') strategy: string;
  @field('cycle_index') cycleIndex: number;
  @field('session_identity_key') sessionIdentityKey: string;
  @field('projection_id') projectionId: string;
  @field('source_block_id') sourceBlockId?: string;
  @field('projected_local_date') projectedLocalDate: string;
  @field('action_local_date') actionLocalDate: string;
  @field('workout_id') workoutId?: string;
  @field('substitution_workout_id') substitutionWorkoutId?: string;
  @field('substitution_block_id') substitutionBlockId?: string;
  @readonly @date('created_at') createdAt: number;
  @readonly @date('updated_at') updatedAt: number;
}
