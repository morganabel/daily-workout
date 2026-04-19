import { ensureDirectories, paths, readJson, writeJson } from './_common.js';

function countBy(records, keySelector) {
  const counts = new Map();

  for (const record of records) {
    const key = keySelector(record) ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function applyOverride(exercise, override) {
  if (!override) {
    return exercise;
  }

  const next = {
    ...exercise,
    ...override,
  };

  if (
    Object.keys(override).length > 0 &&
    !Object.prototype.hasOwnProperty.call(override, 'promotionSource')
  ) {
    next.promotionSource = 'override';
  }

  return next;
}

function getPrimarySource(exercise) {
  return (
    exercise.sourceRefs[0]?.source ??
    (exercise.id.startsWith('fedb:') ? 'free-exercise-db' : 'public-seed')
  );
}

function buildReadinessReport(canonical) {
  const plannerReady = canonical.filter(
    (exercise) => exercise.metadataCompleteness === 'planner-ready',
  );
  const blockerCounts = new Map();

  for (const exercise of canonical) {
    for (const blocker of exercise.promotionBlockers ?? []) {
      blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1);
    }
  }

  return {
    totalExercises: canonical.length,
    plannerReadyCount: plannerReady.length,
    autoPromotedCount: canonical.filter(
      (exercise) => exercise.promotionSource === 'template-auto',
    ).length,
    countsByCompleteness: countBy(
      canonical,
      (exercise) => exercise.metadataCompleteness,
    ),
    countsByRiskTier: countBy(canonical, (exercise) => exercise.riskTier),
    countsByFamily: countBy(canonical, (exercise) => exercise.familyKey),
    countsBySource: countBy(canonical, getPrimarySource),
    blockerCounts: Object.fromEntries(
      [...blockerCounts.entries()].sort((a, b) => b[1] - a[1]),
    ),
  };
}

await ensureDirectories();

const [publicCanonical, publicManifest, overrides] = await Promise.all([
  readJson(paths.publicCanonical),
  readJson(paths.publicManifest),
  readJson(paths.overrides),
]);

const canonical = publicCanonical
  .map((exercise) => applyOverride(exercise, overrides[exercise.id]))
  .sort(
    (left, right) =>
      left.sortKey - right.sortKey || left.id.localeCompare(right.id),
  );
const plannerReadyCount = canonical.filter(
  (exercise) => exercise.metadataCompleteness === 'planner-ready',
).length;
const manifest = {
  ...publicManifest,
  exerciseCount: canonical.length,
  plannerReadyCount,
};
const readinessReport = buildReadinessReport(canonical);

await Promise.all([
  writeJson(paths.generatedCanonical, canonical),
  writeJson(paths.generatedManifest, manifest),
  writeJson(paths.generatedReadinessReport, readinessReport),
]);

console.log(
  `Built canonical exercise dataset with ${canonical.length} records (${plannerReadyCount} planner-ready)`,
);
