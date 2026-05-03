import { createTrainingBlueprintFromOnboarding } from '@workout-agent/shared';
import { database } from '../index';
import { userRepository } from './UserRepository';

const clearUsers = async () => {
  await database.write(async () => {
    const users = await database.collections.get<any>('users').query().fetch();
    await Promise.all(users.map((user) => user.destroyPermanently()));
  });
};

describe('UserRepository blueprint preferences', () => {
  afterEach(async () => {
    await clearUsers();
  });

  it('saves accepted training blueprint data into preferences', async () => {
    const blueprint = createTrainingBlueprintFromOnboarding({
      goal: 'build-strength',
      experienceLevel: 'beginner',
      environment: 'home',
      equipment: ['Dumbbells'],
    });

    await userRepository.saveTrainingBlueprint(blueprint);

    const preferences = await userRepository.getPreferences();
    expect(preferences.onboardingSetupStatus).toBe('completed');
    expect(preferences.trainingBlueprint?.templateId).toBe('strength-foundation');
    expect(preferences.onboardingAnswers).toEqual(blueprint.onboardingAnswers);
    expect(preferences.equipment).toEqual(['Dumbbells']);
    expect(preferences.experienceLevel).toBe('beginner');
  });

  it('records skipped onboarding so prompts can be suppressed', async () => {
    await userRepository.skipTrainingBlueprintSetup();

    const preferences = await userRepository.getPreferences();
    expect(preferences.onboardingSetupStatus).toBe('skipped');
    await expect(userRepository.hasCompletedOrSkippedOnboarding()).resolves.toBe(
      true
    );
  });
});
