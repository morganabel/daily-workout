import { Model, Relation } from '@nozbe/watermelondb';
import { field, date, relation, readonly } from '@nozbe/watermelondb/decorators';
import Exercise from './Exercise';

export default class Set extends Model {
  static override table = 'sets';
  static override associations = {
    exercises: { type: 'belongs_to', key: 'exercise_id' },
  } as const;

  @field('reps') reps?: number;
  @field('weight') weight?: number;
  @field('rpe') rpe?: number;
  @field('completed') completed!: boolean;
  @field('order') order!: number;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;

  @relation('exercises', 'exercise_id') exercise!: Relation<Exercise>;
}
