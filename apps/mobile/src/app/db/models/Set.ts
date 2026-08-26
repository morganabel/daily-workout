import { Model, Relation } from 'nitromelondb';
import {
  field,
  date,
  relation,
  readonly,
} from 'nitromelondb/decorators';
import type { WeightUnit } from '@workout-agent/shared';
import Exercise from './Exercise';

export default class Set extends Model {
  static override table = 'sets';
  static override associations = {
    exercises: { type: 'belongs_to', key: 'exercise_id' },
  } as const;

  @field('reps') reps?: number;
  @field('weight') weight?: number;
  @field('weight_unit') weightUnit?: WeightUnit;
  @field('rpe') rpe?: number;
  @field('completed') completed: boolean;
  @field('order') order: number;
  @readonly @date('created_at') createdAt: number;
  @readonly @date('updated_at') updatedAt: number;

  @relation('exercises', 'exercise_id') exercise: Relation<Exercise>;
}
