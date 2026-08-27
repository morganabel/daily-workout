import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROMPTFOO_TEST_FAILURE_EXIT_CODE = 100;

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
  --provider <value>        fixture | openai | gemini | openrouter | live | all (repeatable)
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
  --open                    open the comparison report after generation (macOS)
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
        return ['openai', 'gemini', 'openrouter'];
      case 'live':
        return ['openai', 'gemini', 'openrouter'];
      case 'fixture':
      case 'openai':
      case 'gemini':
      case 'openrouter':
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
  let outputDir = path.join(
    process.cwd(),
    'reports',
    'promptfoo-generation',
    timestamp
  );
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
        throw new Error(
          `--planner must be default, enabled, or disabled. Received: ${next}`
        );
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
    providers: expandProviders(
      providerArgs.length > 0 ? providerArgs : ['openai']
    ),
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
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
  };
}

function loadBridgeData(options) {
  const code = `
    const options = JSON.parse(process.env.PROMPTFOO_GENERATION_OPTIONS_JSON);
    const availability = JSON.parse(process.env.PROMPTFOO_GENERATION_AVAILABILITY_JSON);
    const bridge = await import('@leveza/shared');
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
      '--conditions=@leveza/source',
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
        PROMPTFOO_GENERATION_AVAILABILITY_JSON: JSON.stringify(
          providerAvailability()
        ),
      },
      encoding: 'utf8',
      shell: false,
    }
  );

  if (result.status !== 0) {
    throw new Error(
      result.stderr ||
        result.stdout ||
        'Failed to load Promptfoo generation bridge data.'
    );
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
    'generation-provider.mjs'
  );
  const assertPath = path.join(
    process.cwd(),
    'tools',
    'promptfoo',
    'generation',
    'assert-domain-hard-checks.cjs'
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
          outputRoot: path.relative(
            process.cwd(),
            path.join(outputDir, 'provider-calls')
          ),
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

function reportUrl(reportPath) {
  return pathToFileURL(reportPath).href;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeMarkdownTable(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function findFiles(rootDir, fileName) {
  if (!existsSync(rootDir)) {
    return [];
  }

  return readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      return findFiles(entryPath, fileName);
    }
    return entry.name === fileName ? [entryPath] : [];
  });
}

function hardFailureNames(entry) {
  return (entry.hardChecks ?? [])
    .filter((check) => check.status === 'fail')
    .map((check) => check.name);
}

function summarizeExercises(plan) {
  return (plan?.blocks ?? []).flatMap((block) =>
    (block.exercises ?? []).map((exercise) => ({
      blockTitle: block.title,
      name: exercise.name,
      prescription: exercise.prescription,
    }))
  );
}

function readPromptfooStats(outputJsonPath) {
  if (!existsSync(outputJsonPath)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(outputJsonPath, 'utf8'));
  return parsed.results?.stats ?? null;
}

function readComparisonRows(outputDir) {
  const providerReportsDir = path.join(outputDir, 'provider-calls');

  return findFiles(providerReportsDir, 'report.json')
    .flatMap((reportJsonPath) => {
      const report = JSON.parse(readFileSync(reportJsonPath, 'utf8'));
      return (report.entries ?? []).map((entry) => {
        const reportDir = path.dirname(reportJsonPath);
        const detailHtmlPath = path.join(reportDir, 'report.html');
        const exercises = summarizeExercises(entry.plan);
        const failures = hardFailureNames(entry);

        return {
          scenarioId: entry.scenarioId,
          scenarioTitle: entry.scenarioTitle,
          scenarioMode: entry.scenarioMode,
          provider: entry.provider,
          executionSource: entry.executionSource,
          status: entry.status,
          runId: entry.runId,
          pass: entry.status === 'success' && failures.length === 0,
          failures,
          latencyMs: entry.latencyMs?.totalRequestMs,
          requestCostNanoUsd: entry.costSummary?.accountedCostNanoUsd ?? '0',
          setupCostNanoUsd: entry.setupCostSummary?.accountedCostNanoUsd ?? '0',
          totalTokens:
            (entry.costSummary?.totalTokens ?? 0) +
            (entry.setupCostSummary?.totalTokens ?? 0),
          unknownCostCallCount:
            (entry.costSummary?.unknownCostCallCount ?? 0) +
            (entry.setupCostSummary?.unknownCostCallCount ?? 0),
          plannerUsed: Boolean(entry.plannerSummary?.usedStageOne),
          summary:
            entry.plan?.summary ??
            entry.errorMessage ??
            'No plan summary available.',
          durationMinutes: entry.plan?.durationMinutes,
          focus: entry.plan?.focus,
          equipment: entry.plan?.equipment ?? [],
          exercises,
          detailHtmlPath: existsSync(detailHtmlPath)
            ? detailHtmlPath
            : undefined,
        };
      });
    })
    .sort(
      (a, b) =>
        a.scenarioId.localeCompare(b.scenarioId) ||
        a.provider.localeCompare(b.provider) ||
        a.runId.localeCompare(b.runId)
    );
}

function average(values) {
  const numeric = values.filter((value) => typeof value === 'number');
  if (numeric.length === 0) {
    return undefined;
  }
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function buildProviderSummaries(rows) {
  const providers = [...new Set(rows.map((row) => row.provider))].sort();

  return providers.map((provider) => {
    const providerRows = rows.filter((row) => row.provider === provider);
    const failedRows = providerRows.filter((row) => !row.pass);
    return {
      provider,
      entries: providerRows.length,
      cleanEntries: providerRows.length - failedRows.length,
      failedEntries: failedRows.length,
      avgLatencyMs: average(providerRows.map((row) => row.latencyMs)),
      totalCostNanoUsd: providerRows
        .reduce(
          (sum, row) =>
            sum + BigInt(row.requestCostNanoUsd) + BigInt(row.setupCostNanoUsd),
          0n
        )
        .toString(),
      totalTokens: providerRows.reduce((sum, row) => sum + row.totalTokens, 0),
      hardFailures: [
        ...new Set(providerRows.flatMap((row) => row.failures)),
      ].sort(),
    };
  });
}

function formatMs(value) {
  return typeof value === 'number' ? `${Math.round(value)} ms` : 'n/a';
}

function formatCost(value) {
  return `$${(Number(BigInt(value)) / 1_000_000_000).toFixed(6)}`;
}

function formatPass(row) {
  if (row.pass) {
    return 'Pass';
  }
  if (row.failures.length > 0) {
    return `Fail: ${row.failures.join(', ')}`;
  }
  return `Fail: ${row.status}`;
}

function formatExerciseSummary(row) {
  if (row.exercises.length === 0) {
    return 'No exercises captured.';
  }

  const shown = row.exercises
    .slice(0, 6)
    .map(
      (exercise) =>
        `${exercise.name}${
          exercise.prescription ? ` (${exercise.prescription})` : ''
        }`
    );
  const suffix =
    row.exercises.length > shown.length
      ? `; +${row.exercises.length - shown.length} more`
      : '';
  return `${shown.join('; ')}${suffix}`;
}

function renderComparisonMarkdown(params) {
  const providerSummaries = buildProviderSummaries(params.rows);
  const promptfooStats = params.promptfooStats;
  const cleanEntries = params.rows.filter((row) => row.pass).length;

  const lines = [
    '# Workout Generation Comparison',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Variant: ${params.options.variantLabel}`,
    `Planner mode: ${params.options.plannerMode}`,
    '',
    'This is the repo-specific summary. Use the raw Promptfoo report only when you need the generic eval table or CI/JUnit details.',
    '',
    '## At a Glance',
    '',
    `- Provider-call entries: ${params.rows.length}`,
    `- Clean entries: ${cleanEntries}`,
    `- Entries with failures: ${params.rows.length - cleanEntries}`,
    `- Promptfoo pass/fail: ${
      promptfooStats
        ? `${promptfooStats.successes ?? 0} passed, ${
            promptfooStats.failures ?? 0
          } failed, ${promptfooStats.errors ?? 0} errors`
        : 'n/a'
    }`,
    `- Raw Promptfoo report: [report.html](${reportUrl(
      params.promptfooReportHtmlPath
    )})`,
    '',
    '## Provider Summary',
    '',
    '| Provider | Clean / Total | Avg Latency | All-in Cost | Tokens | Hard Failures |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...providerSummaries
      .map((summary) =>
        [
          summary.provider,
          `${summary.cleanEntries} / ${summary.entries}`,
          formatMs(summary.avgLatencyMs),
          formatCost(summary.totalCostNanoUsd),
          summary.totalTokens,
          summary.hardFailures.length > 0
            ? summary.hardFailures.join(', ')
            : 'none',
        ]
          .map(escapeMarkdownTable)
          .join(' | ')
      )
      .map((line) => `| ${line} |`),
    '',
    '## Scenario Results',
    '',
    '| Scenario | Provider | Source | Result | Latency | Cost | Tokens | Workout Summary | Exercises | Detail |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |',
    ...params.rows
      .map((row) =>
        [
          row.scenarioId,
          row.provider,
          row.executionSource,
          formatPass(row),
          formatMs(row.latencyMs),
          formatCost(
            (
              BigInt(row.requestCostNanoUsd) + BigInt(row.setupCostNanoUsd)
            ).toString()
          ),
          row.totalTokens,
          row.summary,
          formatExerciseSummary(row),
          row.detailHtmlPath
            ? `[canonical report](${reportUrl(row.detailHtmlPath)})`
            : 'n/a',
        ]
          .map(escapeMarkdownTable)
          .join(' | ')
      )
      .map((line) => `| ${line} |`),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function renderComparisonHtml(params) {
  const providerSummaries = buildProviderSummaries(params.rows);
  const promptfooStats = params.promptfooStats;
  const cleanEntries = params.rows.filter((row) => row.pass).length;

  const providerRows = providerSummaries
    .map(
      (summary) => `<tr>
        <td>${escapeHtml(summary.provider)}</td>
        <td>${summary.cleanEntries} / ${summary.entries}</td>
        <td>${escapeHtml(formatMs(summary.avgLatencyMs))}</td>
        <td>${escapeHtml(formatCost(summary.totalCostNanoUsd))}</td>
        <td>${summary.totalTokens}</td>
        <td>${escapeHtml(
          summary.hardFailures.length > 0
            ? summary.hardFailures.join(', ')
            : 'none'
        )}</td>
      </tr>`
    )
    .join('\n');

  const scenarioRows = params.rows
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.scenarioId)}</strong><div>${escapeHtml(
        row.scenarioTitle
      )}</div></td>
        <td>${escapeHtml(row.provider)}</td>
        <td>${escapeHtml(row.executionSource)}</td>
        <td><span class="${row.pass ? 'pass' : 'fail'}">${escapeHtml(
        formatPass(row)
      )}</span></td>
        <td>${escapeHtml(formatMs(row.latencyMs))}</td>
        <td>${escapeHtml(
          formatCost(
            (
              BigInt(row.requestCostNanoUsd) + BigInt(row.setupCostNanoUsd)
            ).toString()
          )
        )}</td>
        <td>${row.totalTokens}</td>
        <td>${escapeHtml(row.summary)}</td>
        <td>${escapeHtml(formatExerciseSummary(row))}</td>
        <td>${
          row.detailHtmlPath
            ? `<a href="${reportUrl(row.detailHtmlPath)}">canonical report</a>`
            : 'n/a'
        }</td>
      </tr>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Workout Generation Comparison</title>
  <style>
    body { margin: 0; font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f8fafc; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 48px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin-top: 28px; font-size: 18px; }
    .muted { color: #64748b; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 20px 0; }
    .stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .stat strong { display: block; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
    th { background: #eef2f7; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #475569; }
    tr:last-child td { border-bottom: 0; }
    a { color: #0369a1; }
    .pass { color: #047857; font-weight: 700; }
    .fail { color: #b91c1c; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>Workout Generation Comparison</h1>
    <p class="muted">Generated ${escapeHtml(
      new Date().toISOString()
    )} · Variant ${escapeHtml(
    params.options.variantLabel
  )} · Planner ${escapeHtml(params.options.plannerMode)}</p>
    <p>This is the repo-specific summary. Use the raw <a href="${reportUrl(
      params.promptfooReportHtmlPath
    )}">Promptfoo report</a> only when you need the generic eval table or CI/JUnit details.</p>

    <section class="stats">
      <div class="stat"><strong>${
        params.rows.length
      }</strong><span>Provider-call entries</span></div>
      <div class="stat"><strong>${cleanEntries}</strong><span>Clean entries</span></div>
      <div class="stat"><strong>${
        params.rows.length - cleanEntries
      }</strong><span>Entries with failures</span></div>
      <div class="stat"><strong>${escapeHtml(
        formatCost(
          params.rows
            .reduce(
              (sum, row) =>
                sum +
                BigInt(row.requestCostNanoUsd) +
                BigInt(row.setupCostNanoUsd),
              0n
            )
            .toString()
        )
      )}</strong><span>All-in evaluation spend</span></div>
      <div class="stat"><strong>${
        promptfooStats
          ? `${promptfooStats.successes ?? 0}/${
              (promptfooStats.successes ?? 0) +
              (promptfooStats.failures ?? 0) +
              (promptfooStats.errors ?? 0)
            }`
          : 'n/a'
      }</strong><span>Promptfoo pass count</span></div>
    </section>

    <h2>Provider Summary</h2>
    <table>
      <thead><tr><th>Provider</th><th>Clean / Total</th><th>Avg Latency</th><th>All-in Cost</th><th>Tokens</th><th>Hard Failures</th></tr></thead>
      <tbody>${providerRows}</tbody>
    </table>

    <h2>Scenario Results</h2>
    <table>
      <thead><tr><th>Scenario</th><th>Provider</th><th>Source</th><th>Result</th><th>Latency</th><th>Cost</th><th>Tokens</th><th>Workout Summary</th><th>Exercises</th><th>Detail</th></tr></thead>
      <tbody>${scenarioRows}</tbody>
    </table>
  </main>
</body>
</html>
`;
}

async function writeComparisonArtifacts(params) {
  const rows = readComparisonRows(params.outputDir);
  if (rows.length === 0) {
    return null;
  }

  const artifacts = {
    markdown: path.join(params.outputDir, 'comparison.md'),
    html: path.join(params.outputDir, 'comparison.html'),
  };
  const comparisonParams = {
    rows,
    options: params.options,
    promptfooStats: readPromptfooStats(params.outputJsonPath),
    promptfooReportHtmlPath: params.promptfooReportHtmlPath,
  };

  await writeFile(
    artifacts.markdown,
    renderComparisonMarkdown(comparisonParams),
    'utf8'
  );
  await writeFile(
    artifacts.html,
    renderComparisonHtml(comparisonParams),
    'utf8'
  );

  return artifacts;
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
  const comparisonMarkdownPath = path.join(options.outputDir, 'comparison.md');
  const comparisonHtmlPath = path.join(options.outputDir, 'comparison.html');
  const junitPath = path.join(options.outputDir, 'promptfoo.junit.xml');
  const config = buildPromptfooConfig(
    options,
    options.outputDir,
    bridgeData.tests
  );

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
          reportHtmlUrl: reportUrl(reportHtmlPath),
          comparisonMarkdown: comparisonMarkdownPath,
          comparisonHtml: comparisonHtmlPath,
          comparisonHtmlUrl: reportUrl(comparisonHtmlPath),
          junit: junitPath,
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log(`Promptfoo config: ${configPath}`);
  console.log(`Promptfoo summary: ${summaryPath}`);
  console.log(`Promptfoo HTML report: ${reportHtmlPath}`);
  console.log(`Promptfoo HTML report URL: ${reportUrl(reportHtmlPath)}`);
  if (loadedEnvFiles.length > 0) {
    console.log(`Loaded env files: ${loadedEnvFiles.join(', ')}`);
  }
  bridgeData.preflight.warnings.forEach((warning) =>
    console.log(`Warning: ${warning}`)
  );

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
    }
  );
  const promptfooExitedForTestFailures =
    result.status === PROMPTFOO_TEST_FAILURE_EXIT_CODE;
  const promptfooRuntimeFailed =
    result.status !== 0 && !promptfooExitedForTestFailures;

  const comparisonArtifacts = await writeComparisonArtifacts({
    outputDir: options.outputDir,
    outputJsonPath,
    promptfooReportHtmlPath: reportHtmlPath,
    options,
  });

  const openPath = comparisonArtifacts?.html ?? reportHtmlPath;
  if (
    options.openReport &&
    process.platform === 'darwin' &&
    existsSync(openPath)
  ) {
    spawnSync('open', [openPath], { stdio: 'ignore', shell: false });
  }

  if (existsSync(reportHtmlPath)) {
    console.log(`Promptfoo HTML report ready: ${reportHtmlPath}`);
    console.log(`Promptfoo HTML report URL: ${reportUrl(reportHtmlPath)}`);
  }
  if (comparisonArtifacts) {
    console.log(
      `Workout comparison summary ready: ${comparisonArtifacts.html}`
    );
    console.log(
      `Workout comparison summary URL: ${reportUrl(comparisonArtifacts.html)}`
    );
    console.log(`Workout comparison markdown: ${comparisonArtifacts.markdown}`);
  }

  if (promptfooExitedForTestFailures && !options.ci) {
    console.log(
      'Promptfoo reported failed tests; continuing because --ci was not set.'
    );
  }

  if (promptfooRuntimeFailed) {
    process.exit(result.status ?? 1);
  }

  if (options.ci) {
    const stats = parsePromptfooFailures(outputJsonPath);
    if (stats && (stats.failures > 0 || stats.errors > 0)) {
      throw new Error(
        `Promptfoo CI gate failed: ${stats.failures} failures, ${stats.errors} errors.`
      );
    }
    if (promptfooExitedForTestFailures) {
      process.exit(PROMPTFOO_TEST_FAILURE_EXIT_CODE);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
