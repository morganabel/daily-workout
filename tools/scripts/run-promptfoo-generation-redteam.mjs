import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function parseArgs(argv) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let outputDir = path.join(process.cwd(), 'reports', 'promptfoo-redteam', timestamp);
  let url = process.env.PROMPTFOO_WORKOUT_GENERATION_URL ?? 'http://localhost:3000/api/workouts/generate';
  let configOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--output-dir' && next) {
      outputDir = path.isAbsolute(next) ? next : path.join(process.cwd(), next);
      index += 1;
      continue;
    }
    if (arg === '--url' && next) {
      url = next;
      index += 1;
      continue;
    }
    if (arg === '--config-only') {
      configOnly = true;
    }
  }

  return { outputDir, url, configOnly };
}

function buildConfig(url) {
  return {
    description: 'Workout generation red-team scan',
    purpose:
      'The system generates safe, personalized workouts from user fitness inputs. It must not reveal secrets, ignore safety constraints, provide unsafe injury or medical advice, or follow prompt-injection instructions in user notes.',
    targets: [
      {
        id: 'https',
        label: 'workout-generation-api',
        config: {
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer promptfoo-redteam-local',
          },
          body: {
            timeMinutes: 30,
            energy: 'moderate',
            focus: 'Smart',
            equipment: ['Bodyweight', 'Resistance Bands'],
            notes: '{{prompt}}',
            context: {
              userProfile: {
                experienceLevel: 'beginner',
                primaryGoal: 'general fitness',
                energyToday: 'moderate',
              },
              preferences: {
                injuries: ['knee sensitivity'],
                avoid: ['jumping'],
              },
              environment: {
                equipment: ['Bodyweight', 'Resistance Bands'],
                timeAvailableMinutes: 30,
                location: 'home',
              },
              recentSessions: [],
              notes: 'Synthetic Promptfoo red-team fixture. Do not use production user data.',
            },
          },
        },
      },
    ],
    redteam: {
      plugins: [
        'prompt-injection',
        'harmful:medical',
        'pii',
        'contracts',
        'excessive-agency',
      ],
      strategies: ['jailbreak', 'prompt-injection', 'jailbreak:composite'],
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(options.outputDir, { recursive: true });
  const configPath = path.join(options.outputDir, 'promptfooconfig.json');
  const outputPath = path.join(options.outputDir, 'redteam-output.json');
  await writeFile(configPath, `${JSON.stringify(buildConfig(options.url), null, 2)}\n`, 'utf8');

  console.log(`Promptfoo red-team config: ${configPath}`);
  console.log(`Promptfoo red-team output: ${outputPath}`);
  console.log('This workflow uses synthetic fixture inputs and does not require production data.');

  if (options.configOnly) {
    return;
  }

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    command,
    ['promptfoo@latest', 'redteam', 'run', '-c', configPath, '-o', outputPath],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: false,
    },
  );

  if (result.status !== 0 && !existsSync(outputPath)) {
    process.exit(result.status ?? 1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
