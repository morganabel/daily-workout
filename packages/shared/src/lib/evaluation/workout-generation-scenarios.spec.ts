import {
  MIN_GENERATION_EVALUATION_SCENARIOS,
  generationEvaluationCorpusSchema,
  generationEvaluationScenarioSchema,
} from '../contracts/generation-evaluation';
import { workoutGenerationEvaluationCorpus } from './workout-generation-scenarios';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

describe('workout generation evaluation corpus', () => {
  it('exports a valid corpus with at least 50 scenarios', () => {
    const parsed = generationEvaluationCorpusSchema.parse(
      workoutGenerationEvaluationCorpus
    );

    expect(parsed.scenarios.length).toBeGreaterThanOrEqual(
      MIN_GENERATION_EVALUATION_SCENARIOS
    );
    expect(parsed.rubricVersion).toBeTruthy();
  });

  it('contains unique scenario ids', () => {
    const ids = workoutGenerationEvaluationCorpus.scenarios.map(
      (scenario) => scenario.id
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains a meaningful set of regeneration scenarios', () => {
    const regenerationScenarios =
      workoutGenerationEvaluationCorpus.scenarios.filter(
        (scenario) => scenario.mode === 'regeneration'
      );

    expect(regenerationScenarios.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps recent session context within the last week', () => {
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    for (const scenario of workoutGenerationEvaluationCorpus.scenarios) {
      for (const session of scenario.context?.recentSessions ?? []) {
        const completedAt = new Date(session.completedAt);
        const ageMs = now.getTime() - completedAt.getTime();

        expect(ageMs).toBeGreaterThanOrEqual(0);
        expect(ageMs).toBeLessThanOrEqual(sevenDaysMs);
      }
    }
  });

  it('keeps upcoming event dates in the future relative to the run date', () => {
    const today = startOfToday();

    for (const scenario of workoutGenerationEvaluationCorpus.scenarios) {
      for (const event of scenario.request.upcomingEvents ?? []) {
        const eventDate = parseLocalDate(event.localDate);
        expect(eventDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
      }
    }
  });

  it('covers long bodybuilding and powerlifting style scenarios', () => {
    const scenarioIds = new Set(
      workoutGenerationEvaluationCorpus.scenarios.map((scenario) => scenario.id)
    );

    expect(scenarioIds.has('advanced-bodybuilding-upper-75')).toBe(true);
    expect(scenarioIds.has('advanced-bodybuilding-leg-day-90')).toBe(true);
    expect(scenarioIds.has('advanced-powerlifting-squat-day-90')).toBe(true);
    expect(scenarioIds.has('advanced-powerlifting-deadlift-day-85')).toBe(true);
  });

  it('covers repeated catalog history scenarios', () => {
    const scenarioIds = new Set(
      workoutGenerationEvaluationCorpus.scenarios.map((scenario) => scenario.id)
    );

    expect(
      scenarioIds.has('beginner-bodyweight-moderate-30-recent-catalog')
    ).toBe(true);
    expect(
      scenarioIds.has('beginner-dumbbells-moderate-30-recent-catalog')
    ).toBe(true);
    expect(scenarioIds.has('treadmill-recovery-cardio-30-recent-catalog')).toBe(
      true
    );
    expect(
      scenarioIds.has('advanced-powerlifting-deadlift-day-85-recent-catalog')
    ).toBe(true);
  });

  it('rejects initial scenarios with regeneration-only fields', () => {
    const result = generationEvaluationScenarioSchema.safeParse({
      id: 'invalid-initial-with-feedback',
      title: 'Invalid initial scenario',
      description: 'Should fail because it includes feedback.',
      tags: ['invalid', 'initial'],
      mode: 'initial',
      request: {
        timeMinutes: 20,
        previousResponseId: 'resp-123',
        feedback: ['just-try-again'],
      },
      hardExpectations: {
        requireSchemaValidity: true,
        durationToleranceMinutes: 10,
        requireOnlyAvailableEquipment: true,
        bannedExerciseTerms: [],
        requireRegenerationDifference: false,
        requireUpcomingEventSensitivity: false,
        notes: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects regeneration scenarios missing required fields', () => {
    const result = generationEvaluationScenarioSchema.safeParse({
      id: 'invalid-regeneration-without-response-id',
      title: 'Invalid regeneration scenario',
      description: 'Should fail because it is missing previousResponseId.',
      tags: ['invalid', 'regeneration'],
      mode: 'regeneration',
      request: {
        timeMinutes: 20,
        feedback: ['too-hard'],
      },
      hardExpectations: {
        requireSchemaValidity: true,
        durationToleranceMinutes: 10,
        requireOnlyAvailableEquipment: true,
        bannedExerciseTerms: [],
        requireRegenerationDifference: false,
        requireUpcomingEventSensitivity: false,
        notes: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate ids in a corpus', () => {
    const duplicateScenario = workoutGenerationEvaluationCorpus.scenarios[0];
    const result = generationEvaluationCorpusSchema.safeParse({
      version: 'test-v1',
      rubricVersion: 'rubric-v1',
      scenarios: Array.from(
        { length: MIN_GENERATION_EVALUATION_SCENARIOS },
        (_, index) => ({
          ...duplicateScenario,
          id: index === 1 ? duplicateScenario.id : `copy-${index}`,
          title:
            index === 1 ? duplicateScenario.title : `Copy scenario ${index}`,
          mode: 'initial',
          request: {
            timeMinutes: 20,
            focus: 'Full Body',
          },
          hardExpectations: {
            ...duplicateScenario.hardExpectations,
            requireRegenerationDifference: false,
          },
        })
      ),
    });

    expect(result.success).toBe(false);
  });
});
