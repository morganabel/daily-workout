import {
  MIN_GENERATION_EVALUATION_SCENARIOS,
  generationEvaluationCorpusSchema,
  generationEvaluationScenarioSchema,
} from '../contracts/generation-evaluation';
import { workoutGenerationEvaluationCorpus } from './workout-generation-scenarios';

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
    const regenerationScenarios = workoutGenerationEvaluationCorpus.scenarios.filter(
      (scenario) => scenario.mode === 'regeneration'
    );

    expect(regenerationScenarios.length).toBeGreaterThanOrEqual(8);
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
