import type Database from 'better-sqlite3';
import {
  expandAvailableEquipment,
  getExperienceRank,
  getImpactRank,
  getLoadRank,
  getMetadataCompletenessRank,
  getNoiseRank,
  getSpaceRank,
  normalizeEquipmentId,
} from './vocab.js';
import type {
  CandidateQuery,
  CandidateResult,
  ExerciseLibrary,
  ExerciseLibraryMetadata,
  ExerciseRecord,
  MetadataCompleteness,
} from './types.js';

interface SqlBuildResult {
  fromSql: string;
  sql: string;
  params: Array<string | number>;
  orderBySql?: string;
}

interface ExerciseRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  instruction_steps_json: string;
  aliases_json: string;
  required_equipment_json: string;
  optional_equipment_json: string;
  focus_tags_json: string;
  movement_tags_json: string;
  style_tags_json: string;
  stressor_tags_json: string;
  contraindication_tags_json: string;
  avoid_tags_json: string;
  impact_level: string;
  noise_level: string;
  space_footprint: string;
  travel_friendly: number;
  floor_required: number;
  experience_level_min: string;
  load_level: string;
  allowed_roles_json: string;
  metadata_completeness: MetadataCompleteness;
  sort_key: number;
  source_refs_json: string;
}

const DEFAULT_MINIMUM_COMPLETENESS: MetadataCompleteness = 'planner-ready';

export class ExerciseLibraryQueryEngine implements ExerciseLibrary {
  constructor(private readonly database: Database.Database) {}

  getExerciseById(id: string): ExerciseRecord | null {
    const row = this.database
      .prepare(`${BASE_SELECT_SQL} FROM exercises e WHERE e.id = ? LIMIT 1`)
      .get(id) as ExerciseRow | undefined;

    return row ? mapExerciseRow(row) : null;
  }

  getExerciseByAlias(nameOrAlias: string): ExerciseRecord | null {
    const normalized = nameOrAlias.trim().toLowerCase();
    const row = this.database
      .prepare(
        `${BASE_SELECT_SQL} FROM exercises e WHERE lower(e.name) = ? OR EXISTS (SELECT 1 FROM exercise_aliases ea WHERE ea.exercise_id = e.id AND lower(ea.alias) = ?) LIMIT 1`,
      )
      .get(normalized, normalized) as ExerciseRow | undefined;

    return row ? mapExerciseRow(row) : null;
  }

  countEligibleExercises(query: CandidateQuery): number {
    const built = buildEligibleExerciseSql(query, true);
    const row = this.database.prepare(built.sql).get(...built.params) as
      | { count: number }
      | undefined;
    return row?.count ?? 0;
  }

  listEligibleExercises(query: CandidateQuery): CandidateResult {
    return this.listCandidates(query);
  }

  listVariationCandidates(query: CandidateQuery): CandidateResult {
    return this.listCandidates({
      ...query,
      excludeExerciseIds: [
        ...(query.excludeExerciseIds ?? []),
        ...(query.baselineExerciseIds ?? []),
      ],
    });
  }

  getLibraryMetadata(): ExerciseLibraryMetadata {
    const rows = this.database
      .prepare('SELECT key, value FROM library_metadata')
      .all() as Array<{ key: string; value: string }>;
    const metadata = new Map(rows.map((row) => [row.key, row.value]));

    return {
      libraryVersion: metadata.get('libraryVersion') ?? 'unknown',
      sourceVersion: metadata.get('sourceVersion') ?? 'unknown',
      builtAt: metadata.get('builtAt') ?? 'unknown',
      exerciseCount: Number(metadata.get('exerciseCount') ?? 0),
      plannerReadyCount: Number(metadata.get('plannerReadyCount') ?? 0),
    };
  }

  close(): void {
    this.database.close();
  }

  private listCandidates(query: CandidateQuery): CandidateResult {
    const built = buildEligibleExerciseSql(query, false);
    const rows = this.database
      .prepare(built.sql)
      .all(...built.params) as unknown as ExerciseRow[];

    return {
      exercises: rows.map(mapExerciseRow),
      totalEligibleCount: this.countEligibleExercises(query),
      libraryVersion: this.getLibraryMetadata().libraryVersion,
    };
  }
}

const BASE_SELECT_SQL = `
SELECT
  e.id,
  e.slug,
  e.name,
  e.description,
  e.instruction_steps_json,
  e.aliases_json,
  e.required_equipment_json,
  e.optional_equipment_json,
  e.focus_tags_json,
  e.movement_tags_json,
  e.style_tags_json,
  e.stressor_tags_json,
  e.contraindication_tags_json,
  e.avoid_tags_json,
  e.impact_level,
  e.noise_level,
  e.space_footprint,
  e.travel_friendly,
  e.floor_required,
  e.experience_level_min,
  e.load_level,
  e.allowed_roles_json,
  e.metadata_completeness,
  e.sort_key,
  e.source_refs_json
`;

function buildEligibleExerciseSql(
  query: CandidateQuery,
  countOnly: boolean,
): SqlBuildResult {
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  let fromSql = 'FROM exercises e';

  const minimumCompleteness =
    query.minimumMetadataCompleteness ?? DEFAULT_MINIMUM_COMPLETENESS;
  conditions.push('e.metadata_completeness_rank >= ?');
  params.push(getMetadataCompletenessRank(minimumCompleteness));

  const searchText = buildFtsQuery(query.searchText);
  let orderBySql = '';
  if (searchText) {
    fromSql = `${fromSql} JOIN exercise_search ON exercise_search.exercise_id = e.id`;
    conditions.push('exercise_search MATCH ?');
    params.push(searchText);
    orderBySql = `bm25(exercise_search, 4.0, 2.5, 1.4, 0.7, 1.0, 1.0, 0.9, 0.8) ASC`;
  }

  if (query.availableEquipment?.length) {
    const equipmentIds = expandAvailableEquipment(query.availableEquipment).map(
      normalizeEquipmentId,
    );
    const placeholders = equipmentIds.map(() => '?').join(', ');
    conditions.push(`NOT EXISTS (
      SELECT 1
      FROM exercise_equipment ee
      WHERE ee.exercise_id = e.id
        AND ee.requirement_type = 'required'
        AND ee.equipment_id NOT IN (${placeholders})
    )`);
    params.push(...equipmentIds);
  }

  if (query.experienceLevel) {
    conditions.push('e.experience_level_min_rank <= ?');
    params.push(getExperienceRank(query.experienceLevel));
  }

  if (query.loadCeiling) {
    conditions.push('e.load_level_rank <= ?');
    params.push(getLoadRank(query.loadCeiling));
  }

  if (query.environment?.quietRequired) {
    conditions.push('e.noise_level = ?');
    params.push('quiet');
  }

  if (query.environment?.maxImpact && query.environment.maxImpact !== 'any') {
    conditions.push('e.impact_level_rank <= ?');
    params.push(getImpactRank(query.environment.maxImpact));
  }

  if (query.environment?.maxNoise && query.environment.maxNoise !== 'any') {
    conditions.push('e.noise_level_rank <= ?');
    params.push(getNoiseRank(query.environment.maxNoise));
  }

  if (query.environment?.maxSpaceFootprint) {
    conditions.push('e.space_footprint_rank <= ?');
    params.push(getSpaceRank(query.environment.maxSpaceFootprint));
  }

  if (query.environment?.travelFriendlyRequired) {
    conditions.push('e.travel_friendly = 1');
  }

  if (query.environment?.floorAvailable === false) {
    conditions.push('e.floor_required = 0');
  }

  if (query.focusTags?.length) {
    addTagExistsCondition(conditions, params, 'focus', query.focusTags);
  }

  if (query.blockRole) {
    conditions.push(
      'EXISTS (SELECT 1 FROM exercise_roles er WHERE er.exercise_id = e.id AND er.role = ?)',
    );
    params.push(query.blockRole);
  }

  if (query.contraindicationTags?.length) {
    addTagExclusionCondition(
      conditions,
      params,
      'contraindication',
      query.contraindicationTags,
    );
  }

  if (query.avoidTags?.length) {
    addTagExclusionCondition(conditions, params, 'avoid', query.avoidTags);
  }

  if (query.disallowedStressors?.length) {
    addTagExclusionCondition(
      conditions,
      params,
      'stressor',
      query.disallowedStressors,
    );
  }

  if (query.excludeExerciseIds?.length) {
    const placeholders = query.excludeExerciseIds.map(() => '?').join(', ');
    conditions.push(`e.id NOT IN (${placeholders})`);
    params.push(...query.excludeExerciseIds);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  if (countOnly) {
    return {
      fromSql,
      sql: `SELECT COUNT(*) as count ${fromSql} ${whereClause}`,
      params,
    };
  }

  const textMatchScore = buildTextMatchScore(query.searchText, params);
  const styleScore = buildStyleBiasScore(query.styleBias, params);
  const sourcePriorityScore = `CASE WHEN e.id LIKE 'fedb:%' THEN 1 ELSE 0 END`;
  const compoundScore = `EXISTS (
    SELECT 1
    FROM exercise_tags et
    WHERE et.exercise_id = e.id
      AND et.tag_type = 'movement'
      AND et.tag = 'compound'
  )`;
  const mainRoleScore = `EXISTS (
    SELECT 1
    FROM exercise_roles er
    WHERE er.exercise_id = e.id
      AND er.role = 'main'
  )`;
  const loadPriorityScore = buildLoadPriorityScore(query);
  const equipmentPriorityScore = buildEquipmentPriorityScore(query);
  const limitClause = query.limit ? 'LIMIT ?' : '';
  if (query.limit) {
    params.push(query.limit);
  }

  return {
    fromSql,
    sql: `${BASE_SELECT_SQL}
      ${fromSql}
      ${whereClause}
      ORDER BY ${textMatchScore} DESC,
        ${styleScore} DESC,
        ${sourcePriorityScore} DESC,
        ${compoundScore} DESC,
        ${mainRoleScore} DESC,
        ${loadPriorityScore} DESC,
        ${equipmentPriorityScore} DESC,
        ${orderBySql ? `${orderBySql},` : ''}
        e.sort_key ASC,
        e.id ASC
      ${limitClause}`,
    params,
    orderBySql,
  };
}

function buildFtsQuery(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const tokens = [
    ...new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []),
  ].filter((token) => token.length >= 2);

  if (!tokens.length) {
    return null;
  }

  return tokens.map((token) => `${token}*`).join(' OR ');
}

function buildStyleBiasScore(
  styleBias: string[] | undefined,
  params: Array<string | number>,
): string {
  if (!styleBias?.length) {
    return 'CASE WHEN 1 = 1 THEN 0 END';
  }

  const placeholders = styleBias.map(() => '?').join(', ');
  params.push(...styleBias);
  return `(SELECT COUNT(*) FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = 'style' AND et.tag IN (${placeholders}))`;
}

function buildTextMatchScore(
  rawSearchText: string | undefined,
  params: Array<string | number>,
): string {
  const normalized = rawSearchText?.trim().toLowerCase();
  if (!normalized) {
    return 'CASE WHEN 1 = 1 THEN 0 END';
  }

  const contains = `%${normalized}%`;
  params.push(normalized, normalized, contains, contains);

  return `CASE
    WHEN lower(e.name) = ? THEN 40
    WHEN EXISTS (
      SELECT 1
      FROM exercise_aliases ea
      WHERE ea.exercise_id = e.id
        AND lower(ea.alias) = ?
    ) THEN 36
    WHEN lower(e.name) LIKE ? THEN 24
    WHEN EXISTS (
      SELECT 1
      FROM exercise_aliases ea
      WHERE ea.exercise_id = e.id
        AND lower(ea.alias) LIKE ?
    ) THEN 12
    ELSE 0
  END`;
}

function buildLoadPriorityScore(query: CandidateQuery): string {
  const prefersStrengthLoads =
    query.blockRole === 'main' || query.styleBias?.includes('strength');

  if (!prefersStrengthLoads) {
    return 'CASE WHEN 1 = 1 THEN 0 END';
  }

  return `CASE e.load_level
    WHEN 'heavy' THEN 3
    WHEN 'moderate' THEN 2
    WHEN 'light' THEN 1
    ELSE 0
  END`;
}

function buildEquipmentPriorityScore(query: CandidateQuery): string {
  const prefersLoadedStrength =
    query.availableEquipment?.length &&
    (query.blockRole === 'main' || query.styleBias?.includes('strength'));

  if (!prefersLoadedStrength) {
    return 'CASE WHEN 1 = 1 THEN 0 END';
  }

  return `CASE
    WHEN EXISTS (
      SELECT 1
      FROM exercise_equipment ee
      WHERE ee.exercise_id = e.id
        AND ee.requirement_type = 'required'
        AND ee.equipment_id IN (
          'barbell',
          'dumbbell',
          'kettlebell',
          'machine',
          'cable_machine',
          'bench',
          'incline_bench',
          'squat_rack',
          'ez_curl_bar',
          'medicine_ball',
          'sandbag'
        )
    ) THEN 3
    WHEN EXISTS (
      SELECT 1
      FROM exercise_equipment ee
      WHERE ee.exercise_id = e.id
        AND ee.requirement_type = 'required'
        AND ee.equipment_id IN (
          'resistance_bands',
          'pull_up_bar',
          'rowing_machine',
          'treadmill',
          'jump_rope',
          'other'
        )
    ) THEN 2
    WHEN EXISTS (
      SELECT 1
      FROM exercise_equipment ee
      WHERE ee.exercise_id = e.id
        AND ee.requirement_type = 'required'
        AND ee.equipment_id = 'bodyweight'
    ) THEN 1
    ELSE 0
  END`;
}

function addTagExistsCondition(
  conditions: string[],
  params: Array<string | number>,
  tagType: string,
  tags: string[],
): void {
  const placeholders = tags.map(() => '?').join(', ');
  conditions.push(
    `EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = ? AND et.tag IN (${placeholders}))`,
  );
  params.push(tagType, ...tags);
}

function addTagExclusionCondition(
  conditions: string[],
  params: Array<string | number>,
  tagType: string,
  tags: string[],
): void {
  const placeholders = tags.map(() => '?').join(', ');
  conditions.push(
    `NOT EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = ? AND et.tag IN (${placeholders}))`,
  );
  params.push(tagType, ...tags);
}

function mapExerciseRow(row: ExerciseRow): ExerciseRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    aliases: parseJsonArray(row.aliases_json),
    description: row.description,
    instructionSteps: parseJsonArray(row.instruction_steps_json),
    requiredEquipment: parseJsonArray(row.required_equipment_json),
    optionalEquipment: parseJsonArray(row.optional_equipment_json),
    focusTags: parseJsonArray(row.focus_tags_json),
    movementTags: parseJsonArray(row.movement_tags_json),
    styleTags: parseJsonArray(row.style_tags_json),
    stressorTags: parseJsonArray(row.stressor_tags_json),
    contraindicationTags: parseJsonArray(row.contraindication_tags_json),
    avoidTags: parseJsonArray(row.avoid_tags_json),
    impactLevel: row.impact_level as ExerciseRecord['impactLevel'],
    noiseLevel: row.noise_level as ExerciseRecord['noiseLevel'],
    spaceFootprint: row.space_footprint as ExerciseRecord['spaceFootprint'],
    travelFriendly: Boolean(row.travel_friendly),
    floorRequired: Boolean(row.floor_required),
    experienceLevelMin:
      row.experience_level_min as ExerciseRecord['experienceLevelMin'],
    loadLevel: row.load_level as ExerciseRecord['loadLevel'],
    allowedRoles: parseJsonArray(
      row.allowed_roles_json,
    ) as ExerciseRecord['allowedRoles'],
    metadataCompleteness: row.metadata_completeness,
    sortKey: row.sort_key,
    sourceRefs: JSON.parse(
      row.source_refs_json,
    ) as ExerciseRecord['sourceRefs'],
  };
}

function parseJsonArray(value: string): string[] {
  return JSON.parse(value) as string[];
}
