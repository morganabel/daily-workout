import { createProjectGraphAsync } from '@nx/devkit';

const applicationTargets = ['build', 'lint', 'test', 'typecheck'];
const e2eTargets = ['e2e', 'lint', 'typecheck'];
const libraryTargets = ['build', 'lint', 'test', 'typecheck'];
const buildOnlyLibraryTargets = ['build', 'lint', 'typecheck'];

const requiredTargets = new Map([
  ['@workout-agent-ce/mobile', applicationTargets],
  ['@workout-agent-ce/mobile-e2e', e2eTargets],
  ['@workout-agent-ce/server', applicationTargets],
  ['@workout-agent-ce/server-ai', libraryTargets],
  ['@workout-agent-ce/server-core', libraryTargets],
  ['@workout-agent-ce/server-e2e', e2eTargets],
  ['@workout-agent-ce/source', []],
  ['@workout-agent/shared', libraryTargets],
  ['metering', buildOnlyLibraryTargets],
  ['quotas', buildOnlyLibraryTargets],
  ['server-auth', libraryTargets],
  ['server-db', libraryTargets],
  ['server-exercise-library', libraryTargets],
]);

const graph = await createProjectGraphAsync();
const actualProjects = Object.keys(graph.nodes).sort();
const expectedProjects = [...requiredTargets.keys()].sort();
const failures = [];

for (const project of expectedProjects) {
  if (!graph.nodes[project]) {
    failures.push(`Missing expected Nx project: ${project}`);
  }
}

for (const project of actualProjects) {
  if (!requiredTargets.has(project)) {
    failures.push(
      `Nx project is not covered by the required-target matrix: ${project}`
    );
  }
}

for (const [project, targets] of requiredTargets) {
  const configuredTargets = graph.nodes[project]?.data.targets ?? {};
  for (const target of targets) {
    if (!configuredTargets[target]) {
      failures.push(
        `Nx project ${project} is missing required target: ${target}`
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Nx required-target validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Nx required-target validation passed for ${actualProjects.length} projects.`
);
