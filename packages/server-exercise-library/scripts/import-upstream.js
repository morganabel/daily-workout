import { ensureDirectories, paths, writeJson } from './_common.js';

const UPSTREAM_REPO = 'yuhonas/free-exercise-db';
const USER_AGENT = 'workout-agent-ce-exercise-library-importer';

function reduceExercise(exercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    force: exercise.force ?? null,
    level: exercise.level,
    mechanic: exercise.mechanic ?? null,
    equipment: exercise.equipment ?? null,
    primaryMuscles: exercise.primaryMuscles ?? [],
    secondaryMuscles: exercise.secondaryMuscles ?? [],
    instructions: exercise.instructions ?? [],
    category: exercise.category,
  };
}

const [commitResponse, exerciseResponse] = await Promise.all([
  fetch(`https://api.github.com/repos/${UPSTREAM_REPO}/commits/main`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': USER_AGENT,
    },
  }),
  fetch(
    `https://raw.githubusercontent.com/${UPSTREAM_REPO}/main/dist/exercises.json`,
  ),
]);

if (!commitResponse.ok) {
  throw new Error(
    `Failed to fetch upstream commit metadata: ${commitResponse.status}`,
  );
}

if (!exerciseResponse.ok) {
  throw new Error(
    `Failed to fetch upstream exercise dataset: ${exerciseResponse.status}`,
  );
}

const commitPayload = await commitResponse.json();
const exercises = await exerciseResponse.json();
const reduced = exercises.map(reduceExercise);

await ensureDirectories();
await writeJson(paths.sourceSnapshot, reduced);
await writeJson(paths.sourceManifest, {
  source: 'free-exercise-db',
  repository: `https://github.com/${UPSTREAM_REPO}`,
  license: 'Unlicense',
  upstreamCommit: commitPayload.sha,
  upstreamFetchedAt: new Date().toISOString(),
  recordCount: reduced.length,
  retainedFields: [
    'id',
    'name',
    'force',
    'level',
    'mechanic',
    'equipment',
    'primaryMuscles',
    'secondaryMuscles',
    'instructions',
    'category',
  ],
  excludedFields: ['images'],
});

console.log(
  `Imported ${reduced.length} exercises from ${UPSTREAM_REPO}@${commitPayload.sha}`,
);
