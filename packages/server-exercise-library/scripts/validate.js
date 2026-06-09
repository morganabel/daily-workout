import Database from 'better-sqlite3';
import { paths, readJson } from './_common.js';

const legacySourceIdPattern = /^(wger:|fitnessshub:)/;
const legacySlugPattern = /^(wger-|fitnessshub-)/;
const legacySourcePattern = /\b(?:wger|fitnessshub)\b/i;
const forbiddenTitlePatterns = [
  { pattern: /\bhd\b/i, label: 'HD suffix' },
  { pattern: /\bv\.?\s*2\b/i, label: 'v2 suffix' },
  { pattern: /\b(?:male|female)\b/i, label: 'gender marker' },
  { pattern: /\bno leg drive\b/i, label: 'coaching cue variant' },
];

function normalizeDuplicateName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTokenOrderName(value) {
  return normalizeDuplicateName(value)
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

function normalizeSideBaseName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(left|right)\b/g, ' ')
    .replace(/\bleg\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const [canonical, manifest, readinessReport, enums, tags, equipment, workoutCatalog] =
  await Promise.all([
    readJson(paths.generatedCanonical),
    readJson(paths.generatedManifest),
    readJson(paths.generatedReadinessReport),
    readJson(paths.enumsVocab),
    readJson(paths.tagsVocab),
    readJson(paths.equipmentVocab),
    readJson(paths.systemWorkoutCatalog),
  ]);

const equipmentIds = new Set(equipment.items.map((entry) => entry.id));
const completenessValues = new Set(enums.metadataCompleteness);
const experienceLevels = new Set(enums.experienceLevels);
const impactLevels = new Set(enums.impactLevels);
const noiseLevels = new Set(enums.noiseLevels);
const spaceFootprints = new Set(enums.spaceFootprints);
const loadLevels = new Set(enums.loadLevels);
const roles = new Set(enums.exerciseRoles);

const allowedTags = {
  focusTags: new Set(tags.focusTags),
  movementTags: new Set(tags.movementTags),
  styleTags: new Set(tags.styleTags),
  stressorTags: new Set(tags.stressorTags),
  contraindicationTags: new Set(tags.contraindicationTags),
  avoidTags: new Set(tags.avoidTags),
};

const ids = new Set();
const sourceIds = new Set();
const duplicateGroups = new Map();
const tokenOrderDuplicateGroups = new Map();
const canonicalKeys = new Map();
const canonicalById = new Map();

for (const exercise of canonical) {
  if (ids.has(exercise.id)) {
    throw new Error(`Duplicate canonical id: ${exercise.id}`);
  }
  ids.add(exercise.id);
  canonicalById.set(exercise.id, exercise);

  if (legacySourceIdPattern.test(exercise.id)) {
    throw new Error(
      `Legacy source-prefixed exercise id leaked into public seed: ${exercise.id}`,
    );
  }

  if (sourceIds.has(exercise.sourceId)) {
    throw new Error(`Duplicate source id: ${exercise.sourceId}`);
  }
  sourceIds.add(exercise.sourceId);

  if (legacySourceIdPattern.test(exercise.sourceId)) {
    throw new Error(
      `Legacy source-prefixed sourceId leaked into public seed: ${exercise.sourceId}`,
    );
  }

  if (legacySlugPattern.test(exercise.slug)) {
    throw new Error(
      `Legacy source-prefixed slug leaked into public seed: ${exercise.slug}`,
    );
  }

  if (exercise.id.startsWith('ex:')) {
    if (exercise.sourceId !== exercise.id) {
      throw new Error(
        `Public exercise ${exercise.id} must reuse its opaque public id as sourceId`,
      );
    }

    if (exercise.sourceRefs.length > 0) {
      throw new Error(
        `Public exercise ${exercise.id} must not keep sourceRefs in the public seed`,
      );
    }
  }

  if (exercise.id.startsWith('fedb:')) {
    if (!exercise.sourceRefs.length) {
      throw new Error(
        `free-exercise-db exercise ${exercise.id} must retain explicit sourceRefs`,
      );
    }

    for (const sourceRef of exercise.sourceRefs) {
      if (sourceRef.source !== 'free-exercise-db') {
        throw new Error(
          `free-exercise-db exercise ${exercise.id} has unexpected source ref ${sourceRef.source}`,
        );
      }
    }
  }

  const duplicateKey = `${normalizeDuplicateName(exercise.name)}::${[...exercise.requiredEquipment].sort().join('|')}`;
  const duplicateGroup = duplicateGroups.get(duplicateKey) ?? [];
  duplicateGroup.push(exercise.id);
  duplicateGroups.set(duplicateKey, duplicateGroup);

  const tokenOrderDuplicateKey = `${normalizeTokenOrderName(exercise.name)}::${[...exercise.requiredEquipment].sort().join('|')}`;
  const tokenOrderDuplicateGroup =
    tokenOrderDuplicateGroups.get(tokenOrderDuplicateKey) ?? [];
  tokenOrderDuplicateGroup.push(exercise.id);
  tokenOrderDuplicateGroups.set(
    tokenOrderDuplicateKey,
    tokenOrderDuplicateGroup,
  );

  const canonicalKey = `${normalizeSideBaseName(exercise.name)}::${[...exercise.requiredEquipment].sort().join('|')}`;
  const canonicalMatches = canonicalKeys.get(canonicalKey) ?? [];
  canonicalMatches.push({ id: exercise.id, name: exercise.name });
  canonicalKeys.set(canonicalKey, canonicalMatches);

  if (/^[a-z]/.test(exercise.name)) {
    throw new Error(
      `Exercise ${exercise.id} must use consistent capitalization: ${exercise.name}`,
    );
  }

  for (const { pattern, label } of forbiddenTitlePatterns) {
    if (pattern.test(exercise.name)) {
      throw new Error(
        `Exercise ${exercise.id} contains forbidden ${label}: ${exercise.name}`,
      );
    }
  }

  for (const equipmentId of [
    ...exercise.requiredEquipment,
    ...exercise.optionalEquipment,
  ]) {
    if (!equipmentIds.has(equipmentId)) {
      throw new Error(`Unknown equipment id ${equipmentId} on ${exercise.id}`);
    }
  }

  if (!completenessValues.has(exercise.metadataCompleteness)) {
    throw new Error(
      `Unknown metadata completeness ${exercise.metadataCompleteness} on ${exercise.id}`,
    );
  }

  if (!experienceLevels.has(exercise.experienceLevelMin)) {
    throw new Error(
      `Unknown experience level ${exercise.experienceLevelMin} on ${exercise.id}`,
    );
  }

  if (!impactLevels.has(exercise.impactLevel)) {
    throw new Error(
      `Unknown impact level ${exercise.impactLevel} on ${exercise.id}`,
    );
  }

  if (!noiseLevels.has(exercise.noiseLevel)) {
    throw new Error(
      `Unknown noise level ${exercise.noiseLevel} on ${exercise.id}`,
    );
  }

  if (!spaceFootprints.has(exercise.spaceFootprint)) {
    throw new Error(
      `Unknown space footprint ${exercise.spaceFootprint} on ${exercise.id}`,
    );
  }

  if (!loadLevels.has(exercise.loadLevel)) {
    throw new Error(
      `Unknown load level ${exercise.loadLevel} on ${exercise.id}`,
    );
  }

  for (const role of exercise.allowedRoles) {
    if (!roles.has(role)) {
      throw new Error(`Unknown role ${role} on ${exercise.id}`);
    }
  }

  for (const [field, allowed] of Object.entries(allowedTags)) {
    for (const tag of exercise[field]) {
      if (!allowed.has(tag)) {
        throw new Error(`Unknown ${field} value ${tag} on ${exercise.id}`);
      }
    }
  }

  if (exercise.metadataCompleteness === 'planner-ready') {
    if (!exercise.description || !exercise.instructionSteps.length) {
      throw new Error(
        `Planner-ready exercise ${exercise.id} must keep text instructions`,
      );
    }

    if (!exercise.requiredEquipment.length) {
      throw new Error(
        `Planner-ready exercise ${exercise.id} must define required equipment`,
      );
    }

    if (
      !exercise.focusTags.length ||
      !exercise.movementTags.length ||
      !exercise.styleTags.length
    ) {
      throw new Error(
        `Planner-ready exercise ${exercise.id} is missing core tags`,
      );
    }

    if (!exercise.allowedRoles.length) {
      throw new Error(
        `Planner-ready exercise ${exercise.id} must define allowed roles`,
      );
    }
  }
}

for (const [duplicateKey, duplicateIds] of duplicateGroups.entries()) {
  if (duplicateIds.length > 1) {
    throw new Error(
      `Duplicate canonical exercise group detected for ${duplicateKey}: ${duplicateIds.join(', ')}`,
    );
  }
}

for (const [
  duplicateKey,
  duplicateIds,
] of tokenOrderDuplicateGroups.entries()) {
  if (duplicateIds.length > 1) {
    throw new Error(
      `Token-order duplicate exercise group detected for ${duplicateKey}: ${duplicateIds.join(', ')}`,
    );
  }
}

for (const [canonicalKey, exercisesForKey] of canonicalKeys.entries()) {
  const sideVariants = exercisesForKey.filter(({ name }) =>
    /\b(left|right)\b/i.test(name),
  );
  const baseVariants = exercisesForKey.filter(
    ({ name }) => !/\b(left|right)\b/i.test(name),
  );

  if (sideVariants.length > 0 && baseVariants.length > 0) {
    throw new Error(
      `Laterality-only duplicate group detected for ${canonicalKey}: ${exercisesForKey.map(({ id }) => id).join(', ')}`,
    );
  }
}

if (legacySourcePattern.test(manifest.sourceVersion)) {
  throw new Error(
    `Public manifest leaked a legacy crawled source in sourceVersion: ${manifest.sourceVersion}`,
  );
}

if (manifest.plannerReadyCount < 400) {
  throw new Error(
    `Expected at least 400 planner-ready exercises, found ${manifest.plannerReadyCount}`,
  );
}

if (readinessReport.plannerReadyCount !== manifest.plannerReadyCount) {
  throw new Error(
    'Planner-ready count mismatch between manifest and readiness report',
  );
}

if (readinessReport.autoPromotedCount < 330) {
  throw new Error(
    `Expected at least 330 auto-promoted exercises, found ${readinessReport.autoPromotedCount}`,
  );
}

if ((readinessReport.countsByRiskTier?.low ?? 0) < 400) {
  throw new Error(
    'Expected at least 400 low-risk classified exercises in readiness report',
  );
}

const workoutRecipeIds = new Set();
const workoutRecipeSlugs = new Set();
const workoutEnergyLevels = new Set(['easy', 'moderate', 'intense']);

if (workoutCatalog.schemaVersion !== 1) {
  throw new Error(
    `Unsupported workout catalog schema version: ${workoutCatalog.schemaVersion}`,
  );
}

if (!workoutCatalog.catalogVersion) {
  throw new Error('Workout catalog must declare catalogVersion');
}

if (
  !Array.isArray(workoutCatalog.recipes) ||
  workoutCatalog.recipes.length < 50
) {
  throw new Error('Workout catalog must contain at least 50 recipes');
}

for (const recipe of workoutCatalog.recipes) {
  if (workoutRecipeIds.has(recipe.id)) {
    throw new Error(`Duplicate workout recipe id: ${recipe.id}`);
  }
  workoutRecipeIds.add(recipe.id);

  if (workoutRecipeSlugs.has(recipe.slug)) {
    throw new Error(`Duplicate workout recipe slug: ${recipe.slug}`);
  }
  workoutRecipeSlugs.add(recipe.slug);

  if (recipe.ownership !== 'system') {
    throw new Error(`Workout recipe ${recipe.id} has unsupported ownership`);
  }

  if (recipe.status !== 'active') {
    throw new Error(`Workout recipe ${recipe.id} is not active`);
  }

  if (!experienceLevels.has(recipe.minExperienceLevel)) {
    throw new Error(
      `Workout recipe ${recipe.id} has unknown experience level ${recipe.minExperienceLevel}`,
    );
  }

  if (recipe.durationRange.min > recipe.durationMinutes) {
    throw new Error(
      `Workout recipe ${recipe.id} duration minimum exceeds target`,
    );
  }

  if (recipe.durationRange.max < recipe.durationMinutes) {
    throw new Error(
      `Workout recipe ${recipe.id} duration maximum is below target`,
    );
  }

  if (recipe.qualityScore < 0 || recipe.qualityScore > 100) {
    throw new Error(`Workout recipe ${recipe.id} qualityScore is out of range`);
  }

  for (const equipmentId of recipe.equipment) {
    if (!equipmentIds.has(equipmentId)) {
      throw new Error(
        `Workout recipe ${recipe.id} has unknown equipment ${equipmentId}`,
      );
    }
  }

  for (const energy of recipe.energyLevels) {
    if (!workoutEnergyLevels.has(energy)) {
      throw new Error(
        `Workout recipe ${recipe.id} has unknown energy level ${energy}`,
      );
    }
  }

  const recipeEquipmentIds = new Set(recipe.equipment);
  const blockDuration = recipe.blocks.reduce(
    (total, block) => total + block.durationMinutes,
    0,
  );
  if (blockDuration !== recipe.durationMinutes) {
    throw new Error(
      `Workout recipe ${recipe.id} block duration ${blockDuration} does not match target ${recipe.durationMinutes}`,
    );
  }

  const slotIds = new Set();
  for (const block of recipe.blocks) {
    if (!block.slots.length) {
      throw new Error(`Workout recipe ${recipe.id} block ${block.id} is empty`);
    }

    for (const slot of block.slots) {
      const slotKey = `${block.id}:${slot.id}`;
      if (slotIds.has(slotKey)) {
        throw new Error(
          `Workout recipe ${recipe.id} has duplicate slot ${slotKey}`,
        );
      }
      slotIds.add(slotKey);

      if (!roles.has(slot.role)) {
        throw new Error(
          `Workout recipe ${recipe.id} slot ${slot.id} has unknown role ${slot.role}`,
        );
      }

      const exercise = canonicalById.get(slot.exerciseId);
      if (!exercise) {
        throw new Error(
          `Workout recipe ${recipe.id} references unknown exercise ${slot.exerciseId}`,
        );
      }

      if (exercise.metadataCompleteness !== 'planner-ready') {
        throw new Error(
          `Workout recipe ${recipe.id} references non planner-ready exercise ${slot.exerciseId}`,
        );
      }

      for (const requiredEquipment of exercise.requiredEquipment) {
        if (!recipeEquipmentIds.has(requiredEquipment)) {
          throw new Error(
            `Workout recipe ${recipe.id} slot ${slot.id} requires ${requiredEquipment} but recipe equipment omits it`,
          );
        }
      }

      if (!exercise.allowedRoles.includes(slot.role)) {
        throw new Error(
          `Workout recipe ${recipe.id} uses ${slot.exerciseId} as unsupported role ${slot.role}`,
        );
      }

      for (const substitutionId of slot.substitutionExerciseIds) {
        const substitution = canonicalById.get(substitutionId);
        if (!substitution) {
          throw new Error(
            `Workout recipe ${recipe.id} references unknown substitution ${substitutionId}`,
          );
        }

        if (substitution.metadataCompleteness !== 'planner-ready') {
          throw new Error(
            `Workout recipe ${recipe.id} references non planner-ready substitution ${substitutionId}`,
          );
        }

        for (const requiredEquipment of substitution.requiredEquipment) {
          if (!recipeEquipmentIds.has(requiredEquipment)) {
            throw new Error(
              `Workout recipe ${recipe.id} substitution ${substitutionId} requires ${requiredEquipment} but recipe equipment omits it`,
            );
          }
        }
      }
    }
  }
}

const database = new Database(paths.publicSqlite, {
  readonly: true,
  fileMustExist: true,
});
const plannerReadyCount = database
  .prepare(
    'SELECT COUNT(*) as count FROM exercises WHERE metadata_completeness = ?',
  )
  .get('planner-ready');

if ((plannerReadyCount?.count ?? 0) !== manifest.plannerReadyCount) {
  throw new Error(
    'Planner-ready count mismatch between manifest and SQLite database',
  );
}

const leakedLegacyExerciseIds = database
  .prepare(
    "SELECT COUNT(*) as count FROM exercises WHERE id LIKE 'wger:%' OR id LIKE 'fitnessshub:%'",
  )
  .get();

if ((leakedLegacyExerciseIds?.count ?? 0) !== 0) {
  throw new Error(
    'Legacy source-prefixed exercise ids leaked into public SQLite',
  );
}

const leakedLegacySourceIds = database
  .prepare(
    "SELECT COUNT(*) as count FROM exercises WHERE source_id LIKE 'wger:%' OR source_id LIKE 'fitnessshub:%'",
  )
  .get();

if ((leakedLegacySourceIds?.count ?? 0) !== 0) {
  throw new Error(
    'Legacy source-prefixed source ids leaked into public SQLite',
  );
}

const leakedLegacySlugs = database
  .prepare(
    "SELECT COUNT(*) as count FROM exercises WHERE slug LIKE 'wger-%' OR slug LIKE 'fitnessshub-%'",
  )
  .get();

if ((leakedLegacySlugs?.count ?? 0) !== 0) {
  throw new Error('Legacy source-prefixed slugs leaked into public SQLite');
}

const publicExerciseSourceRefs = database
  .prepare(
    "SELECT COUNT(DISTINCT e.id) as count FROM exercises e JOIN exercise_source_refs r ON r.exercise_id = e.id WHERE e.id LIKE 'ex:%'",
  )
  .get();

if ((publicExerciseSourceRefs?.count ?? 0) !== 0) {
  throw new Error(
    'Public ex:* exercises must not retain source refs in SQLite',
  );
}

const sourceUrlColumn = database
  .prepare(
    "SELECT COUNT(*) as count FROM pragma_table_info('exercise_source_refs') WHERE name = 'source_url'",
  )
  .get();

if ((sourceUrlColumn?.count ?? 0) !== 0) {
  throw new Error('Public SQLite must not expose source_url columns');
}

const metadataRows = database
  .prepare("SELECT value FROM library_metadata WHERE key = 'sourceVersion'")
  .all();

if (metadataRows.some((row) => legacySourcePattern.test(row.value))) {
  throw new Error('Public SQLite metadata leaked a legacy crawled source');
}

const smokeQueries = [
  {
    name: 'bodyweight full body',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id = 'bodyweight')
        AND EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'focus' AND et.tag = 'upper_body')
    `,
  },
  {
    name: 'quiet low-impact bodyweight',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND e.noise_level = 'quiet'
        AND e.impact_level IN ('none', 'low')
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id = 'bodyweight')
    `,
  },
  {
    name: 'dumbbells and bench upper body',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id = 'dumbbell')
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id IN ('bench', 'incline_bench'))
        AND EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'focus' AND et.tag = 'upper_body')
    `,
  },
  {
    name: 'bands or bodyweight recovery/warmup',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND EXISTS (SELECT 1 FROM exercise_roles er WHERE er.exercise_id = e.id AND er.role IN ('warmup', 'recovery'))
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id IN ('bodyweight', 'resistance_bands'))
    `,
  },
  {
    name: 'pull-up bar upper body',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id = 'pull_up_bar')
        AND EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'focus' AND et.tag = 'upper_body')
    `,
  },
  {
    name: 'treadmill conditioning',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id = 'treadmill')
        AND EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'style' AND et.tag IN ('conditioning', 'cardio'))
    `,
  },
  {
    name: 'travel-friendly quiet bodyweight or bands',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND e.travel_friendly = 1
        AND e.noise_level = 'quiet'
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id IN ('bodyweight', 'resistance_bands'))
    `,
  },
  {
    name: 'knee-sensitive low-impact lower body',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND e.impact_level IN ('none', 'low')
        AND EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'focus' AND et.tag = 'lower_body')
        AND NOT EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'contraindication' AND et.tag = 'knee_sensitivity')
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id IN ('bodyweight', 'resistance_bands'))
    `,
  },
  {
    name: 'lower-back-sensitive upper body options',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'focus' AND et.tag = 'upper_body')
        AND NOT EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'contraindication' AND et.tag = 'lower_back_sensitivity')
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id IN ('bodyweight', 'dumbbell', 'resistance_bands', 'bench', 'cable_machine'))
    `,
  },
  {
    name: 'rowing machine conditioning',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id = 'rowing_machine')
        AND EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'style' AND et.tag IN ('conditioning', 'cardio'))
    `,
  },
  {
    name: 'strongman-style sandbag coverage',
    sql: `SELECT COUNT(*) as count
      FROM exercises e
      WHERE e.metadata_completeness = 'planner-ready'
        AND EXISTS (SELECT 1 FROM exercise_equipment ee WHERE ee.exercise_id = e.id AND ee.equipment_id = 'sandbag')
        AND EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'style' AND et.tag = 'strongman')
    `,
  },
];

for (const smokeQuery of smokeQueries) {
  const row = database.prepare(smokeQuery.sql).get();
  if ((row?.count ?? 0) < 1) {
    throw new Error(`Smoke query failed: ${smokeQuery.name}`);
  }
}

const workoutRecipeCount = database
  .prepare('SELECT COUNT(*) as count FROM workout_catalog_recipes')
  .get();
if ((workoutRecipeCount?.count ?? 0) !== workoutCatalog.recipes.length) {
  throw new Error('Workout catalog recipe count mismatch in SQLite');
}

const workoutSlotCount = database
  .prepare('SELECT COUNT(*) as count FROM workout_catalog_slots')
  .get();
if ((workoutSlotCount?.count ?? 0) < 8) {
  throw new Error('Expected at least 8 workout catalog slots in SQLite');
}

const workoutSubstitutionCount = database
  .prepare('SELECT COUNT(*) as count FROM workout_catalog_slot_substitutions')
  .get();
if ((workoutSubstitutionCount?.count ?? 0) < 5) {
  throw new Error(
    'Expected at least 5 workout catalog substitutions in SQLite',
  );
}

const invalidWorkoutExerciseRefs = database
  .prepare(
    `SELECT COUNT(*) as count
      FROM workout_catalog_slots ws
      LEFT JOIN exercises e ON e.id = ws.exercise_id
      WHERE e.id IS NULL OR e.metadata_completeness != 'planner-ready'`,
  )
  .get();
if ((invalidWorkoutExerciseRefs?.count ?? 0) !== 0) {
  throw new Error('Workout catalog slots must reference planner-ready exercises');
}

const representativeWorkoutQueries = [
  {
    name: 'bodyweight 30 minute catalog option',
    sql: `SELECT COUNT(*) as count
      FROM workout_catalog_recipes wr
      WHERE wr.duration_min_minutes <= 30
        AND wr.duration_max_minutes >= 30
        AND EXISTS (
          SELECT 1 FROM workout_catalog_recipe_equipment wre
          WHERE wre.recipe_id = wr.id AND wre.equipment_id = 'bodyweight'
        )`,
  },
  {
    name: 'dumbbell upper catalog option',
    sql: `SELECT COUNT(*) as count
      FROM workout_catalog_recipes wr
      WHERE EXISTS (
          SELECT 1 FROM workout_catalog_recipe_tags wrt
          WHERE wrt.recipe_id = wr.id
            AND wrt.tag_type = 'focus'
            AND wrt.tag = 'upper_body'
        )
        AND EXISTS (
          SELECT 1 FROM workout_catalog_recipe_equipment wre
          WHERE wre.recipe_id = wr.id AND wre.equipment_id = 'dumbbell'
        )`,
  },
  {
    name: 'gym conditioning catalog option',
    sql: `SELECT COUNT(*) as count
      FROM workout_catalog_recipes wr
      WHERE EXISTS (
          SELECT 1 FROM workout_catalog_recipe_tags wrt
          WHERE wrt.recipe_id = wr.id
            AND wrt.tag_type = 'environment'
            AND wrt.tag = 'gym'
        )
        AND EXISTS (
          SELECT 1 FROM workout_catalog_recipe_tags wrt
          WHERE wrt.recipe_id = wr.id
            AND wrt.tag_type = 'style'
            AND wrt.tag = 'conditioning'
        )`,
  },
];

for (const representativeQuery of representativeWorkoutQueries) {
  const row = database.prepare(representativeQuery.sql).get();
  if ((row?.count ?? 0) < 1) {
    throw new Error(
      `Workout catalog smoke query failed: ${representativeQuery.name}`,
    );
  }
}

database.close();

console.log(
  `Validated ${canonical.length} exercises (${manifest.plannerReadyCount} planner-ready) and ${workoutCatalog.recipes.length} workout recipes`,
);
