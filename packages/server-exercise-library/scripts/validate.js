import Database from 'better-sqlite3';
import { paths, readJson } from './_common.js';

const [canonical, manifest, readinessReport, enums, tags, equipment] =
  await Promise.all([
    readJson(paths.generatedCanonical),
    readJson(paths.generatedManifest),
    readJson(paths.generatedReadinessReport),
    readJson(paths.enumsVocab),
    readJson(paths.tagsVocab),
    readJson(paths.equipmentVocab),
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

for (const exercise of canonical) {
  if (ids.has(exercise.id)) {
    throw new Error(`Duplicate canonical id: ${exercise.id}`);
  }
  ids.add(exercise.id);

  if (sourceIds.has(exercise.sourceId)) {
    throw new Error(`Duplicate source id: ${exercise.sourceId}`);
  }
  sourceIds.add(exercise.sourceId);

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

if (readinessReport.autoPromotedCount < 350) {
  throw new Error(
    `Expected at least 350 auto-promoted exercises, found ${readinessReport.autoPromotedCount}`,
  );
}

if ((readinessReport.countsByRiskTier?.low ?? 0) < 400) {
  throw new Error(
    'Expected at least 400 low-risk classified exercises in readiness report',
  );
}

const database = new Database(paths.generatedSqlite, {
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

database.close();

console.log(
  `Validated ${canonical.length} exercises (${manifest.plannerReadyCount} planner-ready)`,
);
