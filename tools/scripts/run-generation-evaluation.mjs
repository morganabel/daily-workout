import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

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
  };
}

function printHelp() {
  console.log(`
Run workout generation evaluation scenarios.

Usage:
  npm run evaluate:generation -- [options]

Options:
  --provider <value>     openai | gemini | mock | live | all (repeatable)
  --runs <number>        repeated runs per scenario/provider (default: 1)
  --tag <value>          filter scenarios by tag (repeatable)
  --scenario <id>        run only selected scenario id (repeatable)
  --limit <number>       cap total scenarios after filtering
  --edition <value>      CE | HOSTED (default: CE)
  --output-dir <path>    output directory (default: reports/generation-evaluation/<timestamp>)
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
  let outputDir = path.join(
    process.cwd(),
    'reports',
    'generation-evaluation',
    timestamp
  );
  let limit;
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
      runs = Number.parseInt(next, 10);
      index += 1;
      continue;
    }
    if (arg === '--edition' && next) {
      edition = next.toUpperCase();
      index += 1;
      continue;
    }
    if (arg === '--output-dir' && next) {
      outputDir = path.isAbsolute(next) ? next : path.join(process.cwd(), next);
      index += 1;
      continue;
    }
    if (arg === '--limit' && next) {
      limit = Number.parseInt(next, 10);
      index += 1;
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
    openReport,
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
      edition: options.edition,
      outputDir: options.outputDir,
      scenarioIds: options.scenarioIds,
      tags: options.tags,
      limit: options.limit,
    }),
  };

  const command = './node_modules/.bin/nx';
  const args = [
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
    `Provider access: openai=${availability.openai} gemini=${availability.gemini}`
  );

  if (summary.warnings.length > 0) {
    console.log('Warnings:');
    summary.warnings.forEach((warning) => console.log(`- ${warning}`));
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
