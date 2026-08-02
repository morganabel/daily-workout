import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 16;

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

function providerAvailability() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini:
      Boolean(process.env.GEMINI_API_KEY) ||
      (process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true' &&
        Boolean(process.env.GOOGLE_CLOUD_PROJECT) &&
        Boolean(process.env.GOOGLE_CLOUD_LOCATION)),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
  };
}

function printHelp() {
  console.log(`
Run workout generation evaluation scenarios.

Usage:
  npm run evaluate:generation -- [options]

Options:
  --provider <value>     openai | gemini | openrouter | fixture | live | all (repeatable)
  --runs <number>        repeated runs per scenario/provider (default: 1)
  --concurrency <number> maximum parallel evaluation rows (default: ${DEFAULT_CONCURRENCY}, max: ${MAX_CONCURRENCY})
  --tag <value>          filter scenarios by tag (repeatable)
  --scenario <id>        run only selected scenario id (repeatable)
  --limit <number>       cap total scenarios after filtering
  --edition <value>      CE | HOSTED (default: CE)
  --creation-mode <mode> auto | library | ai (override all scenario requests)
  --output-dir <path>    output directory (default: reports/generation-evaluation/<timestamp>)
  --timeout-ms <number>  Jest timeout for the evaluation run (default: 1800000)
  --open                 open the HTML report after generation (macOS)
  --help                 show this help message
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

function parseCreationMode(value) {
  if (value === 'auto' || value === 'library' || value === 'ai') {
    return value;
  }

  throw new Error(
    `--creation-mode must be auto, library, or ai. Received: ${value}`
  );
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
  let concurrency = DEFAULT_CONCURRENCY;
  let edition = 'CE';
  let outputDir = path.join(
    process.cwd(),
    'reports',
    'generation-evaluation',
    timestamp
  );
  let limit;
  let creationMode;
  let openReport = false;
  let timeoutMs = 1800000;

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
    if (arg === '--concurrency' && next) {
      concurrency = parsePositiveInteger(next, '--concurrency');
      if (concurrency > MAX_CONCURRENCY) {
        throw new Error(
          `--concurrency must be <= ${MAX_CONCURRENCY}. Received: ${next}`
        );
      }
      index += 1;
      continue;
    }
    if (arg === '--edition' && next) {
      edition = next.toUpperCase();
      index += 1;
      continue;
    }
    if (arg === '--creation-mode' && next) {
      creationMode = parseCreationMode(next);
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
    if (arg === '--timeout-ms' && next) {
      timeoutMs = parsePositiveInteger(next, '--timeout-ms');
      index += 1;
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
    concurrency,
    edition,
    outputDir,
    scenarioIds,
    tags,
    limit,
    creationMode,
    openReport,
    timeoutMs,
  };
}

function main() {
  const loadedEnvFiles = loadRepoEnv();
  const options = parseArgs(process.argv.slice(2));
  const availability = providerAvailability();
  const env = {
    ...process.env,
    GENERATION_EVAL_OPTIONS_JSON: JSON.stringify({
      providers: options.providers,
      runs: options.runs,
      concurrency: options.concurrency,
      edition: options.edition,
      outputDir: options.outputDir,
      scenarioIds: options.scenarioIds,
      tags: options.tags,
      limit: options.limit,
      creationMode: options.creationMode,
    }),
    GENERATION_EVAL_TIMEOUT_MS: String(options.timeoutMs),
  };

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = [
    'nx',
    'test',
    '@workout-agent-ce/server',
    '--testPathPatterns=src/lib/evaluation/run-generation-evaluation.spec.ts',
    '--runInBand',
    '--skipNxCache',
  ];

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const summaryPath = path.join(options.outputDir, 'summary.json');
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));

  console.log(`HTML report: ${summary.artifacts.html}`);
  console.log(`JSON report: ${summary.artifacts.json}`);
  console.log(`JSONL report: ${summary.artifacts.jsonl}`);
  console.log(`Markdown report: ${summary.artifacts.markdown}`);
  if (loadedEnvFiles.length > 0) {
    console.log(`Loaded env files: ${loadedEnvFiles.join(', ')}`);
  }
  console.log(
    `Provider access: openai=${availability.openai} gemini=${availability.gemini} openrouter=${availability.openrouter}`
  );

  if (summary.warnings.length > 0) {
    console.log('Warnings:');
    summary.warnings.forEach((warning) => console.log(`- ${warning}`));
  }
  if (summary.coverageNotes?.length > 0) {
    console.log('Coverage notes:');
    summary.coverageNotes.forEach((note) => console.log(`- ${note}`));
  }

  if (options.openReport && process.platform === 'darwin') {
    spawnSync('open', [summary.artifacts.html], {
      cwd: process.cwd(),
      stdio: 'ignore',
      shell: false,
    });
  }
}

main();
