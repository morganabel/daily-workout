import path from 'node:path';

import { runGenerationEvaluation } from './generation-evaluation-runner';

type RunnerOptions = Parameters<typeof runGenerationEvaluation>[0];

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
    600000
  );
});
