import type { Database } from '@nozbe/watermelondb';
import User from '../models/User';
import { Q } from '@nozbe/watermelondb';
import {
  adaptiveTrainingPlanSchema,
  createAdaptiveTrainingPlanFromTemplate,
  migrateAdaptiveTrainingPlanToCoachProgramAware,
  trainingBlueprintSchema,
  type AdaptiveTrainingPlan,
  type OnboardingAnswers,
  type OnboardingGoal,
  type TrainingBlueprint,
  type UserPreferences,
  userPreferencesSchema,
} from '@workout-agent/shared';
import { formatLocalDate } from '../../utils/date';

const DEFAULT_PREFERENCES: UserPreferences = {
  equipment: [],
  injuries: [],
  focusBias: [],
  avoid: [],
  aiFeaturesEnabled: true,
};

const ONBOARDING_GOAL_LABELS: Record<OnboardingGoal, string> = {
  'general-fitness': 'General fitness',
  'build-muscle': 'Build muscle',
  'build-strength': 'Build strength',
  'lose-fat': 'Lose fat',
  'run-cardio': 'Run/cardio',
  mobility: 'Mobility',
};

export class UserRepository {
  private readonly users;

  constructor(private readonly database: Database) {
    this.users = database.collections.get<User>('users');
  }

  async getUser(): Promise<User | null> {
    const users = await this.users.query(Q.take(1)).fetch();
    return users.length > 0 ? users[0] : null;
  }

  async getOrCreateUser(): Promise<User> {
    const user = await this.getUser();
    if (user) {
      return user;
    }

    return await this.database.write(async () => {
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
        return {
          ...result.data,
          adaptiveTrainingPlan: result.data.adaptiveTrainingPlan
            ? migrateAdaptiveTrainingPlanToCoachProgramAware(
                result.data.adaptiveTrainingPlan
              )
            : undefined,
        };
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

  async hasCompletedOrSkippedOnboarding(): Promise<boolean> {
    const prefs = await this.getPreferences();
    return (
      prefs.onboardingSetupStatus === 'completed' ||
      prefs.onboardingSetupStatus === 'skipped' ||
      prefs.adaptiveTrainingPlan?.status === 'active'
    );
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

    await this.database.write(async () => {
      await user.update((u) => {
        u.preferences = JSON.stringify(result.data);
      });
    });
  }

  async saveOnboardingAnswers(answers: OnboardingAnswers): Promise<void> {
    await this.updatePreferences({ onboardingAnswers: answers });
  }

  async saveTrainingBlueprint(blueprint: TrainingBlueprint): Promise<void> {
    const adaptiveTrainingPlan = createAdaptiveTrainingPlanFromTemplate(
      blueprint.templateId,
      {
        activeFrom: formatLocalDate(new Date()),
        updatedAt: blueprint.updatedAt ?? new Date().toISOString(),
      }
    );

    if (!adaptiveTrainingPlan) {
      throw new Error('Selected template does not support adaptive planning');
    }

    await this.updatePreferences({
      onboardingAnswers: blueprint.onboardingAnswers,
      onboardingSetupStatus: blueprint.setupStatus,
      adaptiveTrainingPlan,
      equipment: blueprint.equipmentLocationAssumptions.equipment,
      experienceLevel: blueprint.onboardingAnswers?.experienceLevel,
      primaryGoal: blueprint.onboardingAnswers?.goal
        ? ONBOARDING_GOAL_LABELS[blueprint.onboardingAnswers.goal]
        : undefined,
    });
  }

  async saveAdaptiveTrainingPlan(plan: AdaptiveTrainingPlan): Promise<void> {
    const result = adaptiveTrainingPlanSchema.safeParse(plan);
    if (!result.success) {
      console.error('Invalid adaptive training plan:', result.error);
      throw new Error('Invalid adaptive training plan data');
    }

    await this.updatePreferences({ adaptiveTrainingPlan: result.data });
  }

  async updateAdaptiveTrainingPlan(
    updates: Partial<AdaptiveTrainingPlan>
  ): Promise<AdaptiveTrainingPlan> {
    const current = await this.getPreferences();
    if (!current.adaptiveTrainingPlan) {
      throw new Error('No adaptive training plan to update');
    }

    const result = adaptiveTrainingPlanSchema.safeParse({
      ...current.adaptiveTrainingPlan,
      ...updates,
      updatedAt: updates.updatedAt ?? new Date().toISOString(),
    });

    if (!result.success) {
      console.error('Invalid adaptive training plan update:', result.error);
      throw new Error('Invalid adaptive training plan data');
    }

    await this.updatePreferences({ adaptiveTrainingPlan: result.data });

    return result.data;
  }

  async updateTrainingBlueprint(
    updates: Partial<TrainingBlueprint>
  ): Promise<TrainingBlueprint> {
    const current = await this.getPreferences();
    if (!current.trainingBlueprint) {
      throw new Error('No training blueprint to update');
    }

    const result = trainingBlueprintSchema.safeParse({
      ...current.trainingBlueprint,
      ...updates,
      editStatus: updates.editStatus ?? 'edited',
    });

    if (!result.success) {
      console.error('Invalid training blueprint update:', result.error);
      throw new Error('Invalid training blueprint data');
    }

    await this.updatePreferences({
      onboardingSetupStatus: result.data.setupStatus,
      trainingBlueprint: result.data,
    });

    return result.data;
  }

  async skipTrainingBlueprintSetup(): Promise<void> {
    await this.updatePreferences({ onboardingSetupStatus: 'skipped' });
  }
}
