import {
  type GenerationEvaluationCorpus,
  type GenerationEvaluationScenario,
  validateGenerationEvaluationCorpus,
} from '../contracts/generation-evaluation';
import {
  type ExperienceLevel,
  type GenerationContext,
  type GenerationRequest,
  type RegenerationFeedback,
  type UpcomingEventContext,
  type WorkoutEnergy,
} from '../contracts/workouts';
import { createTodayPlanFixture } from '../testing/workout-fixtures';

export const WORKOUT_GENERATION_EVALUATION_CORPUS_VERSION = '2026-04-v1';
export const WORKOUT_GENERATION_EVALUATION_RUBRIC_VERSION = '2026-04-v1';

const scenarioReferenceDate = new Date();

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function relativeCompletedAt(params: {
  daysAgo: number;
  hour?: number;
  minute?: number;
}): string {
  const date = new Date(scenarioReferenceDate);
  date.setDate(date.getDate() - params.daysAgo);
  date.setHours(params.hour ?? 9, params.minute ?? 0, 0, 0);
  return date.toISOString();
}

function relativeLocalDate(daysFromToday: number): string {
  const date = new Date(scenarioReferenceDate);
  date.setDate(date.getDate() + daysFromToday);
  return formatLocalDate(date);
}

function buildContext(params: {
  experienceLevel: ExperienceLevel;
  equipment?: string[];
  timeAvailableMinutes?: number;
  energyToday?: WorkoutEnergy;
  primaryGoal?: string;
  preferredStyle?: string;
  focusBias?: string[];
  avoid?: string[];
  injuries?: string[];
  recentSessions?: GenerationContext['recentSessions'];
  notes?: string;
  location?: string;
  timeOfDay?: string;
}): GenerationContext {
  return {
    userProfile: {
      experienceLevel: params.experienceLevel,
      primaryGoal: params.primaryGoal,
      energyToday: params.energyToday,
      preferredStyle: params.preferredStyle,
    },
    preferences: {
      focusBias: params.focusBias,
      avoid: params.avoid,
      injuries: params.injuries,
    },
    environment: {
      equipment: params.equipment ?? [],
      location: params.location,
      timeAvailableMinutes: params.timeAvailableMinutes,
      timeOfDay: params.timeOfDay,
    },
    recentSessions: params.recentSessions ?? [],
    notes: params.notes,
  };
}

function buildSession(params: {
  id: string;
  name: string;
  focus: string;
  durationMinutes: number;
  completedAt: string;
  perceivedEffort?: WorkoutEnergy;
  notes?: string;
}): GenerationContext['recentSessions'][number] {
  return {
    id: params.id,
    name: params.name,
    focus: params.focus,
    durationMinutes: params.durationMinutes,
    completedAt: params.completedAt,
    source: 'ai',
    perceivedEffort: params.perceivedEffort,
    notes: params.notes,
  };
}

function buildEvent(params: {
  kind: string;
  title: string;
  localDate: string;
  startsAt?: string;
  durationMinutes?: number;
  allDay?: boolean;
  intensity?: 'low' | 'moderate' | 'high';
  tags?: string[];
  notes?: string;
}): UpcomingEventContext {
  return {
    kind: params.kind,
    title: params.title,
    localDate: params.localDate,
    startsAt: params.startsAt,
    durationMinutes: params.durationMinutes,
    allDay: params.allDay,
    intensity: params.intensity,
    tags: params.tags,
    notes: params.notes,
  };
}

function buildExpectations(
  overrides: Partial<GenerationEvaluationScenario['hardExpectations']> = {}
): GenerationEvaluationScenario['hardExpectations'] {
  return {
    requireSchemaValidity: true,
    durationToleranceMinutes: 10,
    requiredFocus: overrides.requiredFocus,
    disallowedFocuses: [],
    requireOnlyAvailableEquipment: true,
    bannedExerciseTerms: [],
    requireRegenerationDifference: false,
    requireUpcomingEventSensitivity: false,
    notes: [],
    ...overrides,
  };
}

function createBaselinePlan(
  overrides: Partial<GenerationEvaluationScenario['baselinePlan']>
) {
  return createTodayPlanFixture(overrides ?? {});
}

function createScenario(
  scenario: Omit<GenerationEvaluationScenario, 'hardExpectations'> & {
    hardExpectations?: Partial<
      GenerationEvaluationScenario['hardExpectations']
    >;
  }
): GenerationEvaluationScenario {
  return {
    ...scenario,
    hardExpectations: buildExpectations(scenario.hardExpectations),
  };
}

function createRegenerationRequest(
  request: Omit<GenerationRequest, 'provider'> & {
    previousResponseId: string;
    feedback: RegenerationFeedback[];
  }
): GenerationRequest {
  return request;
}

const scenarios: GenerationEvaluationScenario[] = [
  createScenario({
    id: 'beginner-bodyweight-easy-15',
    title: 'Beginner bodyweight easy 15-minute session',
    description:
      'A brand-new user with no equipment wants an approachable 15-minute workout.',
    tags: ['beginner', 'bodyweight', 'easy', 'short', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 15,
      energy: 'easy',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 15,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      recentSessions: [],
      timeOfDay: 'morning',
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
    softReviewHints: [
      'Keep confidence-building',
      'Avoid advanced progressions',
    ],
  }),
  createScenario({
    id: 'beginner-bodyweight-moderate-30',
    title: 'Beginner bodyweight moderate 30-minute session',
    description:
      'A beginner wants a moderate full-body workout with only bodyweight available.',
    tags: ['beginner', 'bodyweight', 'moderate', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'beginner-bodyweight-intense-20',
    title: 'Beginner bodyweight intense 20-minute session',
    description:
      'A motivated beginner wants a short but challenging bodyweight workout.',
    tags: ['beginner', 'bodyweight', 'intense', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 20,
      energy: 'intense',
      focus: 'Conditioning',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 20,
      energyToday: 'intense',
      primaryGoal: 'improve endurance',
      recentSessions: [],
    }),
    hardExpectations: {
      requiredFocus: 'Conditioning',
      bannedExerciseTerms: ['muscle-up'],
    },
  }),
  createScenario({
    id: 'beginner-dumbbells-easy-20',
    title: 'Beginner dumbbells easy 20-minute session',
    description:
      'A beginner with light dumbbells wants a simple, low-pressure session.',
    tags: ['beginner', 'dumbbells', 'easy', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 20,
      equipment: ['Dumbbells'],
      energy: 'easy',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Dumbbells'],
      timeAvailableMinutes: 20,
      energyToday: 'easy',
      primaryGoal: 'build confidence',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'beginner-dumbbells-moderate-30',
    title: 'Beginner dumbbells moderate 30-minute session',
    description:
      'A beginner with dumbbells wants a balanced 30-minute workout.',
    tags: ['beginner', 'dumbbells', 'moderate', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Dumbbells'],
      energy: 'moderate',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Dumbbells'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general strength',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'beginner-dumbbells-upper-30',
    title: 'Beginner dumbbells upper-body 30-minute session',
    description: 'A beginner wants an explicit upper-body dumbbell workout.',
    tags: ['beginner', 'dumbbells', 'upper-body', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Dumbbells'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Dumbbells'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'tone upper body',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
  }),
  createScenario({
    id: 'intermediate-bodyweight-conditioning-20',
    title: 'Intermediate bodyweight conditioning 20-minute session',
    description:
      'An intermediate user wants a short conditioning-oriented bodyweight session.',
    tags: ['intermediate', 'bodyweight', 'conditioning', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 20,
      energy: 'intense',
      focus: 'Conditioning',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 20,
      energyToday: 'intense',
      primaryGoal: 'improve endurance',
      preferredStyle: 'Intervals',
      recentSessions: [
        buildSession({
          id: 'ctx-1',
          name: 'Easy Mobility',
          focus: 'Recovery',
          durationMinutes: 25,
          completedAt: relativeCompletedAt({ daysAgo: 3, hour: 7 }),
          perceivedEffort: 'easy',
        }),
      ],
    }),
    hardExpectations: { requiredFocus: 'Conditioning' },
  }),
  createScenario({
    id: 'intermediate-dumbbells-upper-45',
    title: 'Intermediate dumbbells upper-body 45-minute session',
    description:
      'An intermediate user wants a focused upper-body dumbbell workout.',
    tags: ['intermediate', 'dumbbells', 'upper-body', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 45,
      equipment: ['Dumbbells', 'Bench'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 45,
      energyToday: 'moderate',
      primaryGoal: 'build muscle',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
  }),
  createScenario({
    id: 'intermediate-dumbbells-lower-45',
    title: 'Intermediate dumbbells lower-body 45-minute session',
    description:
      'An intermediate user wants a focused lower-body dumbbell workout.',
    tags: ['intermediate', 'dumbbells', 'lower-body', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 45,
      equipment: ['Dumbbells', 'Bench'],
      energy: 'moderate',
      focus: 'Lower Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 45,
      energyToday: 'moderate',
      primaryGoal: 'leg strength',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Lower Body' },
  }),
  createScenario({
    id: 'intermediate-home-gym-full-body-30',
    title: 'Intermediate home gym full-body 30-minute session',
    description:
      'An intermediate user with a modest home gym wants a balanced full-body session.',
    tags: ['intermediate', 'home-gym', 'full-body', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Dumbbells', 'Resistance Bands', 'Bench'],
      energy: 'moderate',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Resistance Bands', 'Bench'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general strength',
      preferredStyle: 'Hybrid',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'advanced-full-gym-strength-60',
    title: 'Advanced full-gym strength 60-minute session',
    description:
      'An advanced user with full gym access wants a serious strength session.',
    tags: ['advanced', 'full-gym', 'strength', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 60,
      equipment: ['Barbell', 'Bench', 'Squat Rack', 'Pull-up Bar'],
      energy: 'intense',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Barbell', 'Bench', 'Squat Rack', 'Pull-up Bar'],
      timeAvailableMinutes: 60,
      energyToday: 'intense',
      primaryGoal: 'build strength',
      preferredStyle: 'Strength',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'advanced-full-gym-conditioning-45',
    title: 'Advanced full-gym conditioning 45-minute session',
    description:
      'An advanced user wants a hard conditioning session with full gym access.',
    tags: ['advanced', 'full-gym', 'conditioning', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 45,
      equipment: ['Barbell', 'Rowing Machine', 'Jump Rope'],
      energy: 'intense',
      focus: 'Conditioning',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Barbell', 'Rowing Machine', 'Jump Rope'],
      timeAvailableMinutes: 45,
      energyToday: 'intense',
      primaryGoal: 'improve endurance',
      preferredStyle: 'Intervals',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Conditioning' },
  }),
  createScenario({
    id: 'advanced-barbell-lower-75',
    title: 'Advanced barbell lower-body 75-minute session',
    description: 'An advanced lifter wants a long lower-body barbell session.',
    tags: ['advanced', 'barbell', 'lower-body', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 75,
      equipment: ['Barbell', 'Squat Rack', 'Bench'],
      energy: 'intense',
      focus: 'Lower Body',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Barbell', 'Squat Rack', 'Bench'],
      timeAvailableMinutes: 75,
      energyToday: 'intense',
      primaryGoal: 'build strength',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Lower Body' },
  }),
  createScenario({
    id: 'advanced-pull-focused-45',
    title: 'Advanced pull-focused 45-minute session',
    description: 'An advanced user wants an explicitly pull-dominant workout.',
    tags: ['advanced', 'pull', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 45,
      equipment: ['Pull-up Bar', 'Cable Machine', 'Dumbbells'],
      energy: 'moderate',
      focus: 'Pull',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Pull-up Bar', 'Cable Machine', 'Dumbbells'],
      timeAvailableMinutes: 45,
      energyToday: 'moderate',
      primaryGoal: 'build muscle',
      focusBias: ['Pull'],
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Pull' },
  }),
  createScenario({
    id: 'smart-focus-after-push-week',
    title: 'Smart focus after push-heavy week',
    description:
      'Smart focus should avoid over-repeating push after several push sessions.',
    tags: ['smart-focus', 'recency', 'push-overload', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 35,
      energy: 'moderate',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 35,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [
        buildSession({
          id: 'ctx-2',
          name: 'Push Day A',
          focus: 'Push',
          durationMinutes: 42,
          completedAt: relativeCompletedAt({ daysAgo: 5, hour: 7 }),
          perceivedEffort: 'moderate',
        }),
        buildSession({
          id: 'ctx-3',
          name: 'Push Day B',
          focus: 'Push',
          durationMinutes: 38,
          completedAt: relativeCompletedAt({ daysAgo: 2, hour: 7 }),
          perceivedEffort: 'intense',
        }),
      ],
    }),
    softReviewHints: ['Prefer not to repeat push focus immediately'],
  }),
  createScenario({
    id: 'smart-focus-after-leg-day',
    title: 'Smart focus after hard leg day',
    description:
      'A split-style lifter should not get another leg-focused session immediately after a hard leg day.',
    tags: ['smart-focus', 'legs', 'recency', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      preferredStyle: 'Bodybuilding',
      focusBias: ['Upper Body', 'Lower Body'],
      recentSessions: [
        buildSession({
          id: 'ctx-4',
          name: 'Heavy Leg Day',
          focus: 'Lower Body',
          durationMinutes: 60,
          completedAt: relativeCompletedAt({ daysAgo: 1, hour: 18 }),
          perceivedEffort: 'intense',
          notes: 'Felt smoked after lunges and squats',
        }),
      ],
      notes:
        'I usually run an upper/lower split and do not want back-to-back leg days.',
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
    softReviewHints: [
      'Show recovery awareness and clearly move away from legs',
    ],
  }),
  createScenario({
    id: 'smart-focus-after-push-pull-sequence',
    title: 'Smart focus after recent push then pull sequence',
    description:
      'A push-pull-legs lifter with recent push and pull sessions should be nudged toward legs next.',
    tags: ['smart-focus', 'ppl', 'recency', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 40,
      energy: 'moderate',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 40,
      energyToday: 'moderate',
      primaryGoal: 'build muscle',
      preferredStyle: 'Strength',
      recentSessions: [
        buildSession({
          id: 'ctx-ppl-1',
          name: 'Push Day',
          focus: 'Push',
          durationMinutes: 45,
          completedAt: relativeCompletedAt({ daysAgo: 3, hour: 18 }),
          perceivedEffort: 'moderate',
        }),
        buildSession({
          id: 'ctx-ppl-2',
          name: 'Pull Day',
          focus: 'Pull',
          durationMinutes: 45,
          completedAt: relativeCompletedAt({ daysAgo: 1, hour: 18 }),
          perceivedEffort: 'moderate',
        }),
      ],
      notes:
        'I usually run push, pull, legs and want Smart mode to pick the next logical day.',
    }),
    hardExpectations: { requiredFocus: 'Lower Body' },
    softReviewHints: [
      'Should clearly feel like the legs day in a push-pull-legs rhythm',
    ],
  }),
  createScenario({
    id: 'no-equipment-travel-hotel-room',
    title: 'No-equipment hotel-room travel session',
    description:
      'A traveler in a hotel room wants a quiet, no-equipment session.',
    tags: ['travel', 'bodyweight', 'hotel-room', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 20,
      energy: 'moderate',
      focus: 'Full Body',
      notes: 'Quiet room workout only. No jumping.',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 20,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [],
      location: 'hotel room',
      notes: 'Needs low-noise movements.',
    }),
    hardExpectations: {
      requiredFocus: 'Full Body',
      bannedExerciseTerms: ['burpee', 'box jump'],
    },
  }),
  createScenario({
    id: 'bench-bands-home-gym-hypertrophy',
    title: 'Bench and bands home-gym hypertrophy session',
    description:
      'A user with bands, bench, and dumbbells wants a hypertrophy-style home workout.',
    tags: ['home-gym', 'hypertrophy', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 40,
      equipment: ['Dumbbells', 'Resistance Bands', 'Bench'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Resistance Bands', 'Bench'],
      timeAvailableMinutes: 40,
      energyToday: 'moderate',
      primaryGoal: 'muscle gain',
      preferredStyle: 'Pump',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
  }),
  createScenario({
    id: 'kettlebell-conditioner-25',
    title: 'Kettlebell conditioning 25-minute session',
    description:
      'A user with kettlebells wants a compact conditioning workout.',
    tags: ['kettlebells', 'conditioning', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 25,
      equipment: ['Kettlebells'],
      energy: 'intense',
      focus: 'Conditioning',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Kettlebells'],
      timeAvailableMinutes: 25,
      energyToday: 'intense',
      primaryGoal: 'improve endurance',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Conditioning' },
  }),
  createScenario({
    id: 'treadmill-recovery-cardio-30',
    title: 'Treadmill recovery cardio 30-minute session',
    description: 'A user wants an easy cardio-focused workout on a treadmill.',
    tags: ['treadmill', 'recovery', 'cardio', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Treadmill'],
      energy: 'easy',
      focus: 'Conditioning',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Treadmill'],
      timeAvailableMinutes: 30,
      energyToday: 'easy',
      primaryGoal: 'general health',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Conditioning' },
  }),
  createScenario({
    id: 'shoulder-constraint-bodyweight',
    title: 'Shoulder-constrained bodyweight session',
    description:
      'A user with a cranky shoulder needs a safe bodyweight workout.',
    tags: ['injury', 'shoulder', 'bodyweight', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 25,
      energy: 'moderate',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 25,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      injuries: ['right shoulder irritation'],
      recentSessions: [],
    }),
    hardExpectations: {
      requiredFocus: 'Full Body',
      bannedExerciseTerms: ['overhead press', 'handstand push-up', 'snatch'],
    },
  }),
  createScenario({
    id: 'lower-back-constraint-gym',
    title: 'Lower-back-constrained gym session',
    description:
      'A gym user with lower-back sensitivity wants a safe training day.',
    tags: ['injury', 'lower-back', 'gym', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 40,
      equipment: ['Dumbbells', 'Bench', 'Cable Machine'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench', 'Cable Machine'],
      timeAvailableMinutes: 40,
      energyToday: 'moderate',
      primaryGoal: 'build strength',
      injuries: ['lower back sensitivity'],
      recentSessions: [],
    }),
    hardExpectations: {
      requiredFocus: 'Upper Body',
      bannedExerciseTerms: ['deadlift', 'good morning', 'heavy bent-over row'],
    },
  }),
  createScenario({
    id: 'knee-sensitive-low-impact',
    title: 'Knee-sensitive low-impact session',
    description: 'A user with knee sensitivity wants a low-impact session.',
    tags: ['injury', 'knee', 'low-impact', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Bodyweight', 'Resistance Bands'],
      energy: 'easy',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight', 'Resistance Bands'],
      timeAvailableMinutes: 30,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      injuries: ['knee sensitivity'],
      recentSessions: [],
    }),
    hardExpectations: {
      bannedExerciseTerms: ['jump squat', 'jump lunge', 'box jump'],
    },
  }),
  createScenario({
    id: 'avoid-burpees-conditioning',
    title: 'Conditioning session with burpees on avoid list',
    description: 'The user wants conditioning but specifically avoids burpees.',
    tags: ['avoid-list', 'conditioning', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 20,
      equipment: ['Bodyweight'],
      energy: 'intense',
      focus: 'Conditioning',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 20,
      energyToday: 'intense',
      primaryGoal: 'improve endurance',
      avoid: ['burpees'],
      recentSessions: [],
    }),
    hardExpectations: {
      requiredFocus: 'Conditioning',
      bannedExerciseTerms: ['burpee'],
    },
  }),
  createScenario({
    id: 'avoid-overhead-press',
    title: 'Upper-body session avoiding overhead pressing',
    description:
      'The user wants upper-body work but wants to avoid overhead pressing.',
    tags: ['avoid-list', 'upper-body', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 35,
      equipment: ['Dumbbells', 'Bench'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 35,
      energyToday: 'moderate',
      primaryGoal: 'upper body strength',
      avoid: ['overhead pressing'],
      recentSessions: [],
    }),
    hardExpectations: {
      requiredFocus: 'Upper Body',
      bannedExerciseTerms: ['overhead press', 'push press'],
    },
  }),
  createScenario({
    id: 'post-hike-recovery',
    title: 'Post-hike recovery workout',
    description:
      'The user recently did a long hike and needs a recovery-aware session.',
    tags: ['recovery', 'hike', 'recent-session', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 25,
      energy: 'easy',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Resistance Bands'],
      timeAvailableMinutes: 25,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      recentSessions: [
        buildSession({
          id: 'ctx-5',
          name: 'Mountain Hike',
          focus: 'Conditioning',
          durationMinutes: 180,
          completedAt: relativeCompletedAt({ daysAgo: 2, hour: 12 }),
          perceivedEffort: 'intense',
          notes: 'Legs fatigued afterward',
        }),
      ],
      notes: 'Legs are tired after weekend hike.',
    }),
    softReviewHints: ['Do not smash the legs again'],
  }),
  createScenario({
    id: 'pre-hike-protect-legs',
    title: 'Pre-hike session that protects the legs',
    description:
      'The user has a hike coming soon and wants a workout that leaves the legs relatively fresh.',
    tags: ['upcoming-event', 'hike', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Smart',
      upcomingEvents: [
        buildEvent({
          kind: 'hike',
          title: 'Saturday trail hike',
          localDate: relativeLocalDate(2),
          durationMinutes: 180,
          intensity: 'moderate',
        }),
      ],
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Dumbbells'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'improve endurance',
      recentSessions: [],
    }),
    hardExpectations: {
      requireUpcomingEventSensitivity: true,
      disallowedFocuses: ['Lower Body', 'Conditioning'],
    },
  }),
  createScenario({
    id: 'pre-race-run-taper',
    title: 'Pre-race run taper session',
    description:
      'The user has a race coming up and wants a session that respects that context.',
    tags: ['upcoming-event', 'run', 'taper', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 25,
      energy: 'moderate',
      focus: 'Smart',
      upcomingEvents: [
        buildEvent({
          kind: 'run',
          title: '10K race',
          localDate: relativeLocalDate(2),
          durationMinutes: 55,
          intensity: 'high',
        }),
      ],
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Resistance Bands'],
      timeAvailableMinutes: 25,
      energyToday: 'moderate',
      primaryGoal: 'run performance',
      recentSessions: [],
    }),
    hardExpectations: {
      requireUpcomingEventSensitivity: true,
      disallowedFocuses: ['Lower Body', 'Conditioning'],
    },
  }),
  createScenario({
    id: 'pre-travel-hotel-session',
    title: 'Pre-travel session before a long flight',
    description:
      'The user has travel ahead and wants something useful but not exhausting.',
    tags: ['upcoming-event', 'travel', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 20,
      energy: 'easy',
      focus: 'Full Body',
      upcomingEvents: [
        buildEvent({
          kind: 'travel',
          title: 'Cross-country flight',
          localDate: relativeLocalDate(1),
          allDay: true,
          tags: ['travel'],
        }),
      ],
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 20,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      recentSessions: [],
    }),
    hardExpectations: {
      requiredFocus: 'Full Body',
      requireUpcomingEventSensitivity: true,
      disallowedFocuses: ['Conditioning'],
    },
  }),
  createScenario({
    id: 'multi-event-busy-week',
    title: 'Busy week with multiple upcoming events',
    description:
      'The user has a packed week with a run, travel, and sport event.',
    tags: ['upcoming-event', 'busy-week', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Smart',
      upcomingEvents: [
        buildEvent({
          kind: 'run',
          title: 'Tempo run',
          localDate: relativeLocalDate(1),
          durationMinutes: 45,
          intensity: 'high',
        }),
        buildEvent({
          kind: 'travel',
          title: 'Work trip',
          localDate: relativeLocalDate(2),
          allDay: true,
        }),
        buildEvent({
          kind: 'sport',
          title: 'Weekend soccer',
          localDate: relativeLocalDate(4),
          durationMinutes: 90,
          intensity: 'high',
        }),
      ],
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Bodyweight', 'Dumbbells'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'improve fitness',
      recentSessions: [],
    }),
    hardExpectations: {
      requireUpcomingEventSensitivity: true,
      disallowedFocuses: ['Lower Body', 'Conditioning'],
    },
  }),
  createScenario({
    id: 'notes-quiet-apartment',
    title: 'Quiet apartment workout from notes',
    description:
      'The user adds notes that the workout must stay quiet for neighbors.',
    tags: ['notes', 'quiet', 'apartment', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 20,
      energy: 'moderate',
      focus: 'Conditioning',
      notes: 'Apartment workout only. Keep it quiet and low impact.',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 20,
      energyToday: 'moderate',
      primaryGoal: 'improve endurance',
      recentSessions: [],
      location: 'apartment',
    }),
    hardExpectations: {
      bannedExerciseTerms: ['jump squat', 'burpee', 'box jump'],
    },
  }),
  createScenario({
    id: 'notes-emphasis-core',
    title: 'Notes-driven core emphasis session',
    description:
      'The user explicitly asks for a session that spends extra time on core.',
    tags: ['notes', 'core', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Full Body',
      notes: 'Please spend extra time on core work today.',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Dumbbells'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general strength',
      recentSessions: [],
    }),
    softReviewHints: ['Core emphasis should be noticeable'],
  }),
  createScenario({
    id: 'preferred-style-circuit',
    title: 'Preferred-style circuit session',
    description: 'The user prefers circuit-style workouts.',
    tags: ['preferred-style', 'circuit', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Dumbbells', 'Bodyweight'],
      energy: 'moderate',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bodyweight'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'fat loss',
      preferredStyle: 'Circuit',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
    softReviewHints: ['Circuit feel should be visible'],
  }),
  createScenario({
    id: 'preferred-style-strength-skill',
    title: 'Preferred-style strength skill session',
    description:
      'The user prefers structured strength work over pure circuits.',
    tags: ['preferred-style', 'strength', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 50,
      equipment: ['Barbell', 'Bench', 'Squat Rack'],
      energy: 'moderate',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Barbell', 'Bench', 'Squat Rack'],
      timeAvailableMinutes: 50,
      energyToday: 'moderate',
      primaryGoal: 'build strength',
      preferredStyle: 'Strength',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'primary-goal-fat-loss',
    title: 'Primary goal fat-loss session',
    description: 'The user primarily wants fat-loss-oriented training.',
    tags: ['goal', 'fat-loss', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 35,
      equipment: ['Dumbbells', 'Bodyweight'],
      energy: 'moderate',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bodyweight'],
      timeAvailableMinutes: 35,
      energyToday: 'moderate',
      primaryGoal: 'fat loss',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'primary-goal-muscle-gain',
    title: 'Primary goal muscle-gain session',
    description: 'The user wants a workout that aligns with muscle-gain goals.',
    tags: ['goal', 'muscle-gain', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 45,
      equipment: ['Dumbbells', 'Bench', 'Cable Machine'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench', 'Cable Machine'],
      timeAvailableMinutes: 45,
      energyToday: 'moderate',
      primaryGoal: 'muscle gain',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
  }),
  createScenario({
    id: 'primary-goal-general-health',
    title: 'Primary goal general-health session',
    description:
      'The user wants something practical and sustainable for general health.',
    tags: ['goal', 'general-health', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 25,
      energy: 'easy',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight', 'Dumbbells'],
      timeAvailableMinutes: 25,
      energyToday: 'easy',
      primaryGoal: 'general health',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'recent-conditioning-fatigue',
    title: 'Recent conditioning fatigue context',
    description:
      'The user has several intense conditioning sessions in recent history.',
    tags: ['recency', 'conditioning', 'fatigue', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Rowing Machine', 'Bodyweight'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'improve endurance',
      recentSessions: [
        buildSession({
          id: 'ctx-6',
          name: 'Intervals A',
          focus: 'Conditioning',
          durationMinutes: 28,
          completedAt: relativeCompletedAt({ daysAgo: 4, hour: 6, minute: 30 }),
          perceivedEffort: 'intense',
        }),
        buildSession({
          id: 'ctx-7',
          name: 'Intervals B',
          focus: 'Conditioning',
          durationMinutes: 30,
          completedAt: relativeCompletedAt({ daysAgo: 2, hour: 6, minute: 30 }),
          perceivedEffort: 'intense',
        }),
      ],
      notes: 'Feeling a bit flat today.',
    }),
    softReviewHints: ['Avoid needless extra fatigue'],
  }),
  createScenario({
    id: 'recent-push-overload',
    title: 'Recent push overload context',
    description: 'The user has repeated push sessions in recent history.',
    tags: ['recency', 'push-overload', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 40,
      energy: 'moderate',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 40,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [
        buildSession({
          id: 'ctx-8',
          name: 'Push Strength',
          focus: 'Push',
          durationMinutes: 50,
          completedAt: relativeCompletedAt({
            daysAgo: 5,
            hour: 17,
            minute: 30,
          }),
          perceivedEffort: 'intense',
        }),
        buildSession({
          id: 'ctx-9',
          name: 'Push Volume',
          focus: 'Push',
          durationMinutes: 42,
          completedAt: relativeCompletedAt({
            daysAgo: 2,
            hour: 17,
            minute: 30,
          }),
          perceivedEffort: 'moderate',
        }),
      ],
    }),
  }),
  createScenario({
    id: 'recent-pull-overload',
    title: 'Recent pull overload context',
    description: 'The user has repeated pull sessions in recent history.',
    tags: ['recency', 'pull-overload', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 40,
      energy: 'moderate',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Pull-up Bar', 'Dumbbells'],
      timeAvailableMinutes: 40,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [
        buildSession({
          id: 'ctx-10',
          name: 'Pull Strength',
          focus: 'Pull',
          durationMinutes: 46,
          completedAt: relativeCompletedAt({
            daysAgo: 4,
            hour: 17,
            minute: 30,
          }),
          perceivedEffort: 'intense',
        }),
        buildSession({
          id: 'ctx-11',
          name: 'Pull Volume',
          focus: 'Pull',
          durationMinutes: 40,
          completedAt: relativeCompletedAt({
            daysAgo: 2,
            hour: 17,
            minute: 30,
          }),
          perceivedEffort: 'moderate',
        }),
      ],
    }),
  }),
  createScenario({
    id: 'recent-full-body-streak',
    title: 'Recent full-body streak context',
    description:
      'The user has done several full-body sessions in a row and needs novelty.',
    tags: ['recency', 'full-body-streak', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 35,
      energy: 'moderate',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight', 'Dumbbells'],
      timeAvailableMinutes: 35,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [
        buildSession({
          id: 'ctx-12',
          name: 'Full Body A',
          focus: 'Full Body',
          durationMinutes: 32,
          completedAt: relativeCompletedAt({ daysAgo: 5, hour: 8 }),
          perceivedEffort: 'moderate',
        }),
        buildSession({
          id: 'ctx-13',
          name: 'Full Body B',
          focus: 'Full Body',
          durationMinutes: 35,
          completedAt: relativeCompletedAt({ daysAgo: 3, hour: 8 }),
          perceivedEffort: 'moderate',
        }),
      ],
    }),
    softReviewHints: ['Introduce some novelty'],
  }),
  createScenario({
    id: 'morning-low-energy-short-session',
    title: 'Morning low-energy short session',
    description:
      'The user is dragging in the morning and wants something short and doable.',
    tags: ['morning', 'low-energy', 'short', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 15,
      energy: 'easy',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 15,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      recentSessions: [],
      timeOfDay: 'morning',
      notes: 'Needs to feel achievable before work.',
    }),
  }),
  createScenario({
    id: 'evening-high-energy-long-session',
    title: 'Evening high-energy long session',
    description:
      'The user has high evening energy and more time for a satisfying session.',
    tags: ['evening', 'high-energy', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 60,
      equipment: ['Dumbbells', 'Bench', 'Pull-up Bar'],
      energy: 'intense',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Dumbbells', 'Bench', 'Pull-up Bar'],
      timeAvailableMinutes: 60,
      energyToday: 'intense',
      primaryGoal: 'muscle gain',
      recentSessions: [],
      timeOfDay: 'evening',
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
  }),
  createScenario({
    id: 'lunch-break-quick-pump',
    title: 'Lunch-break quick pump session',
    description:
      'The user has a lunch break and wants a fast, satisfying session.',
    tags: ['lunch-break', 'quick', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 20,
      equipment: ['Dumbbells', 'Resistance Bands'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Resistance Bands'],
      timeAvailableMinutes: 20,
      energyToday: 'moderate',
      primaryGoal: 'build muscle',
      recentSessions: [],
      timeOfDay: 'midday',
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
  }),
  createScenario({
    id: 'bodyweight-pullup-bar-hybrid-session',
    title: 'Bodyweight and pull-up bar hybrid session',
    description:
      'The user has only bodyweight and a pull-up bar and wants a hybrid session.',
    tags: ['pull-up-bar', 'bodyweight', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Bodyweight', 'Pull-up Bar'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Pull-up Bar'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'upper body strength',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
  }),
  createScenario({
    id: 'bands-only-recovery-session',
    title: 'Bands-only recovery session',
    description: 'The user only has bands and wants a recovery-minded workout.',
    tags: ['bands', 'recovery', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 25,
      equipment: ['Resistance Bands'],
      energy: 'easy',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Resistance Bands'],
      timeAvailableMinutes: 25,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'rower-and-bands-conditioning',
    title: 'Rower and bands conditioning session',
    description:
      'The user has a rower and bands and wants cardio with some accessory work.',
    tags: ['rower', 'bands', 'conditioning', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 35,
      equipment: ['Rowing Machine', 'Resistance Bands'],
      energy: 'moderate',
      focus: 'Conditioning',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Rowing Machine', 'Resistance Bands'],
      timeAvailableMinutes: 35,
      energyToday: 'moderate',
      primaryGoal: 'improve endurance',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Conditioning' },
  }),
  createScenario({
    id: 'strength-bias-smart-focus',
    title: 'Strength-bias smart-focus session',
    description:
      'Smart focus should still feel strength-oriented for a strength-biased user.',
    tags: ['smart-focus', 'strength-bias', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 45,
      energy: 'moderate',
      focus: 'Smart',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Barbell', 'Bench', 'Squat Rack'],
      timeAvailableMinutes: 45,
      energyToday: 'moderate',
      primaryGoal: 'build strength',
      preferredStyle: 'Strength',
      focusBias: ['Pull', 'Lower Body'],
      recentSessions: [],
    }),
  }),
  createScenario({
    id: 'mobility-leaning-low-energy-day',
    title: 'Mobility-leaning low-energy day',
    description:
      'The user is low energy and wants something restorative but still workout-shaped.',
    tags: ['low-energy', 'mobility', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 20,
      energy: 'easy',
      focus: 'Smart',
      notes:
        'Would love some mobility work without it becoming only stretching.',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 20,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      recentSessions: [],
    }),
    softReviewHints: [
      'Should still feel like a workout, not only a stretch routine',
    ],
  }),
  createScenario({
    id: 'hotel-gym-dumbbells-and-treadmill',
    title: 'Hotel-gym dumbbells and treadmill session',
    description:
      'A traveler has a small hotel gym with dumbbells and a treadmill.',
    tags: ['travel', 'hotel-gym', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Dumbbells', 'Treadmill'],
      energy: 'moderate',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Treadmill'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [],
      location: 'hotel gym',
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
  }),
  createScenario({
    id: 'desk-worker-posture-session',
    title: 'Desk-worker posture session',
    description:
      'The user sits all day and wants a session that feels posture-friendly.',
    tags: ['notes', 'posture', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 25,
      equipment: ['Resistance Bands', 'Bodyweight'],
      energy: 'easy',
      focus: 'Upper Body',
      notes:
        'Lots of desk time lately. Would love to open up shoulders and upper back.',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Resistance Bands', 'Bodyweight'],
      timeAvailableMinutes: 25,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
  }),
  createScenario({
    id: 'soccer-player-pre-game-session',
    title: 'Soccer player pre-game session',
    description:
      'The user has soccer this weekend and wants a supportive midweek session.',
    tags: ['sport', 'upcoming-event', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Bodyweight', 'Resistance Bands'],
      energy: 'moderate',
      focus: 'Smart',
      upcomingEvents: [
        buildEvent({
          kind: 'sport',
          title: 'Weekend soccer match',
          localDate: relativeLocalDate(2),
          durationMinutes: 90,
          intensity: 'high',
        }),
      ],
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Resistance Bands'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'improve athletic performance',
      recentSessions: [],
    }),
    hardExpectations: {
      requireUpcomingEventSensitivity: true,
      disallowedFocuses: ['Lower Body', 'Conditioning'],
    },
  }),
  createScenario({
    id: 'advanced-push-day-with-bench-and-cables',
    title: 'Advanced push day with bench and cables',
    description:
      'An advanced user wants a polished push workout with bench and cable access.',
    tags: ['advanced', 'push', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 50,
      equipment: ['Bench', 'Cable Machine', 'Dumbbells'],
      energy: 'moderate',
      focus: 'Push',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Bench', 'Cable Machine', 'Dumbbells'],
      timeAvailableMinutes: 50,
      energyToday: 'moderate',
      primaryGoal: 'build muscle',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Push' },
  }),
  createScenario({
    id: 'rower-only-cardio-intervals',
    title: 'Rower-only cardio intervals',
    description: 'The user only has a rower and wants intervals.',
    tags: ['rower', 'intervals', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 25,
      equipment: ['Rowing Machine'],
      energy: 'intense',
      focus: 'Conditioning',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Rowing Machine'],
      timeAvailableMinutes: 25,
      energyToday: 'intense',
      primaryGoal: 'improve endurance',
      preferredStyle: 'Intervals',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Conditioning' },
  }),
  createScenario({
    id: 'garage-strongman-sandbag-and-carries-75',
    title: 'Garage strongman sandbag and carries 75-minute session',
    description:
      'A garage-gym athlete wants a weird, heavy session built around sandbags, carries, and brute-force conditioning.',
    tags: ['advanced', 'strongman', 'garage-gym', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 75,
      equipment: ['Sandbag', 'Dumbbells', 'Pull-up Bar', 'Bodyweight'],
      energy: 'intense',
      focus: 'Full Body',
      notes: 'Make it feel like strongman prep, not bodybuilding.',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Sandbag', 'Dumbbells', 'Pull-up Bar', 'Bodyweight'],
      timeAvailableMinutes: 75,
      energyToday: 'intense',
      primaryGoal: 'strongman performance',
      preferredStyle: 'Strongman',
      recentSessions: [],
      location: 'garage gym',
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
    softReviewHints: [
      'Should include carries or odd-object work',
      'Should not read like a generic circuit',
    ],
  }),
  createScenario({
    id: 'ultra-runner-upper-body-taper-45',
    title: 'Ultra-runner upper-body taper 45-minute session',
    description:
      'An endurance athlete wants to train without trashing the legs before an ultra-distance event.',
    tags: ['endurance', 'upcoming-event', 'ultra-run', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 45,
      equipment: ['Dumbbells', 'Resistance Bands', 'Pull-up Bar'],
      energy: 'moderate',
      focus: 'Smart',
      upcomingEvents: [
        buildEvent({
          kind: 'run',
          title: '50K trail ultra',
          localDate: relativeLocalDate(2),
          durationMinutes: 360,
          intensity: 'high',
          tags: ['race', 'trail'],
        }),
      ],
      notes: 'Keep my legs fresh for race day.',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Dumbbells', 'Resistance Bands', 'Pull-up Bar'],
      timeAvailableMinutes: 45,
      energyToday: 'moderate',
      primaryGoal: 'ultra endurance',
      preferredStyle: 'Hybrid',
      recentSessions: [],
    }),
    hardExpectations: {
      requireUpcomingEventSensitivity: true,
      disallowedFocuses: ['Lower Body', 'Conditioning'],
    },
    softReviewHints: [
      'Should still feel worthwhile while clearly protecting the legs',
    ],
  }),
  createScenario({
    id: 'climber-pull-endurance-and-core-60',
    title: 'Climber pull-endurance and core 60-minute session',
    description:
      'A recreational climber wants pulling endurance, scapular control, and trunk tension without generic bodybuilding fluff.',
    tags: ['climbing', 'pull', 'sport-specific', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 60,
      equipment: ['Pull-up Bar', 'Resistance Bands', 'Dumbbells'],
      energy: 'moderate',
      focus: 'Pull',
      notes:
        'Bias toward climbing support: grip, scapular control, trunk tension.',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Pull-up Bar', 'Resistance Bands', 'Dumbbells'],
      timeAvailableMinutes: 60,
      energyToday: 'moderate',
      primaryGoal: 'climbing performance',
      preferredStyle: 'Sport-specific',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Pull' },
    softReviewHints: ['Should feel climbing-relevant, not just lat day'],
  }),
  createScenario({
    id: 'bjj-day-before-tournament-35',
    title: 'BJJ day-before tournament 35-minute session',
    description:
      'A grappler wants to move, prime, and stay sharp without adding fatigue the day before competition.',
    tags: ['combat-sport', 'upcoming-event', 'bjj', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 35,
      equipment: ['Bodyweight', 'Resistance Bands'],
      energy: 'easy',
      focus: 'Smart',
      upcomingEvents: [
        buildEvent({
          kind: 'sport',
          title: 'BJJ tournament',
          localDate: relativeLocalDate(1),
          durationMinutes: 180,
          intensity: 'high',
          tags: ['grappling'],
        }),
      ],
      notes: 'Keep me sharp and mobile, not tired.',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Bodyweight', 'Resistance Bands'],
      timeAvailableMinutes: 35,
      energyToday: 'easy',
      primaryGoal: 'improve athletic performance',
      preferredStyle: 'Athletic prep',
      recentSessions: [],
    }),
    hardExpectations: {
      requireUpcomingEventSensitivity: true,
      disallowedFocuses: ['Lower Body', 'Conditioning'],
    },
  }),
  createScenario({
    id: 'tiny-apartment-silent-night-session-40',
    title: 'Tiny apartment silent night session 40-minute workout',
    description:
      'A night owl in a tiny apartment wants a surprisingly good session without waking neighbors or needing much floor space.',
    tags: ['apartment', 'quiet', 'weird-constraint', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 40,
      equipment: ['Bodyweight', 'Resistance Bands', 'Dumbbells'],
      energy: 'moderate',
      focus: 'Full Body',
      notes:
        'Tiny apartment. No jumping, no dropping weights, very little floor space.',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Resistance Bands', 'Dumbbells'],
      timeAvailableMinutes: 40,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [],
      location: 'small apartment',
      timeOfDay: 'late night',
    }),
    hardExpectations: {
      requiredFocus: 'Full Body',
      bannedExerciseTerms: ['burpee', 'box jump', 'jump squat', 'jumping jack'],
    },
  }),
  createScenario({
    id: 'festival-camping-movement-snack-25',
    title: 'Festival camping movement snack 25-minute session',
    description:
      'A user at a music festival wants a weird but useful campsite workout with almost no setup.',
    tags: ['travel', 'camping', 'weird-constraint', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 25,
      equipment: ['Bodyweight', 'Resistance Bands'],
      energy: 'easy',
      focus: 'Full Body',
      notes:
        'I am camping at a festival. Dusty ground, low motivation, but I still want to move.',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight', 'Resistance Bands'],
      timeAvailableMinutes: 25,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      preferredStyle: 'Low-friction',
      recentSessions: [],
      location: 'campsite',
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
    softReviewHints: [
      'Should feel practical for a campsite, not gym-dependent',
    ],
  }),
  createScenario({
    id: 'kettlebell-sport-density-60',
    title: 'Kettlebell sport density 60-minute session',
    description:
      'A kettlebell enthusiast wants a long density-oriented session that feels like skillful suffering, not random conditioning.',
    tags: ['kettlebells', 'density', 'sport-specific', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 60,
      equipment: ['Kettlebells'],
      energy: 'intense',
      focus: 'Conditioning',
      notes: 'Keep it kettlebell-dominant and density-oriented.',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Kettlebells'],
      timeAvailableMinutes: 60,
      energyToday: 'intense',
      primaryGoal: 'improve endurance',
      preferredStyle: 'Density',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Conditioning' },
    softReviewHints: ['Should not drift into bodyweight bootcamp'],
  }),
  createScenario({
    id: 'ski-trip-eccentric-leg-prep-80',
    title: 'Ski trip eccentric leg prep 80-minute session',
    description:
      'A user wants a long pre-ski-trip session with leg endurance, trunk stiffness, and knee-friendly prep.',
    tags: ['ski', 'sport-specific', 'lower-body', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 80,
      equipment: ['Dumbbells', 'Resistance Bands', 'Bench'],
      energy: 'moderate',
      focus: 'Lower Body',
      upcomingEvents: [
        buildEvent({
          kind: 'sport',
          title: 'Ski weekend',
          localDate: relativeLocalDate(5),
          durationMinutes: 480,
          intensity: 'high',
          tags: ['ski'],
        }),
      ],
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Resistance Bands', 'Bench'],
      timeAvailableMinutes: 80,
      energyToday: 'moderate',
      primaryGoal: 'ski readiness',
      preferredStyle: 'Athletic prep',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Lower Body' },
    softReviewHints: [
      'Should feel ski-specific rather than generic leg hypertrophy',
    ],
  }),
  createScenario({
    id: 'night-shift-wake-up-primer-30',
    title: 'Night-shift wake-up primer 30-minute session',
    description:
      'A night-shift worker wants a session that wakes them up without crushing them before work.',
    tags: ['night-shift', 'energy-management', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 30,
      equipment: ['Bodyweight', 'Dumbbells'],
      energy: 'moderate',
      focus: 'Smart',
      notes:
        'I just woke up for a night shift and need to feel switched on, not exhausted.',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Dumbbells'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [],
      timeOfDay: 'late evening',
    }),
    softReviewHints: [
      'Should feel energizing, not like a grindy max-effort workout',
    ],
  }),
  createScenario({
    id: 'obstacle-course-race-pull-carry-70',
    title: 'Obstacle-course race pull and carry 70-minute session',
    description:
      'A user training for obstacle-course racing wants grip, carries, pulling, and engine work in one session.',
    tags: ['ocr', 'sport-specific', 'full-body', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 70,
      equipment: ['Pull-up Bar', 'Sandbag', 'Dumbbells', 'Bodyweight'],
      energy: 'intense',
      focus: 'Full Body',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Pull-up Bar', 'Sandbag', 'Dumbbells', 'Bodyweight'],
      timeAvailableMinutes: 70,
      energyToday: 'intense',
      primaryGoal: 'obstacle-course performance',
      preferredStyle: 'Athletic prep',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
    softReviewHints: ['Should include some pull and carry flavor'],
  }),
  createScenario({
    id: 'beach-vacation-band-and-towel-35',
    title: 'Beach vacation band and towel 35-minute session',
    description:
      'A user wants a fun vacation workout using bands, bodyweight, and whatever beach gear is around.',
    tags: ['travel', 'beach', 'weird-constraint', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 35,
      equipment: ['Bodyweight', 'Resistance Bands'],
      energy: 'moderate',
      focus: 'Full Body',
      notes: 'Vacation workout near the beach. Make it fun and low-setup.',
    },
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight', 'Resistance Bands'],
      timeAvailableMinutes: 35,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      preferredStyle: 'Circuit',
      recentSessions: [],
      location: 'beach',
    }),
    hardExpectations: { requiredFocus: 'Full Body' },
    softReviewHints: ['Should feel playful and vacation-friendly'],
  }),
  createScenario({
    id: 'advanced-bodybuilding-upper-75',
    title: 'Advanced bodybuilding upper-body 75-minute session',
    description:
      'An advanced lifter wants a long upper-body bodybuilding session with lots of volume and machine work.',
    tags: ['advanced', 'bodybuilding', 'upper-body', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 75,
      equipment: ['Dumbbells', 'Bench', 'Cable Machine', 'Pull-up Bar'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Dumbbells', 'Bench', 'Cable Machine', 'Pull-up Bar'],
      timeAvailableMinutes: 75,
      energyToday: 'moderate',
      primaryGoal: 'muscle gain',
      preferredStyle: 'Bodybuilding',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
    softReviewHints: [
      'Should feel like a bodybuilding split, not generic full-body work',
    ],
  }),
  createScenario({
    id: 'advanced-bodybuilding-leg-day-90',
    title: 'Advanced bodybuilding leg day 90-minute session',
    description:
      'An advanced bodybuilder wants a long leg day with quad, hamstring, and glute volume.',
    tags: ['advanced', 'bodybuilding', 'lower-body', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 90,
      equipment: [
        'Barbell',
        'Bench',
        'Cable Machine',
        'Dumbbells',
        'Squat Rack',
      ],
      energy: 'intense',
      focus: 'Lower Body',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: [
        'Barbell',
        'Bench',
        'Cable Machine',
        'Dumbbells',
        'Squat Rack',
      ],
      timeAvailableMinutes: 90,
      energyToday: 'intense',
      primaryGoal: 'muscle gain',
      preferredStyle: 'Bodybuilding',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Lower Body' },
    softReviewHints: [
      'Should include meaningful leg volume and isolation work',
    ],
  }),
  createScenario({
    id: 'advanced-bodybuilding-back-volume-80',
    title: 'Advanced bodybuilding back-volume 80-minute session',
    description:
      'An advanced lifter wants a long back-focused hypertrophy workout with multiple rowing and pulldown angles.',
    tags: ['advanced', 'bodybuilding', 'pull', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 80,
      equipment: ['Cable Machine', 'Dumbbells', 'Pull-up Bar', 'Bench'],
      energy: 'moderate',
      focus: 'Pull',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Cable Machine', 'Dumbbells', 'Pull-up Bar', 'Bench'],
      timeAvailableMinutes: 80,
      energyToday: 'moderate',
      primaryGoal: 'muscle gain',
      preferredStyle: 'Bodybuilding',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Pull' },
    softReviewHints: [
      'Should feel like a back day, not just a mixed upper session',
    ],
  }),
  createScenario({
    id: 'intermediate-powerbuilding-upper-70',
    title: 'Intermediate powerbuilding upper-body 70-minute session',
    description:
      'An intermediate lifter wants a session that starts heavy and finishes with bodybuilding-style accessories.',
    tags: ['intermediate', 'powerbuilding', 'upper-body', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 70,
      equipment: ['Barbell', 'Bench', 'Cable Machine', 'Dumbbells'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Barbell', 'Bench', 'Cable Machine', 'Dumbbells'],
      timeAvailableMinutes: 70,
      energyToday: 'moderate',
      primaryGoal: 'strength and size',
      preferredStyle: 'Powerbuilding',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
  }),
  createScenario({
    id: 'advanced-powerlifting-squat-day-90',
    title: 'Advanced powerlifting squat day 90-minute session',
    description:
      'A competitive powerlifter wants a long squat-focused session with main work and supporting accessories.',
    tags: ['advanced', 'powerlifting', 'lower-body', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 90,
      equipment: ['Barbell', 'Bench', 'Squat Rack'],
      energy: 'intense',
      focus: 'Lower Body',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Barbell', 'Bench', 'Squat Rack'],
      timeAvailableMinutes: 90,
      energyToday: 'intense',
      primaryGoal: 'powerlifting total',
      preferredStyle: 'Powerlifting',
      focusBias: ['Lower Body'],
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Lower Body' },
    softReviewHints: [
      'Should center on squat work and not drift into conditioning',
    ],
  }),
  createScenario({
    id: 'advanced-powerlifting-bench-day-75',
    title: 'Advanced powerlifting bench day 75-minute session',
    description:
      'A powerlifter wants a bench-focused day with competition-style pressing and supporting upper-body work.',
    tags: ['advanced', 'powerlifting', 'push', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 75,
      equipment: ['Barbell', 'Bench', 'Dumbbells'],
      energy: 'moderate',
      focus: 'Push',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Barbell', 'Bench', 'Dumbbells'],
      timeAvailableMinutes: 75,
      energyToday: 'moderate',
      primaryGoal: 'powerlifting total',
      preferredStyle: 'Powerlifting',
      focusBias: ['Push'],
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Push' },
  }),
  createScenario({
    id: 'advanced-powerlifting-deadlift-day-85',
    title: 'Advanced powerlifting deadlift day 85-minute session',
    description:
      'A powerlifter wants a deadlift-focused training day with posterior-chain support work.',
    tags: ['advanced', 'powerlifting', 'pull', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 85,
      equipment: ['Barbell', 'Bench', 'Pull-up Bar'],
      energy: 'intense',
      focus: 'Pull',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Barbell', 'Bench', 'Pull-up Bar'],
      timeAvailableMinutes: 85,
      energyToday: 'intense',
      primaryGoal: 'powerlifting total',
      preferredStyle: 'Powerlifting',
      focusBias: ['Pull'],
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Pull' },
    softReviewHints: [
      'Should feel posterior-chain heavy and specific to deadlift progress',
    ],
  }),
  createScenario({
    id: 'intermediate-bodybuilding-glute-focus-70',
    title: 'Intermediate bodybuilding glute-focus 70-minute session',
    description:
      'An intermediate lifter wants a long glute-biased hypertrophy session with a clear lower-body pump focus.',
    tags: ['intermediate', 'bodybuilding', 'glutes', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 70,
      equipment: ['Barbell', 'Bench', 'Dumbbells', 'Resistance Bands'],
      energy: 'moderate',
      focus: 'Lower Body',
    },
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Barbell', 'Bench', 'Dumbbells', 'Resistance Bands'],
      timeAvailableMinutes: 70,
      energyToday: 'moderate',
      primaryGoal: 'glute hypertrophy',
      preferredStyle: 'Bodybuilding',
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Lower Body' },
    softReviewHints: ['Should feel clearly glute-biased, not generic leg day'],
  }),
  createScenario({
    id: 'advanced-arm-specialization-65',
    title: 'Advanced arm specialization 65-minute session',
    description:
      'An advanced bodybuilder wants a long arm-focused session with triceps and biceps specialization work.',
    tags: ['advanced', 'bodybuilding', 'arms', 'long', 'initial'],
    mode: 'initial',
    request: {
      timeMinutes: 65,
      equipment: ['Cable Machine', 'Dumbbells', 'Bench'],
      energy: 'moderate',
      focus: 'Upper Body',
    },
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Cable Machine', 'Dumbbells', 'Bench'],
      timeAvailableMinutes: 65,
      energyToday: 'moderate',
      primaryGoal: 'arm hypertrophy',
      preferredStyle: 'Bodybuilding',
      focusBias: ['Upper Body'],
      recentSessions: [],
    }),
    hardExpectations: { requiredFocus: 'Upper Body' },
    softReviewHints: [
      'Should include direct arm work and feel specialization-oriented',
    ],
  }),
  createScenario({
    id: 'regen-too-hard-bodyweight',
    title: 'Regenerate bodyweight session after too-hard feedback',
    description:
      'A bodyweight plan was too hard and needs a gentler regeneration.',
    tags: ['regeneration', 'too-hard', 'bodyweight'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-too-hard-bodyweight',
      feedback: ['too-hard'],
      timeMinutes: 20,
      energy: 'easy',
      focus: 'Full Body',
      equipment: ['Bodyweight'],
    }),
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 20,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Full Body',
      durationMinutes: 20,
      equipment: ['Bodyweight'],
      summary: 'A tough bodyweight circuit that felt too demanding.',
    }),
    hardExpectations: {
      requiredFocus: 'Full Body',
      requireRegenerationDifference: true,
    },
  }),
  createScenario({
    id: 'regen-too-easy-dumbbells',
    title: 'Regenerate dumbbell session after too-easy feedback',
    description:
      'A dumbbell plan felt too easy and should come back more challenging.',
    tags: ['regeneration', 'too-easy', 'dumbbells'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-too-easy-dumbbells',
      feedback: ['too-easy'],
      timeMinutes: 35,
      energy: 'intense',
      focus: 'Upper Body',
      equipment: ['Dumbbells', 'Bench'],
    }),
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 35,
      energyToday: 'intense',
      primaryGoal: 'build muscle',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Upper Body',
      durationMinutes: 35,
      equipment: ['Dumbbells', 'Bench'],
      summary: 'An upper-body dumbbell plan that landed too easy.',
    }),
    hardExpectations: {
      requiredFocus: 'Upper Body',
      requireRegenerationDifference: true,
    },
  }),
  createScenario({
    id: 'regen-different-exercises-upper',
    title: 'Regenerate upper-body session with different exercises',
    description:
      'The user wants a fresh upper-body workout, not the same movements again.',
    tags: ['regeneration', 'different-exercises', 'upper-body'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-different-upper',
      feedback: ['different-exercises'],
      timeMinutes: 40,
      energy: 'moderate',
      focus: 'Upper Body',
      equipment: ['Dumbbells', 'Bench'],
    }),
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 40,
      energyToday: 'moderate',
      primaryGoal: 'upper body strength',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Upper Body',
      durationMinutes: 40,
      equipment: ['Dumbbells', 'Bench'],
      summary: 'An upper-body session that repeated too many familiar lifts.',
    }),
    hardExpectations: {
      requiredFocus: 'Upper Body',
      requireRegenerationDifference: true,
    },
  }),
  createScenario({
    id: 'regen-just-try-again-full-body',
    title: 'Regenerate full-body session with try-again feedback',
    description:
      'The user wants the model to try again without a detailed reason.',
    tags: ['regeneration', 'just-try-again', 'full-body'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-try-again-full-body',
      feedback: ['just-try-again'],
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Full Body',
      equipment: ['Dumbbells', 'Resistance Bands'],
    }),
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Resistance Bands'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Full Body',
      durationMinutes: 30,
      equipment: ['Dumbbells', 'Resistance Bands'],
      summary: 'A full-body workout that the user simply wants refreshed.',
    }),
    hardExpectations: {
      requiredFocus: 'Full Body',
      requireRegenerationDifference: true,
    },
  }),
  createScenario({
    id: 'regen-too-hard-after-upcoming-run',
    title: 'Regenerate after too-hard feedback with upcoming run',
    description:
      'The user found the plan too hard and also has a run coming up soon.',
    tags: ['regeneration', 'too-hard', 'upcoming-run'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-too-hard-run',
      feedback: ['too-hard'],
      timeMinutes: 25,
      energy: 'easy',
      focus: 'Smart',
      upcomingEvents: [
        buildEvent({
          kind: 'run',
          title: '5K race',
          localDate: relativeLocalDate(1),
          durationMinutes: 30,
          intensity: 'high',
        }),
      ],
    }),
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Resistance Bands'],
      timeAvailableMinutes: 25,
      energyToday: 'easy',
      primaryGoal: 'run performance',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Conditioning',
      durationMinutes: 25,
      equipment: ['Bodyweight', 'Resistance Bands'],
      summary: 'A conditioning-heavy plan that felt too hard before a run.',
    }),
    hardExpectations: {
      requireRegenerationDifference: true,
      requireUpcomingEventSensitivity: true,
      disallowedFocuses: ['Lower Body', 'Conditioning'],
    },
  }),
  createScenario({
    id: 'regen-different-exercises-shoulder-safe',
    title: 'Regenerate shoulder-safe session with different exercises',
    description:
      'The user wants different exercises while still protecting a sensitive shoulder.',
    tags: ['regeneration', 'different-exercises', 'shoulder-safe'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-different-shoulder-safe',
      feedback: ['different-exercises'],
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Upper Body',
      equipment: ['Resistance Bands', 'Bodyweight'],
    }),
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Resistance Bands', 'Bodyweight'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      injuries: ['right shoulder irritation'],
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Upper Body',
      durationMinutes: 30,
      equipment: ['Resistance Bands', 'Bodyweight'],
      summary: 'A shoulder-safe session that still felt repetitive.',
    }),
    hardExpectations: {
      requiredFocus: 'Upper Body',
      bannedExerciseTerms: ['overhead press', 'snatch'],
      requireRegenerationDifference: true,
    },
  }),
  createScenario({
    id: 'regen-notes-more-core',
    title: 'Regenerate with notes asking for more core',
    description:
      'The user wants the regenerated workout to include more core work.',
    tags: ['regeneration', 'notes', 'core'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-more-core',
      feedback: ['just-try-again'],
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Full Body',
      equipment: ['Bodyweight', 'Dumbbells'],
      notes: 'Please make the next version more core-focused.',
    }),
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight', 'Dumbbells'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general strength',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Full Body',
      durationMinutes: 30,
      equipment: ['Bodyweight', 'Dumbbells'],
      summary: 'A full-body workout that underemphasized the core.',
    }),
    hardExpectations: {
      requiredFocus: 'Full Body',
      requireRegenerationDifference: true,
    },
    softReviewHints: ['Core emphasis should be clearer than before'],
  }),
  createScenario({
    id: 'regen-notes-lower-impact',
    title: 'Regenerate with notes asking for lower impact',
    description: 'The user wants the next version to be gentler on joints.',
    tags: ['regeneration', 'notes', 'lower-impact'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-lower-impact',
      feedback: ['too-hard'],
      timeMinutes: 25,
      energy: 'easy',
      focus: 'Conditioning',
      equipment: ['Bodyweight'],
      notes: 'Lower impact please. My joints are cranky today.',
    }),
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 25,
      energyToday: 'easy',
      primaryGoal: 'improve endurance',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Conditioning',
      durationMinutes: 25,
      equipment: ['Bodyweight'],
      summary: 'A conditioning plan that felt too high impact.',
    }),
    hardExpectations: {
      requireRegenerationDifference: true,
      bannedExerciseTerms: ['burpee', 'jump squat'],
    },
  }),
  createScenario({
    id: 'regen-time-cut-45-to-20',
    title: 'Regenerate after time drops from 45 to 20 minutes',
    description:
      'The user needs the regenerated workout to respect a sharply reduced time budget.',
    tags: ['regeneration', 'time-change', 'initial-override'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-time-cut',
      feedback: ['just-try-again'],
      timeMinutes: 20,
      energy: 'moderate',
      focus: 'Upper Body',
      equipment: ['Dumbbells', 'Bench'],
    }),
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 20,
      energyToday: 'moderate',
      primaryGoal: 'upper body strength',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Upper Body',
      durationMinutes: 45,
      equipment: ['Dumbbells', 'Bench'],
      summary: 'A longer upper-body workout that no longer fits the schedule.',
    }),
    hardExpectations: {
      requiredFocus: 'Upper Body',
      durationToleranceMinutes: 5,
      requireRegenerationDifference: true,
    },
  }),
  createScenario({
    id: 'regen-equipment-change-gym-to-bodyweight',
    title: 'Regenerate after equipment changes from gym to bodyweight',
    description:
      'The user lost gym access and needs a bodyweight-compatible regeneration.',
    tags: ['regeneration', 'equipment-change', 'bodyweight'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-equipment-change',
      feedback: ['different-exercises'],
      timeMinutes: 30,
      energy: 'moderate',
      focus: 'Full Body',
      equipment: ['Bodyweight'],
    }),
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 30,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [],
      location: 'hotel room',
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Full Body',
      durationMinutes: 30,
      equipment: ['Dumbbells', 'Bench'],
      summary:
        'A gym-dependent workout that now needs a bodyweight substitute.',
    }),
    hardExpectations: {
      requiredFocus: 'Full Body',
      requireRegenerationDifference: true,
    },
  }),
  createScenario({
    id: 'regen-focus-change-auto-to-lower',
    title: 'Regenerate after focus changes from smart to lower body',
    description:
      'The user wants the next version to explicitly bias lower body.',
    tags: ['regeneration', 'focus-change', 'lower-body'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-focus-change',
      feedback: ['just-try-again'],
      timeMinutes: 40,
      energy: 'moderate',
      focus: 'Lower Body',
      equipment: ['Dumbbells', 'Bench'],
    }),
    context: buildContext({
      experienceLevel: 'intermediate',
      equipment: ['Dumbbells', 'Bench'],
      timeAvailableMinutes: 40,
      energyToday: 'moderate',
      primaryGoal: 'leg strength',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Full Body',
      durationMinutes: 40,
      equipment: ['Dumbbells', 'Bench'],
      summary:
        'A smart full-body workout that now needs to target lower body more directly.',
    }),
    hardExpectations: {
      requiredFocus: 'Lower Body',
      requireRegenerationDifference: true,
    },
  }),
  createScenario({
    id: 'regen-feedback-plus-travel-event',
    title: 'Regenerate with feedback plus upcoming travel event',
    description:
      'The user wants a retry, but also has travel coming up very soon.',
    tags: ['regeneration', 'travel', 'upcoming-event'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-feedback-travel',
      feedback: ['just-try-again'],
      timeMinutes: 20,
      energy: 'easy',
      focus: 'Full Body',
      equipment: ['Bodyweight'],
      upcomingEvents: [
        buildEvent({
          kind: 'travel',
          title: 'Early flight tomorrow',
          localDate: relativeLocalDate(1),
          allDay: true,
        }),
      ],
      notes: 'Want something that will not leave me wiped before travel.',
    }),
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight'],
      timeAvailableMinutes: 20,
      energyToday: 'easy',
      primaryGoal: 'general fitness',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Conditioning',
      durationMinutes: 20,
      equipment: ['Bodyweight'],
      summary: 'A retry plan that would feel too draining before travel.',
    }),
    hardExpectations: {
      requiredFocus: 'Full Body',
      requireRegenerationDifference: true,
      requireUpcomingEventSensitivity: true,
      disallowedFocuses: ['Conditioning'],
    },
  }),
  createScenario({
    id: 'regen-too-easy-after-recovery-day',
    title: 'Regenerate after too-easy feedback on a recovery-biased day',
    description:
      'The user wants more challenge, but the day is still meant to stay relatively restorative.',
    tags: ['regeneration', 'too-easy', 'recovery-day'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-too-easy-recovery-day',
      feedback: ['too-easy'],
      timeMinutes: 25,
      energy: 'moderate',
      focus: 'Smart',
      equipment: ['Bodyweight', 'Resistance Bands'],
    }),
    context: buildContext({
      experienceLevel: 'beginner',
      equipment: ['Bodyweight', 'Resistance Bands'],
      timeAvailableMinutes: 25,
      energyToday: 'moderate',
      primaryGoal: 'general fitness',
      recentSessions: [
        buildSession({
          id: 'ctx-14',
          name: 'Long Run',
          focus: 'Conditioning',
          durationMinutes: 70,
          completedAt: relativeCompletedAt({ daysAgo: 1, hour: 9 }),
          perceivedEffort: 'intense',
        }),
      ],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Recovery',
      durationMinutes: 25,
      equipment: ['Bodyweight', 'Resistance Bands'],
      summary:
        'A very gentle recovery plan that now needs a bit more challenge.',
    }),
    hardExpectations: { requireRegenerationDifference: true },
  }),
  createScenario({
    id: 'regen-different-exercises-full-gym-pull',
    title: 'Regenerate full-gym pull session with different exercises',
    description:
      'An advanced user wants a fresh pull workout using full gym access.',
    tags: ['regeneration', 'different-exercises', 'full-gym', 'pull'],
    mode: 'regeneration',
    request: createRegenerationRequest({
      previousResponseId: 'resp-different-full-gym-pull',
      feedback: ['different-exercises'],
      timeMinutes: 50,
      energy: 'moderate',
      focus: 'Pull',
      equipment: ['Cable Machine', 'Pull-up Bar', 'Barbell', 'Bench'],
    }),
    context: buildContext({
      experienceLevel: 'advanced',
      equipment: ['Cable Machine', 'Pull-up Bar', 'Barbell', 'Bench'],
      timeAvailableMinutes: 50,
      energyToday: 'moderate',
      primaryGoal: 'build muscle',
      recentSessions: [],
    }),
    baselinePlan: createBaselinePlan({
      focus: 'Pull',
      durationMinutes: 50,
      equipment: ['Cable Machine', 'Pull-up Bar', 'Barbell', 'Bench'],
      summary: 'A pull workout that needs fresher exercise selection.',
    }),
    hardExpectations: {
      requiredFocus: 'Pull',
      requireRegenerationDifference: true,
    },
  }),
];

export const workoutGenerationEvaluationCorpus: GenerationEvaluationCorpus =
  validateGenerationEvaluationCorpus({
    version: WORKOUT_GENERATION_EVALUATION_CORPUS_VERSION,
    rubricVersion: WORKOUT_GENERATION_EVALUATION_RUBRIC_VERSION,
    scenarios,
  });

export const workoutGenerationEvaluationScenarios =
  workoutGenerationEvaluationCorpus.scenarios;
