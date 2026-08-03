import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

function sanitizeSegment(value) {
  return String(value ?? 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseVars(context) {
  const vars = context?.vars ?? {};
  const scenarioId = vars.scenarioId;
  if (typeof scenarioId !== 'string' || scenarioId.trim().length === 0) {
    throw new Error(
      'Promptfoo workout-generation provider requires vars.scenarioId.'
    );
  }

  const provider = vars.provider ?? 'openai';
  if (!['fixture', 'openai', 'gemini', 'openrouter'].includes(provider)) {
    throw new Error(`Unsupported workout-generation provider: ${provider}`);
  }

  const edition = vars.edition ?? 'CE';
  if (!['CE', 'HOSTED'].includes(edition)) {
    throw new Error(`Unsupported workout-generation edition: ${edition}`);
  }

  const runIndex = Number.parseInt(String(vars.runIndex ?? '1'), 10);
  if (!Number.isInteger(runIndex) || runIndex < 1) {
    throw new Error('vars.runIndex must be an integer >= 1.');
  }

  const plannerMode = vars.plannerMode ?? 'default';
  if (!['default', 'enabled', 'disabled'].includes(plannerMode)) {
    throw new Error(`Unsupported planner mode: ${plannerMode}`);
  }

  return {
    scenarioId: scenarioId.trim(),
    provider,
    edition,
    runIndex,
    plannerMode,
    variantLabel:
      typeof vars.variantLabel === 'string' &&
      vars.variantLabel.trim().length > 0
        ? vars.variantLabel.trim()
        : 'default',
  };
}

function buildProviderOutput(entry, vars, warnings) {
  const failedHardChecks = (entry.hardChecks ?? []).filter(
    (check) => check.status === 'fail'
  );

  return {
    scenarioId: entry.scenarioId,
    scenarioTitle: entry.scenarioTitle,
    scenarioTags: entry.scenarioTags,
    scenarioMode: entry.scenarioMode,
    provider: entry.provider,
    executionSource: entry.executionSource,
    status: entry.status,
    runId: entry.runId,
    promptfooRunId: `${entry.scenarioId}-${entry.provider}-${vars.variantLabel}-${vars.runIndex}`,
    variantLabel: vars.variantLabel,
    plannerMode: vars.plannerMode,
    pass: entry.status === 'success' && failedHardChecks.length === 0,
    failedHardChecks,
    hardChecks: entry.hardChecks ?? [],
    latencyMs: entry.latencyMs,
    plannerSummary: entry.plannerSummary,
    modelCalls: entry.modelCalls ?? [],
    costSummary: entry.costSummary,
    setupModelCalls: entry.setupModelCalls ?? [],
    setupCostSummary: entry.setupCostSummary,
    plan: entry.plan,
    errorCode: entry.errorCode,
    errorMessage: entry.errorMessage,
    warnings,
  };
}

function readReport(outputDir) {
  const reportPath = path.join(outputDir, 'report.json');
  if (!existsSync(reportPath)) {
    throw new Error(`Generation evaluation report not found at ${reportPath}`);
  }

  return JSON.parse(readFileSync(reportPath, 'utf8'));
}

export default class WorkoutGenerationEvaluationProvider {
  constructor(options = {}) {
    this.config = options.config ?? {};
    this.providerId = options.id ?? 'workout-generation-evaluation';
  }

  id() {
    return this.providerId;
  }

  async callApi(_prompt, context) {
    const vars = parseVars(context);
    const outputRoot = path.resolve(
      repoRoot,
      this.config.outputRoot ??
        process.env.PROMPTFOO_WORKOUT_PROVIDER_CALL_DIR ??
        'reports/promptfoo-generation/provider-calls'
    );
    const outputDir = path.join(
      outputRoot,
      [
        Date.now(),
        process.pid,
        randomUUID(),
        sanitizeSegment(vars.scenarioId),
        sanitizeSegment(vars.provider),
        vars.runIndex,
      ].join('-')
    );
    await mkdir(outputDir, { recursive: true });

    const env = { ...process.env };
    if (vars.plannerMode === 'enabled') {
      env.ENABLE_STAGE_ONE_PLANNER = 'true';
    }
    if (vars.plannerMode === 'disabled') {
      env.ENABLE_STAGE_ONE_PLANNER = 'false';
    }

    const result = spawnSync(
      process.execPath,
      [
        './tools/scripts/run-generation-evaluation.mjs',
        '--provider',
        vars.provider,
        '--scenario',
        vars.scenarioId,
        '--runs',
        '1',
        '--edition',
        vars.edition,
        '--output-dir',
        outputDir,
      ],
      {
        cwd: repoRoot,
        env,
        encoding: 'utf8',
        shell: false,
      }
    );

    if (result.status !== 0) {
      return {
        error:
          result.stderr?.trim() ||
          result.stdout?.trim() ||
          `Generation evaluation exited with status ${result.status}`,
      };
    }

    const report = readReport(outputDir);
    const entry = report.entries?.[0];
    if (!entry) {
      return {
        error: 'Generation evaluation completed without report entries.',
      };
    }

    const output = buildProviderOutput(entry, vars, report.warnings ?? []);
    const requestUsage = output.costSummary ?? {};
    const setupUsage = output.setupCostSummary ?? {};
    const allInCostNanoUsd = (
      BigInt(requestUsage.accountedCostNanoUsd ?? '0') +
      BigInt(setupUsage.accountedCostNanoUsd ?? '0')
    ).toString();
    return {
      output: JSON.stringify(output),
      prompt: `workout-generation-scenario:${vars.scenarioId}`,
      cost: Number(BigInt(allInCostNanoUsd)) / 1_000_000_000,
      tokenUsage: {
        prompt: (requestUsage.inputTokens ?? 0) + (setupUsage.inputTokens ?? 0),
        completion:
          (requestUsage.outputTokens ?? 0) + (setupUsage.outputTokens ?? 0),
        total: (requestUsage.totalTokens ?? 0) + (setupUsage.totalTokens ?? 0),
        cached:
          (requestUsage.cachedInputTokens ?? 0) +
          (setupUsage.cachedInputTokens ?? 0),
        numRequests:
          (requestUsage.callCount ?? 0) + (setupUsage.callCount ?? 0),
      },
      metadata: {
        scenarioId: output.scenarioId,
        provider: output.provider,
        executionSource: output.executionSource,
        status: output.status,
        pass: output.pass,
        failedHardChecks: output.failedHardChecks.map((check) => check.name),
        variantLabel: output.variantLabel,
        plannerMode: output.plannerMode,
        requestCostNanoUsd: requestUsage.accountedCostNanoUsd ?? '0',
        setupCostNanoUsd: setupUsage.accountedCostNanoUsd ?? '0',
        allInCostNanoUsd,
        unknownCostCallCount:
          (requestUsage.unknownCostCallCount ?? 0) +
          (setupUsage.unknownCostCallCount ?? 0),
        modelCalls: output.modelCalls,
        setupModelCalls: output.setupModelCalls,
        reportDir: outputDir,
      },
    };
  }
}
