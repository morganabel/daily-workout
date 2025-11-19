import { database } from '../index';
import User from '../models/User';
import { Q } from '@nozbe/watermelondb';

export class UserRepository {
  private users = database.collections.get<User>('users');

  async getUser(): Promise<User | null> {
    const users = await this.users.query(Q.take(1)).fetch();
    return users.length > 0 ? users[0] : null;
  }

  async getOrCreateUser(): Promise<User> {
    const user = await this.getUser();
    if (user) {
      return user;
    }

    return await database.write(async () => {
      return await this.users.create(u => {
        u.preferences = JSON.stringify({});
      });
    });
  }

  observeUser() {
    return this.users.query(Q.take(1)).observe();
  }

  async updatePreferences(preferences: any) {
    const user = await this.getOrCreateUser();
    await database.write(async () => {
      await user.update(u => {
        u.preferences = JSON.stringify(preferences);
      });
    });
  }
}

export const userRepository = new UserRepository();
