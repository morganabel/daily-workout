import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function loadRepoEnv() {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), 'apps', 'server', '.env'),
    path.join(process.cwd(), 'apps', 'server', '.env.local'),
  ];
  const loaded = [];

  candidates.forEach((filePath) => {
    if (!existsSync(filePath)) {
      return;
    }
    process.loadEnvFile(filePath);
    loaded.push(path.relative(process.cwd(), filePath) || filePath);
  });

  return loaded;
}

function printHelp() {
  console.log(`
Run Promptfoo over workout generation evaluation scenarios.

Usage:
  npm run promptfoo:generation -- [options]

Options:
  --provider <value>        mock | openai | gemini | live | all (repeatable)
  --runs <number>           repeated runs per scenario/provider (default: 1)
  --tag <value>             filter scenarios by tag (repeatable)
  --scenario <id>           run only selected scenario id (repeatable)
  --limit <number>          cap total scenarios after filtering
  --edition <value>         CE | HOSTED (default: CE)
  --variant-label <value>   label for prompt/planner/provider comparison
  --planner <value>         default | enabled | disabled
  --soft-review             include advisory Promptfoo LLM-rubric soft scoring
  --ci                      fail after Promptfoo if output reports failures/errors
  --config-only             write Promptfoo config without running Promptfoo
  --output-dir <path>       output directory (default: reports/promptfoo-generation/<timestamp>)
  --open                    open the HTML report after generation (macOS)
  --help                    show this help message
`);
}

function parseListArg(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flagName} must be an integer >= 1. Received: ${value}`);
  }
  return parsed;
}

function expandProviders(values) {
  const expanded = values.flatMap((value) => {
    switch (value) {
      case 'all':
        return ['mock', 'openai', 'gemini'];
      case 'live':
        return ['openai', 'gemini'];
      case 'mock':
      case 'openai':
      case 'gemini':
        return [value];
      default:
        throw new Error(`Unsupported provider option: ${value}`);
    }
  });

  return [...new Set(expanded)];
}

function parseArgs(argv) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const providerArgs = [];
  const tags = [];
  const scenarioIds = [];
  let runs = 1;
  let edition = 'CE';
  let outputDir = path.join(process.cwd(), 'reports', 'promptfoo-generation', timestamp);
  let limit;
  let variantLabel = 'default';
  let plannerMode = 'default';
  let softReview = false;
  let configOnly = false;
  let ci = false;
  let openReport = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--provider' && next) {
      providerArgs.push(...parseListArg(next));
      index += 1;
      continue;
    }
    if (arg === '--tag' && next) {
      tags.push(...parseListArg(next));
      index += 1;
      continue;
    }
    if (arg === '--scenario' && next) {
      scenarioIds.push(...parseListArg(next));
      index += 1;
      continue;
    }
    if (arg === '--runs' && next) {
      runs = parsePositiveInteger(next, '--runs');
      index += 1;
      continue;
    }
    if (arg === '--edition' && next) {
      const normalized = next.toUpperCase();
      if (normalized !== 'CE' && normalized !== 'HOSTED') {
        throw new Error(`--edition must be CE or HOSTED. Received: ${next}`);
      }
      edition = normalized;
      index += 1;
      continue;
    }
    if (arg === '--output-dir' && next) {
      outputDir = path.isAbsolute(next) ? next : path.join(process.cwd(), next);
      index += 1;
      continue;
    }
    if (arg === '--limit' && next) {
      limit = parsePositiveInteger(next, '--limit');
      index += 1;
      continue;
    }
    if (arg === '--variant-label' && next) {
      variantLabel = next.trim() || 'default';
      index += 1;
      continue;
    }
    if (arg === '--planner' && next) {
      if (next !== 'default' && next !== 'enabled' && next !== 'disabled') {
        throw new Error(`--planner must be default, enabled, or disabled. Received: ${next}`);
      }
      plannerMode = next;
      index += 1;
      continue;
    }
    if (arg === '--soft-review') {
      softReview = true;
      continue;
    }
    if (arg === '--config-only') {
      configOnly = true;
      continue;
    }
    if (arg === '--ci') {
      ci = true;
      continue;
    }
    if (arg === '--open') {
      openReport = true;
    }
  }

  return {
    providers: expandProviders(providerArgs.length > 0 ? providerArgs : ['mock']),
    runs,
    edition,
    outputDir,
    scenarioIds,
    tags,
    limit,
    variantLabel,
    plannerMode,
    softReview,
    configOnly,
    ci,
    openReport,
  };
}

function providerAvailability() {
  const useVertexAi = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini:
      Boolean(process.env.GEMINI_API_KEY) ||
      (useVertexAi &&
        Boolean(process.env.GOOGLE_CLOUD_PROJECT) &&
        Boolean(process.env.GOOGLE_CLOUD_LOCATION)),
  };
}

function loadBridgeData(options) {
  const code = `
    const options = JSON.parse(process.env.PROMPTFOO_GENERATION_OPTIONS_JSON);
    const availability = JSON.parse(process.env.PROMPTFOO_GENERATION_AVAILABILITY_JSON);
    const bridge = await import('@workout-agent/shared');
    const scenarios = bridge.selectPromptfooGenerationScenarios(options);
    const tests = bridge.buildPromptfooGenerationTestCases(options);
    const preflight = bridge.buildPromptfooGenerationPreflightSummary({
      scenarios,
      providers: options.providers,
      runs: options.runs,
      edition: options.edition,
      providerAvailability: availability,
    });
    process.stdout.write(JSON.stringify({
      scenarios: scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        tags: scenario.tags,
        mode: scenario.mode,
      })),
      tests,
      preflight,
    }));
  `;
  const result = spawnSync(
    process.execPath,
    [
      '--conditions=@workout-agent-ce/source',
      '--loader',
      'ts-node/esm',
      '--experimental-specifier-resolution=node',
      '--input-type=module',
      '--eval',
      code,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PROMPTFOO_GENERATION_OPTIONS_JSON: JSON.stringify(options),
        PROMPTFOO_GENERATION_AVAILABILITY_JSON: JSON.stringify(providerAvailability()),
      },
      encoding: 'utf8',
      shell: false,
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to load Promptfoo generation bridge data.');
  }

  return JSON.parse(result.stdout);
}

function buildSoftReviewAssertions() {
  const rubricVersion = 'promptfoo-workout-soft-review-v1';
  return [
    {
      type: 'llm-rubric',
      metric: 'Soft Clarity',
      value:
        'Score whether the workout is clear, easy to follow, and has understandable exercise prescriptions. Return a strict assessment.',
    },
    {
      type: 'llm-rubric',
      metric: 'Soft Plausibility',
      value:
        'Score whether the workout is physically plausible for the scenario, duration, equipment, and user experience level.',
    },
    {
      type: 'llm-rubric',
      metric: 'Soft Novelty',
      value:
        'Score whether the workout avoids generic sameness and, for regeneration cases, feels meaningfully fresh.',
    },
    {
      type: 'llm-rubric',
      metric: 'Soft Appeal',
      value:
        'Score whether the workout feels motivating and useful enough that a user would want to do it.',
    },
    {
      type: 'llm-rubric',
      metric: 'Soft Goal Fit',
      value:
        'Score whether the workout fits the scenario goal, focus, recent history, upcoming events, and constraints.',
    },
    {
      type: 'javascript',
      metric: 'Soft Rubric Version',
      value: `() => ({ pass: true, score: 1, reason: '${rubricVersion}' })`,
      weight: 0,
    },
  ];
}

function buildPromptfooConfig(options, outputDir, tests) {
  const providerPath = path.join(
    process.cwd(),
    'tools',
    'promptfoo',
    'generation',
    'generation-provider.mjs',
  );
  const assertPath = path.join(
    process.cwd(),
    'tools',
    'promptfoo',
    'generation',
    'assert-domain-hard-checks.cjs',
  );
  const testCases = tests.map((test) => ({
    ...test,
    assert: [
      {
        type: 'javascript',
        value: pathToFileURL(assertPath).href,
        metric: 'Domain Hard Checks',
      },
      ...(options.softReview ? buildSoftReviewAssertions() : []),
    ],
  }));

  return {
    description: 'Workout generation evaluation via Promptfoo wrapper',
    prompts: ['{{scenarioId}}'],
    providers: [
      {
        id: pathToFileURL(providerPath).href,
        label: 'workout-generation-evaluation',
        config: {
          outputRoot: path.relative(process.cwd(), path.join(outputDir, 'provider-calls')),
        },
      },
    ],
    defaultTest: {
      metadata: {
        rubricVersion: 'promptfoo-workout-generation-v1',
        softReviewEnabled: options.softReview,
      },
    },
    tests: testCases,
    outputPath: path.join(outputDir, 'promptfoo-output.json'),
  };
}

function parsePromptfooFailures(outputPath) {
  if (!existsSync(outputPath)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(outputPath, 'utf8'));
  const failures = parsed.results?.stats?.failures ?? 0;
  const errors = parsed.results?.stats?.errors ?? 0;
  return { failures, errors };
}

async function main() {
  const loadedEnvFiles = loadRepoEnv();
  const options = parseArgs(process.argv.slice(2));
  const bridgeData = loadBridgeData(options);

  await mkdir(options.outputDir, { recursive: true });
  const configPath = path.join(options.outputDir, 'promptfooconfig.json');
  const summaryPath = path.join(options.outputDir, 'summary.json');
  const outputJsonPath = path.join(options.outputDir, 'promptfoo-output.json');
  const reportHtmlPath = path.join(options.outputDir, 'report.html');
  const junitPath = path.join(options.outputDir, 'promptfoo.junit.xml');
  const config = buildPromptfooConfig(options, options.outputDir, bridgeData.tests);

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await writeFile(
    summaryPath,
    `${JSON.stringify(
      {
        options,
        selectedScenarioCount: bridgeData.scenarios.length,
        selectedScenarios: bridgeData.scenarios,
        providers: options.providers,
        preflight: bridgeData.preflight,
        loadedEnvFiles,
        artifacts: {
          config: configPath,
          outputJson: outputJsonPath,
          reportHtml: reportHtmlPath,
          junit: junitPath,
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`Promptfoo config: ${configPath}`);
  console.log(`Promptfoo summary: ${summaryPath}`);
  if (loadedEnvFiles.length > 0) {
    console.log(`Loaded env files: ${loadedEnvFiles.join(', ')}`);
  }
  bridgeData.preflight.warnings.forEach((warning) => console.log(`Warning: ${warning}`));

  if (options.configOnly) {
    return;
  }

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    command,
    [
      'promptfoo@latest',
      'eval',
      '-c',
      configPath,
      '-o',
      outputJsonPath,
      '-o',
      reportHtmlPath,
      '-o',
      junitPath,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: false,
    },
  );

  if (options.openReport && process.platform === 'darwin' && existsSync(reportHtmlPath)) {
    spawnSync('open', [reportHtmlPath], { stdio: 'ignore', shell: false });
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (options.ci) {
    const stats = parsePromptfooFailures(outputJsonPath);
    if (stats && (stats.failures > 0 || stats.errors > 0)) {
      throw new Error(
        `Promptfoo CI gate failed: ${stats.failures} failures, ${stats.errors} errors.`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
