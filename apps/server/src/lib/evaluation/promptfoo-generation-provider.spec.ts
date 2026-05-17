import type { GenerationEvaluationReportEntry } from '@workout-agent/shared';

import {
  buildPromptfooGenerationProviderOutput,
  gradePromptfooGenerationOutput,
  parsePromptfooGenerationProviderVars,
} from './promptfoo-generation-provider';

function createEntry(
  overrides: Partial<GenerationEvaluationReportEntry> = {}
): GenerationEvaluationReportEntry {
  return {
    scenarioId: 'beginner-bodyweight-easy-15',
    scenarioTitle: 'Beginner bodyweight easy 15-minute session',
    scenarioDescription: 'A short beginner bodyweight session.',
    scenarioTags: ['beginner', 'bodyweight', 'initial'],
    scenarioMode: 'initial',
    runId: 'beginner-bodyweight-easy-15-fixture-1',
    provider: 'fixture',
    executionSource: 'fixture',
    status: 'success',
    request: {
      timeMinutes: 15,
      focus: 'Full Body',
    },
    hardChecks: [
      { name: 'schema-validity', status: 'pass' },
      {
        name: 'duration-fit',
        status: 'pass',
        message: 'Target 15 min, got 15 min.',
      },
      { name: 'focus-fit', status: 'pass' },
      { name: 'equipment-fit', status: 'pass' },
      { name: 'injury-safety', status: 'not-applicable' },
      { name: 'avoid-list-safety', status: 'not-applicable' },
      { name: 'upcoming-event-sensitivity', status: 'not-applicable' },
      { name: 'regeneration-difference', status: 'not-applicable' },
    ],
    latencyMs: { totalRequestMs: 25 },
    plannerSummary: { usedStageOne: false },
    plan: {
      id: 'plan-test',
      summary: 'A simple beginner workout.',
      durationMinutes: 15,
      focus: 'Full Body',
      source: 'ai',
      energy: 'easy',
      equipment: ['Bodyweight'],
      responseId: 'resp-test',
      blocks: [
        {
          title: 'Warm-up',
          durationMinutes: 5,
          focus: 'Mobility',
          exercises: [
            {
              id: 'exercise-test',
              name: 'March in Place',
              prescription: '2 minutes',
              detail: null,
            },
          ],
        },
      ],
    },
    ...overrides,
  };
}

describe('Promptfoo generation provider helpers', () => {
  it('parses provider variables with defaults', () => {
    const vars = parsePromptfooGenerationProviderVars({
      scenarioId: 'beginner-bodyweight-easy-15',
      provider: 'fixture',
      runIndex: 2,
      edition: 'CE',
      variantLabel: 'current',
      plannerMode: 'enabled',
    });

    expect(vars).toEqual({
      scenarioId: 'beginner-bodyweight-easy-15',
      provider: 'fixture',
      runIndex: 2,
      edition: 'CE',
      variantLabel: 'current',
      plannerMode: 'enabled',
      softReview: false,
    });
  });

  it('rejects missing scenario variables before execution', () => {
    expect(() =>
      parsePromptfooGenerationProviderVars({ provider: 'fixture' })
    ).toThrow(/requires vars.scenarioId/);
  });

  it('maps successful entries with passing hard checks to Promptfoo pass output', () => {
    const output = buildPromptfooGenerationProviderOutput({
      entry: createEntry(),
      variantLabel: 'current-prompt',
      plannerMode: 'default',
      warnings: ['fixture-only'],
    });

    expect(output.pass).toBe(true);
    expect(output.failedHardChecks).toEqual([]);
    expect(output.variantLabel).toBe('current-prompt');
    expect(output.warnings).toEqual(['fixture-only']);
    expect(gradePromptfooGenerationOutput(output)).toEqual({
      pass: true,
      score: 1,
      reason: 'Generation succeeded and all domain hard checks passed.',
    });
  });

  it('maps hard-check failures to failed Promptfoo gate output', () => {
    const output = buildPromptfooGenerationProviderOutput({
      entry: createEntry({
        hardChecks: [
          { name: 'schema-validity', status: 'pass' },
          {
            name: 'equipment-fit',
            status: 'fail',
            message: 'Plan uses unavailable equipment: Barbell.',
          },
        ],
      }),
    });

    expect(output.pass).toBe(false);
    expect(output.failedHardChecks).toEqual([
      {
        name: 'equipment-fit',
        status: 'fail',
        message: 'Plan uses unavailable equipment: Barbell.',
      },
    ]);
    expect(gradePromptfooGenerationOutput(output)).toEqual({
      pass: false,
      score: 0,
      reason: 'Failed hard checks: equipment-fit.',
    });
  });

  it('maps generation errors to failed Promptfoo gate output', () => {
    const output = buildPromptfooGenerationProviderOutput({
      entry: createEntry({
        status: 'generation-error',
        plan: undefined,
        errorCode: 'BYOK_REQUIRED',
        errorMessage: 'Provider key is required.',
      }),
    });

    expect(output.pass).toBe(false);
    expect(gradePromptfooGenerationOutput(output)).toEqual({
      pass: false,
      score: 0,
      reason: 'Provider key is required.',
    });
  });
});
