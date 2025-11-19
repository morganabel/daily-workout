import { Model } from '@nozbe/watermelondb';
import { field, date, children, relation, readonly } from '@nozbe/watermelondb/decorators';
import Workout from './Workout';
import Set from './Set';

export default class Exercise extends Model {
  static table = 'exercises';
  static associations = {
    workouts: { type: 'belongs_to', key: 'workout_id' },
    sets: { type: 'has_many', foreignKey: 'exercise_id' },
  } as const;

  @field('name') name!: string;
  @field('muscle_group') muscleGroup?: string;
  @field('order') order!: number;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;

  @relation('workouts', 'workout_id') workout!: any;
  @children('sets') sets!: any;
}
