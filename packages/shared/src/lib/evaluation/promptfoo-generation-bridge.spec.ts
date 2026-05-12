import {
  assertPromptfooArtifactHasNoSecrets,
  buildPromptfooGenerationPreflightSummary,
  buildPromptfooGenerationTestCases,
  findPromptfooSecretLeaks,
  selectPromptfooGenerationScenarios,
} from './promptfoo-generation-bridge';

describe('Promptfoo generation bridge', () => {
  it('selects canonical scenarios by id', () => {
    const scenarios = selectPromptfooGenerationScenarios({
      scenarioIds: ['beginner-bodyweight-easy-15'],
    });

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]?.id).toBe('beginner-bodyweight-easy-15');
    expect(scenarios[0]?.request.timeMinutes).toBe(15);
    expect(scenarios[0]?.hardExpectations.requireSchemaValidity).toBe(true);
  });

  it('selects canonical scenarios by tag and limit', () => {
    const scenarios = selectPromptfooGenerationScenarios({
      tags: ['beginner', 'bodyweight'],
      limit: 2,
    });

    expect(scenarios).toHaveLength(2);
    expect(
      scenarios.every(
        (scenario) =>
          scenario.tags.includes('beginner') && scenario.tags.includes('bodyweight'),
      ),
    ).toBe(true);
  });

  it('fails before provider execution for unknown scenario ids', () => {
    expect(() =>
      selectPromptfooGenerationScenarios({ scenarioIds: ['missing-scenario'] }),
    ).toThrow(/Unknown generation evaluation scenario id/);
  });

  it('builds Promptfoo tests across providers and repeated runs', () => {
    const tests = buildPromptfooGenerationTestCases({
      scenarioIds: ['beginner-bodyweight-easy-15'],
      providers: ['mock', 'openai'],
      runs: 2,
      edition: 'CE',
      variantLabel: 'candidate-prompt',
      plannerMode: 'disabled',
      softReview: true,
    });

    expect(tests).toHaveLength(4);
    expect(tests.map((test) => test.vars.provider)).toEqual([
      'mock',
      'mock',
      'openai',
      'openai',
    ]);
    expect(tests.map((test) => test.vars.runIndex)).toEqual([1, 2, 1, 2]);
    expect(tests[0]?.vars.variantLabel).toBe('candidate-prompt');
    expect(tests[0]?.vars.plannerMode).toBe('disabled');
    expect(tests[0]?.vars.softReview).toBe(true);
    expect(tests[0]?.vars).not.toHaveProperty('scenarioTags');
    expect(tests[0]?.metadata.scenarioTags).toEqual([
      'beginner',
      'bodyweight',
      'easy',
      'short',
      'initial',
    ]);
  });

  it('builds warnings for mock-only, missing live access, and broad live runs', () => {
    const scenarios = selectPromptfooGenerationScenarios({ limit: 60 });
    const summary = buildPromptfooGenerationPreflightSummary({
      scenarios,
      providers: ['mock', 'openai'],
      runs: 2,
      edition: 'CE',
      providerAvailability: { openai: false },
      liveAttemptWarningThreshold: 10,
    });

    expect(summary.selectedScenarioCount).toBe(60);
    expect(summary.liveProviderCount).toBe(1);
    expect(summary.liveAttemptCount).toBeGreaterThanOrEqual(120);
    expect(summary.warnings.join('\n')).toContain('openai has no configured access in CE');
    expect(summary.warnings.join('\n')).toContain('cost and quota');
  });

  it('distinguishes unknown provider availability from missing access', () => {
    const scenarios = selectPromptfooGenerationScenarios({ limit: 1 });
    const summary = buildPromptfooGenerationPreflightSummary({
      scenarios,
      providers: ['openai'],
      runs: 1,
      edition: 'CE',
    });

    expect(summary.warnings.join('\n')).toContain('openai access was not checked');
    expect(summary.warnings.join('\n')).not.toContain('openai has no configured access');
  });

  it('finds explicit secret leaks in nested Promptfoo artifacts', () => {
    const leaks = findPromptfooSecretLeaks(
      {
        results: {
          outputs: [
            {
              metadata: {
                authorization: 'Bearer test-device-token',
              },
            },
          ],
        },
      },
      [{ label: 'bearer token', value: 'test-device-token' }],
    );

    expect(leaks).toEqual([
      'bearer token leaked at results.outputs[0].metadata.authorization',
    ]);
  });

  it('passes when artifacts contain only redacted secret placeholders', () => {
    expect(() =>
      assertPromptfooArtifactHasNoSecrets(
        {
          headers: {
            authorization: '[redacted]',
            'x-openai-key': '[redacted]',
          },
        },
        [
          { label: 'bearer token', value: 'test-device-token' },
          { label: 'openai key', value: 'sk-test-secret' },
        ],
      ),
    ).not.toThrow();
  });
});
