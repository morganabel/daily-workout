import { Model, Relation, Query } from '@nozbe/watermelondb';
import { field, date, children, relation, readonly } from '@nozbe/watermelondb/decorators';
import Workout from './Workout';
import Set from './Set';

export default class Exercise extends Model {
  static override table = 'exercises';
  static override associations = {
    workouts: { type: 'belongs_to', key: 'workout_id' },
    sets: { type: 'has_many', foreignKey: 'exercise_id' },
  } as const;

  @field('name') name!: string;
  @field('muscle_group') muscleGroup?: string;
  @field('order') order!: number;
  @field('block_id') blockId?: string;
  @field('block_title') blockTitle?: string;
  @field('block_focus') blockFocus?: string;
  @field('block_duration') blockDuration?: number;
  @field('block_order') blockOrder?: number;
  @field('prescription') prescription?: string;
  @field('detail') detail?: string;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;

  @relation('workouts', 'workout_id') workout!: Relation<Workout>;
  @children('sets') sets!: Query<Set>;
}
