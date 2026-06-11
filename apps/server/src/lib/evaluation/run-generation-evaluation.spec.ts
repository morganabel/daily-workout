import os from 'node:os';
import path from 'node:path';

import { runGenerationEvaluation } from './generation-evaluation-runner';

type RunnerOptions = Parameters<typeof runGenerationEvaluation>[0];

const DEFAULT_EVALUATION_TIMEOUT_MS = 600000;

function loadEvaluationTimeoutMs(): number {
  const raw = process.env.GENERATION_EVAL_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_EVALUATION_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_EVALUATION_TIMEOUT_MS;
}

function loadOptions(): RunnerOptions | null {
  const raw = process.env.GENERATION_EVAL_OPTIONS_JSON;
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as RunnerOptions;
  return {
    ...parsed,
    outputDir: path.isAbsolute(parsed.outputDir)
      ? parsed.outputDir
      : path.join(process.cwd(), parsed.outputDir),
  };
}

describe('generation evaluation runner', () => {
  it('classifies auto-mode catalog fixture rows as library execution source', async () => {
    const outputDir = path.join(
      os.tmpdir(),
      `workout-generation-eval-source-${Date.now()}`
    );

    const result = await runGenerationEvaluation({
      providers: ['fixture'],
      runs: 1,
      edition: 'CE',
      outputDir,
      scenarioIds: ['beginner-bodyweight-moderate-30'],
    });
    const entry = result.report.entries[0];

    expect(entry.plan?.source).toBe('library');
    expect(entry.executionSource).toBe('library');
    expect(result.report.summary.fixtureEntries).toBe(0);
    expect(result.report.summary.executionSourceCounts.library).toBe(1);
  });

  it(
    'executes the evaluation workflow and writes report artifacts',
    async () => {
      const options = loadOptions();
      if (!options) {
        expect(true).toBe(true);
        return;
      }

      const result = await runGenerationEvaluation(options);

      expect(result.report.entries.length).toBeGreaterThan(0);
      expect(result.artifacts.html).toContain('report.html');
      expect(result.artifacts.json).toContain('report.json');
      expect(result.artifacts.markdown).toContain('report.md');
    },
    loadEvaluationTimeoutMs()
  );
});
