import { rename, rm } from 'node:fs/promises';
import Database from 'better-sqlite3';
import { paths, readJson } from './_common.js';

const canonical = await readJson(paths.generatedCanonical);
const manifest = await readJson(paths.generatedManifest);
const tempSqlitePath = `${paths.generatedSqliteTemp}.${process.pid}.${Date.now()}`;

await rm(tempSqlitePath, { force: true });

const database = new Database(tempSqlitePath);

database.exec(`
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = DELETE;

CREATE TABLE library_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  instruction_steps_json TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  required_equipment_json TEXT NOT NULL,
  optional_equipment_json TEXT NOT NULL,
  focus_tags_json TEXT NOT NULL,
  movement_tags_json TEXT NOT NULL,
  style_tags_json TEXT NOT NULL,
  stressor_tags_json TEXT NOT NULL,
  contraindication_tags_json TEXT NOT NULL,
  avoid_tags_json TEXT NOT NULL,
  impact_level TEXT NOT NULL,
  impact_level_rank INTEGER NOT NULL,
  noise_level TEXT NOT NULL,
  noise_level_rank INTEGER NOT NULL,
  space_footprint TEXT NOT NULL,
  space_footprint_rank INTEGER NOT NULL,
  travel_friendly INTEGER NOT NULL,
  floor_required INTEGER NOT NULL,
  experience_level_min TEXT NOT NULL,
  experience_level_min_rank INTEGER NOT NULL,
  load_level TEXT NOT NULL,
  load_level_rank INTEGER NOT NULL,
  allowed_roles_json TEXT NOT NULL,
  metadata_completeness TEXT NOT NULL,
  metadata_completeness_rank INTEGER NOT NULL,
  sort_key INTEGER NOT NULL,
  source_refs_json TEXT NOT NULL
);

CREATE TABLE exercise_aliases (
  exercise_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  PRIMARY KEY (exercise_id, alias),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE exercise_equipment (
  exercise_id TEXT NOT NULL,
  equipment_id TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  PRIMARY KEY (exercise_id, equipment_id, requirement_type),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE exercise_tags (
  exercise_id TEXT NOT NULL,
  tag_type TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (exercise_id, tag_type, tag),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE exercise_roles (
  exercise_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (exercise_id, role),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE exercise_source_refs (
  exercise_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  PRIMARY KEY (exercise_id, source, source_id, source_version),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE exercise_search USING fts5(
  exercise_id UNINDEXED,
  name,
  aliases,
  description,
  instruction_steps,
  focus_tags,
  movement_tags,
  style_tags,
  equipment_tags
);

CREATE INDEX idx_exercises_sort_key ON exercises(sort_key, id);
CREATE INDEX idx_exercises_metadata_rank ON exercises(metadata_completeness_rank, sort_key, id);
CREATE INDEX idx_exercises_load_rank ON exercises(load_level_rank);
CREATE INDEX idx_exercises_experience_rank ON exercises(experience_level_min_rank);
CREATE INDEX idx_exercise_tags_lookup ON exercise_tags(tag_type, tag, exercise_id);
CREATE INDEX idx_exercise_roles_lookup ON exercise_roles(role, exercise_id);
CREATE INDEX idx_exercise_equipment_lookup ON exercise_equipment(equipment_id, requirement_type, exercise_id);
CREATE INDEX idx_exercise_alias_lookup ON exercise_aliases(alias, exercise_id);
`);

const insertMetadata = database.prepare(
  'INSERT INTO library_metadata(key, value) VALUES(?, ?)',
);
const insertExercise = database.prepare(`
  INSERT INTO exercises (
    id,
    source_id,
    slug,
    name,
    description,
    instruction_steps_json,
    aliases_json,
    required_equipment_json,
    optional_equipment_json,
    focus_tags_json,
    movement_tags_json,
    style_tags_json,
    stressor_tags_json,
    contraindication_tags_json,
    avoid_tags_json,
    impact_level,
    impact_level_rank,
    noise_level,
    noise_level_rank,
    space_footprint,
    space_footprint_rank,
    travel_friendly,
    floor_required,
    experience_level_min,
    experience_level_min_rank,
    load_level,
    load_level_rank,
    allowed_roles_json,
    metadata_completeness,
    metadata_completeness_rank,
    sort_key,
    source_refs_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAlias = database.prepare(
  'INSERT INTO exercise_aliases(exercise_id, alias) VALUES(?, ?)',
);
const insertEquipment = database.prepare(
  'INSERT INTO exercise_equipment(exercise_id, equipment_id, requirement_type) VALUES(?, ?, ?)',
);
const insertTag = database.prepare(
  'INSERT INTO exercise_tags(exercise_id, tag_type, tag) VALUES(?, ?, ?)',
);
const insertRole = database.prepare(
  'INSERT INTO exercise_roles(exercise_id, role) VALUES(?, ?)',
);
const insertSourceRef = database.prepare(
  'INSERT INTO exercise_source_refs(exercise_id, source, source_id, source_version) VALUES(?, ?, ?, ?)',
);
const insertSearch = database.prepare(
  'INSERT INTO exercise_search(exercise_id, name, aliases, description, instruction_steps, focus_tags, movement_tags, style_tags, equipment_tags) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
);

const metadataRank = {
  raw: 1,
  derived: 2,
  curated: 3,
  'planner-ready': 4,
};

const experienceRank = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const loadRank = {
  light: 1,
  moderate: 2,
  heavy: 3,
};

const impactRank = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

const noiseRank = {
  quiet: 1,
  moderate: 2,
  loud: 3,
};

const spaceRank = {
  small: 1,
  medium: 2,
  large: 3,
};

const seedDatabase = database.transaction(() => {
  for (const [key, value] of Object.entries(manifest)) {
    insertMetadata.run(key, String(value));
  }

  for (const exercise of canonical) {
    insertExercise.run(
      exercise.id,
      exercise.sourceId,
      exercise.slug,
      exercise.name,
      exercise.description,
      JSON.stringify(exercise.instructionSteps),
      JSON.stringify(exercise.aliases),
      JSON.stringify(exercise.requiredEquipment),
      JSON.stringify(exercise.optionalEquipment),
      JSON.stringify(exercise.focusTags),
      JSON.stringify(exercise.movementTags),
      JSON.stringify(exercise.styleTags),
      JSON.stringify(exercise.stressorTags),
      JSON.stringify(exercise.contraindicationTags),
      JSON.stringify(exercise.avoidTags),
      exercise.impactLevel,
      impactRank[exercise.impactLevel],
      exercise.noiseLevel,
      noiseRank[exercise.noiseLevel],
      exercise.spaceFootprint,
      spaceRank[exercise.spaceFootprint],
      exercise.travelFriendly ? 1 : 0,
      exercise.floorRequired ? 1 : 0,
      exercise.experienceLevelMin,
      experienceRank[exercise.experienceLevelMin],
      exercise.loadLevel,
      loadRank[exercise.loadLevel],
      JSON.stringify(exercise.allowedRoles),
      exercise.metadataCompleteness,
      metadataRank[exercise.metadataCompleteness],
      exercise.sortKey,
      JSON.stringify(exercise.sourceRefs),
    );

    for (const alias of exercise.aliases) {
      insertAlias.run(exercise.id, alias.toLowerCase());
    }

    for (const equipmentId of exercise.requiredEquipment) {
      insertEquipment.run(exercise.id, equipmentId, 'required');
    }

    for (const equipmentId of exercise.optionalEquipment) {
      insertEquipment.run(exercise.id, equipmentId, 'optional');
    }

    for (const [tagType, tags] of [
      ['focus', exercise.focusTags],
      ['movement', exercise.movementTags],
      ['style', exercise.styleTags],
      ['stressor', exercise.stressorTags],
      ['contraindication', exercise.contraindicationTags],
      ['avoid', exercise.avoidTags],
    ]) {
      for (const tag of tags) {
        insertTag.run(exercise.id, tagType, tag);
      }
    }

    for (const role of exercise.allowedRoles) {
      insertRole.run(exercise.id, role);
    }

    for (const sourceRef of exercise.sourceRefs) {
      insertSourceRef.run(
        exercise.id,
        sourceRef.source,
        sourceRef.sourceId,
        sourceRef.sourceVersion,
      );
    }

    insertSearch.run(
      exercise.id,
      exercise.name,
      exercise.aliases.join(' '),
      exercise.description,
      exercise.instructionSteps.join(' '),
      exercise.focusTags.join(' '),
      exercise.movementTags.join(' '),
      exercise.styleTags.join(' '),
      [...exercise.requiredEquipment, ...exercise.optionalEquipment].join(' '),
    );
  }
});

seedDatabase();

database.close();

await rm(paths.generatedSqlite, { force: true });
await rename(tempSqlitePath, paths.generatedSqlite);

console.log(`Built SQLite exercise library at ${paths.generatedSqlite}`);
