import { database } from '../index';
import User from '../models/User';
import { Q } from '@nozbe/watermelondb';
import {
  UserPreferences,
  userPreferencesSchema,
} from '@workout-agent/shared';

const DEFAULT_PREFERENCES: UserPreferences = {
  equipment: [],
  injuries: [],
  focusBias: [],
  avoid: [],
};

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
      return await this.users.create((u) => {
        u.preferences = JSON.stringify(DEFAULT_PREFERENCES);
      });
    });
  }

  observeUser() {
    return this.users.query(Q.take(1)).observe();
  }

  /**
   * Get typed user preferences, parsed and validated.
   * Returns default preferences if none exist or parsing fails.
   */
  async getPreferences(): Promise<UserPreferences> {
    const user = await this.getUser();
    if (!user || !user.preferences) {
      return DEFAULT_PREFERENCES;
    }

    try {
      const parsed = JSON.parse(user.preferences);
      const result = userPreferencesSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      console.warn('Invalid preferences format, using defaults:', result.error);
      return DEFAULT_PREFERENCES;
    } catch (e) {
      console.warn('Failed to parse preferences, using defaults:', e);
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Check if the user has configured their profile (has any meaningful data).
   */
  async hasConfiguredProfile(): Promise<boolean> {
    const prefs = await this.getPreferences();
    // Consider profile configured if they have equipment or experience level set
    return prefs.equipment.length > 0 || prefs.experienceLevel !== undefined;
  }

  /**
   * Update user preferences with partial data (merges with existing).
   */
  async updatePreferences(updates: Partial<UserPreferences>): Promise<void> {
    const user = await this.getOrCreateUser();
    const current = await this.getPreferences();
    const merged = { ...current, ...updates };

    // Validate the merged result
    const result = userPreferencesSchema.safeParse(merged);
    if (!result.success) {
      console.error('Invalid preferences update:', result.error);
      throw new Error('Invalid preferences data');
    }

    await database.write(async () => {
      await user.update((u) => {
        u.preferences = JSON.stringify(result.data);
      });
    });
  }

  /**
   * @deprecated Use updatePreferences with typed UserPreferences instead.
   */
  async updatePreferencesLegacy(preferences: Record<string, unknown>) {
    const user = await this.getOrCreateUser();
    await database.write(async () => {
      await user.update((u) => {
        u.preferences = JSON.stringify(preferences);
      });
    });
  }
}

export const userRepository = new UserRepository();
