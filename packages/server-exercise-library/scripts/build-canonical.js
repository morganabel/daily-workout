import { ensureDirectories, paths, readJson, writeJson } from './_common.js';

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function toTitleCase(value) {
  return value.replace(/[A-Za-z0-9]+/g, (token) => {
    if (/^[A-Z0-9]+$/.test(token)) {
      return token;
    }

    return token[0].toUpperCase() + token.slice(1).toLowerCase();
  });
}

function normalizeDisplayName(value) {
  const trimmed = normalizeWhitespace(value);

  // Public-seed rows often arrive fully lowercase; title-casing them makes
  // the runtime library consistent without changing fedb-authored names.
  if (!/[A-Z]/.test(trimmed)) {
    return toTitleCase(trimmed);
  }

  return trimmed;
}

function countBy(records, keySelector) {
  const counts = new Map();

  for (const record of records) {
    const key = keySelector(record) ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function applyOverride(exercise, override) {
  const baseExercise = {
    ...exercise,
    name: normalizeDisplayName(exercise.name),
  };

  if (!override) {
    return baseExercise;
  }

  if (override._drop === true) {
    return null;
  }

  const { _drop: _ignoredDrop, ...overrideFields } = override;
  const next = {
    ...baseExercise,
    ...overrideFields,
  };

  next.name = normalizeDisplayName(next.name);

  if (
    Object.keys(overrideFields).length > 0 &&
    !Object.prototype.hasOwnProperty.call(overrideFields, 'promotionSource')
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
  .filter(Boolean)
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
