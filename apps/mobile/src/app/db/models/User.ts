import { Model } from 'nitromelondb';
import { field, date, readonly } from 'nitromelondb/decorators';

export default class User extends Model {
  static override table = 'users';

  @field('preferences') preferences: string;
  @readonly @date('created_at') createdAt: number;
  @readonly @date('updated_at') updatedAt: number;
}
