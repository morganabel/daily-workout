import {
  type AdaptiveTargetRange,
  createAdaptiveTrainingPlanFromTemplate,
  createTrainingBlueprintFromOnboarding,
} from '@workout-agent/shared';
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

  it('saves accepted onboarding data and an adaptive plan into preferences', async () => {
    const blueprint = createTrainingBlueprintFromOnboarding({
      goal: 'build-strength',
      experienceLevel: 'beginner',
      environment: 'home',
      equipment: ['Dumbbells'],
    });

    await userRepository.saveTrainingBlueprint(blueprint);

    const preferences = await userRepository.getPreferences();
    expect(preferences.onboardingSetupStatus).toBe('completed');
    expect(preferences.trainingBlueprint).toBeUndefined();
    expect(preferences.onboardingAnswers).toEqual(blueprint.onboardingAnswers);
    expect(preferences.equipment).toEqual(['Dumbbells']);
    expect(preferences.experienceLevel).toBe('beginner');
    expect(preferences.primaryGoal).toBe('Build strength');
    expect(preferences.adaptiveTrainingPlan).toMatchObject({
      sourceTemplateId: 'strength-foundation',
      mode: 'adaptive',
      status: 'active',
    });
  });

  it('seeds and persists an adaptive plan for PPL conditioning onboarding', async () => {
    const blueprint = createTrainingBlueprintFromOnboarding({
      goal: 'build-muscle',
      experienceLevel: 'intermediate',
      environment: 'gym',
      equipment: ['Gym'],
    });

    await userRepository.saveTrainingBlueprint(blueprint);

    const preferences = await userRepository.getPreferences();
    expect(preferences.trainingBlueprint).toBeUndefined();
    expect(preferences.adaptiveTrainingPlan).toMatchObject({
      sourceTemplateId: 'ppl-conditioning',
      mode: 'adaptive',
      status: 'active',
    });
    expect(preferences.adaptiveTrainingPlan?.blocks.map((block) => block.id)).toEqual(
      expect.arrayContaining(['push', 'pull', 'legs', 'easy-cardio', 'sprint'])
    );
    await expect(userRepository.hasCompletedOrSkippedOnboarding()).resolves.toBe(
      true
    );
  });

  it('updates adaptive plan settings with validation', async () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }

    await userRepository.saveAdaptiveTrainingPlan(plan);
    const updated = await userRepository.updateAdaptiveTrainingPlan({
      targetRanges: plan.targetRanges.map((target: AdaptiveTargetRange) =>
        target.id === 'lift'
          ? { ...target, minCount: 4, maxCount: 5, idealCount: 4 }
          : target
      ),
      updatedAt: '2026-04-16T12:00:00.000Z',
    });

    expect(
      updated.targetRanges.find(
        (target: AdaptiveTargetRange) => target.id === 'lift'
      )
    ).toMatchObject({ minCount: 4, maxCount: 5, idealCount: 4 });
  });

  it('rejects invalid adaptive plan updates and keeps previous plan', async () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }

    await userRepository.saveAdaptiveTrainingPlan(plan);
    await expect(
      userRepository.updateAdaptiveTrainingPlan({
        targetRanges: plan.targetRanges.map((target: AdaptiveTargetRange) =>
          target.id === 'lift'
            ? { ...target, minCount: 6, maxCount: 3, idealCount: 4 }
            : target
        ),
      })
    ).rejects.toThrow('Invalid adaptive training plan data');

    const preferences = await userRepository.getPreferences();
    expect(preferences.adaptiveTrainingPlan?.targetRanges).toEqual(
      plan.targetRanges
    );
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
