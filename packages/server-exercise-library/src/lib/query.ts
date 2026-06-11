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
  CandidateDiagnostics,
  CandidateQuery,
  CandidateResult,
  ExerciseLibrary,
  ExerciseLibraryMetadata,
  ExerciseRecord,
  WorkoutCatalogBlock,
  WorkoutCatalogDiagnostics,
  WorkoutCatalogEnergy,
  WorkoutCatalogMatch,
  WorkoutCatalogQuery,
  WorkoutCatalogRecipe,
  WorkoutCatalogSlot,
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

interface WorkoutCatalogRecipeRow {
  id: string;
  slug: string;
  ownership: 'system';
  version: number;
  status: 'active';
  title: string;
  summary: string;
  focus: string;
  target_duration_minutes: number;
  duration_min_minutes: number;
  duration_max_minutes: number;
  min_experience_level: string;
  quality_score: number;
  catalog_version: string;
  source: string;
  score: number;
  focus_score: number;
  duration_score: number;
  energy_score: number;
  diversity_score: number;
  adaptive_score: number;
  recipe_cooldown_penalty: number;
}

interface WorkoutCatalogBlockRow {
  block_id: string;
  block_order: number;
  title: string;
  duration_minutes: number;
  focus: string;
}

interface WorkoutCatalogSlotRow extends ExerciseRow {
  block_id: string;
  slot_id: string;
  slot_order: number;
  role: string;
  prescription: string;
  detail: string | null;
  intensity: WorkoutCatalogEnergy;
}

const DEFAULT_MINIMUM_COMPLETENESS: MetadataCompleteness = 'planner-ready';
const DIRECT_MATCH_THRESHOLD = 82;
const ADAPT_MATCH_THRESHOLD = 58;
const RECENT_RECIPE_SCORE_PENALTY = 20;
const UNRECOGNIZED_FOCUS_SCORE = -40;

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
        `${BASE_SELECT_SQL} FROM exercises e WHERE lower(e.name) = ? OR EXISTS (SELECT 1 FROM exercise_aliases ea WHERE ea.exercise_id = e.id AND ea.alias = ?) LIMIT 1`
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

  matchWorkoutCatalog(query: WorkoutCatalogQuery): WorkoutCatalogMatch {
    const normalizedQuery = normalizeWorkoutCatalogQuery(query);
    const candidates = this.database
      .prepare(buildWorkoutCatalogMatchSql(normalizedQuery))
      .all(...buildWorkoutCatalogMatchParams(normalizedQuery)) as
      | WorkoutCatalogRecipeRow[]
      | [];
    const rankedCandidates = prioritizeExactFocusCandidates(
      candidates,
      normalizedQuery
    );
    const best = rankedCandidates[0];

    if (!best) {
      return {
        decision: 'none',
        diagnostics: diagnoseWorkoutCatalogEmpty(
          this.database,
          normalizedQuery
        ),
      };
    }

    const recipe = this.getWorkoutCatalogRecipe(best);
    const strictFocusGap = hasStrictWorkoutCatalogFocusGap(
      recipe,
      normalizedQuery
    );
    const diagnostics = buildWorkoutCatalogDiagnostics(
      best,
      rankedCandidates.length,
      strictFocusGap
    );
    const plan = materializeWorkoutCatalogPlan(
      this.database,
      recipe,
      normalizedQuery
    );

    if (
      best.score >= DIRECT_MATCH_THRESHOLD &&
      !strictFocusGap &&
      !diagnostics.blockerCodes.includes('energy_gap')
    ) {
      return {
        decision: 'direct',
        recipe,
        plan,
        score: best.score,
        diagnostics,
      };
    }

    if (best.score >= ADAPT_MATCH_THRESHOLD) {
      return {
        decision: 'adapt',
        recipe,
        plan,
        score: best.score,
        diagnostics,
      };
    }

    return {
      decision: 'none',
      recipe,
      score: best.score,
      diagnostics: {
        ...diagnostics,
        blockerCodes: [...diagnostics.blockerCodes, 'weak_match'],
        reasons: [...diagnostics.reasons, 'best catalog score below threshold'],
      },
    };
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
    const diagnostics = rows.length
      ? undefined
      : diagnoseEmptyResult(this, query);

    return {
      exercises: rows.map(mapExerciseRow),
      totalEligibleCount: this.countEligibleExercises(query),
      libraryVersion: this.getLibraryMetadata().libraryVersion,
      diagnostics,
    };
  }

  private getWorkoutCatalogRecipe(
    row: WorkoutCatalogRecipeRow
  ): WorkoutCatalogRecipe {
    const blocks = this.database
      .prepare(
        `SELECT block_id, block_order, title, duration_minutes, focus
          FROM workout_catalog_blocks
          WHERE recipe_id = ?
          ORDER BY block_order ASC`
      )
      .all(row.id) as WorkoutCatalogBlockRow[];

    return {
      id: row.id,
      slug: row.slug,
      ownership: row.ownership,
      version: row.version,
      status: row.status,
      title: row.title,
      summary: row.summary,
      focus: row.focus,
      targetDurationMinutes: row.target_duration_minutes,
      durationRange: {
        min: row.duration_min_minutes,
        max: row.duration_max_minutes,
      },
      minExperienceLevel:
        row.min_experience_level as WorkoutCatalogRecipe['minExperienceLevel'],
      qualityScore: row.quality_score,
      catalogVersion: row.catalog_version,
      source: row.source,
      equipment: listWorkoutCatalogValues(
        this.database,
        'workout_catalog_recipe_equipment',
        row.id,
        'equipment_id'
      ),
      focusTags: listWorkoutCatalogTags(this.database, row.id, 'focus'),
      styleTags: listWorkoutCatalogTags(this.database, row.id, 'style'),
      environmentTags: listWorkoutCatalogTags(
        this.database,
        row.id,
        'environment'
      ),
      energyLevels: listWorkoutCatalogTags(
        this.database,
        row.id,
        'energy'
      ) as WorkoutCatalogEnergy[],
      constraints: listWorkoutCatalogConstraints(this.database, row.id),
      blocks: blocks.map((block) =>
        mapWorkoutCatalogBlock(this.database, row.id, block)
      ),
    };
  }
}

interface NormalizedWorkoutCatalogQuery extends WorkoutCatalogQuery {
  normalizedEquipment: string[];
  normalizedFocusTags: string[];
  hasUnrecognizedExplicitFocus: boolean;
  normalizedAvoidTags: string[];
  normalizedContraindicationTags: string[];
  normalizedDisallowedStressors: string[];
  normalizedRecentExerciseIds: string[];
  normalizedRecentCatalogRecipeIds: string[];
}

function normalizeWorkoutCatalogQuery(
  query: WorkoutCatalogQuery
): NormalizedWorkoutCatalogQuery {
  const explicitFocusTags = deriveWorkoutFocusTags(query.focus);
  const normalizedFocusTags = [
    ...new Set([
      ...(query.focusTags ?? []),
      ...explicitFocusTags,
      ...deriveWorkoutFocusTags(query.adaptivePlanIntent?.label),
      ...deriveWorkoutFocusTags(query.adaptivePlanIntent?.category),
      ...deriveWorkoutFocusTags(query.adaptivePlanIntent?.role),
    ]),
  ];

  return {
    ...query,
    normalizedEquipment: query.availableEquipment?.length
      ? expandAvailableEquipment(query.availableEquipment).map(
          normalizeEquipmentId
        )
      : [],
    normalizedFocusTags,
    hasUnrecognizedExplicitFocus: Boolean(
      query.focus?.trim() &&
        explicitFocusTags.length === 0 &&
        normalizedFocusTags.length === 0
    ),
    normalizedAvoidTags: [...new Set(query.avoidTags ?? [])],
    normalizedContraindicationTags: [
      ...new Set(query.contraindicationTags ?? []),
    ],
    normalizedDisallowedStressors: [
      ...new Set([
        ...(query.disallowedStressors ?? []),
        ...(query.adaptivePlanIntent?.stressTags ?? []),
      ]),
    ],
    normalizedRecentExerciseIds: [...new Set(query.recentExerciseIds ?? [])],
    normalizedRecentCatalogRecipeIds: [
      ...new Set(query.recentCatalogRecipeIds ?? []),
    ],
  };
}

function deriveWorkoutFocusTags(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const normalized = value.toLowerCase();
  const tags = new Set<string>();

  if (/\b(full|total)\b/.test(normalized)) {
    tags.add('full_body');
    tags.add('lower_body');
    tags.add('upper_body');
    tags.add('core');
  }
  if (/\bupper|push|pull|chest|shoulder|back\b/.test(normalized)) {
    tags.add('upper_body');
  }
  if (/\blower|leg|squat|glute|hamstring|quad\b/.test(normalized)) {
    tags.add('lower_body');
  }
  if (/\bcore|abs|trunk\b/.test(normalized)) {
    tags.add('core');
  }
  if (/\bcardio|conditioning|aerobic|run|walk\b/.test(normalized)) {
    tags.add('conditioning');
  }
  if (/\bmobility|recovery|stretch\b/.test(normalized)) {
    tags.add('recovery');
  }
  if (/\bpull|row|back\b/.test(normalized)) {
    tags.add('middle_back');
  }

  return [...tags];
}

function buildWorkoutCatalogMatchSql(
  query: NormalizedWorkoutCatalogQuery
): string {
  const conditions = ['wr.status = ?'];

  if (query.timeMinutes) {
    conditions.push('wr.duration_min_minutes <= ?');
    conditions.push('wr.duration_max_minutes >= ?');
  }

  if (query.experienceLevel) {
    conditions.push('wr.min_experience_level_rank <= ?');
  }

  if (query.normalizedEquipment.length) {
    conditions.push(`NOT EXISTS (
      SELECT 1
      FROM workout_catalog_recipe_equipment wre
      WHERE wre.recipe_id = wr.id
        AND wre.requirement_type = 'required'
        AND wre.equipment_id NOT IN (${query.normalizedEquipment
          .map(() => '?')
          .join(', ')})
    )`);
  }

  for (const [_tagType, values] of [
    ['contraindication', query.normalizedContraindicationTags],
    ['avoid', query.normalizedAvoidTags],
    ['stressor', query.normalizedDisallowedStressors],
  ] as const) {
    if (values.length) {
      conditions.push(`NOT EXISTS (
        SELECT 1
        FROM workout_catalog_slots ws
        JOIN exercise_tags et ON et.exercise_id = ws.exercise_id
        WHERE ws.recipe_id = wr.id
          AND et.tag_type = ?
          AND et.tag IN (${values.map(() => '?').join(', ')})
      )`);
    }
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';
  const focusScore = query.normalizedFocusTags.length
    ? `(SELECT COUNT(*) * 14
        FROM workout_catalog_recipe_tags wrt
        WHERE wrt.recipe_id = wr.id
          AND wrt.tag_type = 'focus'
          AND wrt.tag IN (${query.normalizedFocusTags
            .map(() => '?')
            .join(', ')}))`
    : query.hasUnrecognizedExplicitFocus
    ? `${UNRECOGNIZED_FOCUS_SCORE}`
    : '24';
  const durationScore = query.timeMinutes
    ? `MAX(0, 22 - ABS(wr.target_duration_minutes - ?))`
    : '12';
  const energyScore = query.energy
    ? `CASE WHEN EXISTS (
        SELECT 1 FROM workout_catalog_recipe_tags wrt
        WHERE wrt.recipe_id = wr.id
          AND wrt.tag_type = 'energy'
          AND wrt.tag = ?
      ) THEN 12 ELSE 0 END`
    : '8';
  const diversityPenalty = query.normalizedRecentExerciseIds.length
    ? `(SELECT COUNT(*) * 7
        FROM workout_catalog_slots ws
        WHERE ws.recipe_id = wr.id
          AND ws.exercise_id IN (${query.normalizedRecentExerciseIds
            .map(() => '?')
            .join(', ')}))`
    : '0';
  const adaptiveScore = query.adaptivePlanIntent
    ? `CASE
        WHEN EXISTS (
          SELECT 1 FROM workout_catalog_recipe_tags wrt
          WHERE wrt.recipe_id = wr.id
            AND wrt.tag_type IN ('focus', 'style')
            AND wrt.tag IN (${
              buildAdaptiveIntentTags(query)
                .map(() => '?')
                .join(', ') || "'__none__'"
            }
            )
        ) THEN 10
        ELSE 0
      END`
    : '0';
  const recipeCooldownPenalty = query.normalizedRecentCatalogRecipeIds.length
    ? `CASE WHEN wr.id IN (${query.normalizedRecentCatalogRecipeIds
        .map(() => '?')
        .join(', ')}) THEN ${RECENT_RECIPE_SCORE_PENALTY} ELSE 0 END`
    : '0';

  return `
    SELECT
      wr.id,
      wr.slug,
      wr.ownership,
      wr.version,
      wr.status,
      wr.title,
      wr.summary,
      wr.focus,
      wr.target_duration_minutes,
      wr.duration_min_minutes,
      wr.duration_max_minutes,
      wr.min_experience_level,
      wr.quality_score,
      wr.catalog_version,
      wr.source,
      ${focusScore} AS focus_score,
      ${durationScore} AS duration_score,
      ${energyScore} AS energy_score,
      MAX(0, 16 - ${diversityPenalty}) AS diversity_score,
      ${adaptiveScore} AS adaptive_score,
      ${recipeCooldownPenalty} AS recipe_cooldown_penalty,
      ROUND(
        (${focusScore}) +
        (${durationScore}) +
        (${energyScore}) +
        MAX(0, 16 - ${diversityPenalty}) +
        (${adaptiveScore}) +
        (wr.quality_score * 0.18) -
        (${recipeCooldownPenalty}),
        2
      ) AS score
    FROM workout_catalog_recipes wr
    ${whereClause}
    ORDER BY score DESC, wr.quality_score DESC, wr.id ASC
    LIMIT ?
  `;
}

function buildWorkoutCatalogMatchParams(
  query: NormalizedWorkoutCatalogQuery
): Array<string | number> {
  const params: Array<string | number> = [];

  addWorkoutCatalogScoringParams(query, params);
  addWorkoutCatalogScoringParams(query, params);

  params.push('active');

  if (query.timeMinutes) {
    params.push(query.timeMinutes, query.timeMinutes);
  }

  if (query.experienceLevel) {
    params.push(getExperienceRank(query.experienceLevel));
  }

  if (query.normalizedEquipment.length) {
    params.push(...query.normalizedEquipment);
  }

  for (const [tagType, values] of [
    ['contraindication', query.normalizedContraindicationTags],
    ['avoid', query.normalizedAvoidTags],
    ['stressor', query.normalizedDisallowedStressors],
  ] as const) {
    if (values.length) {
      params.push(tagType, ...values);
    }
  }

  params.push(query.limit ?? 5);
  return params;
}

function addWorkoutCatalogScoringParams(
  query: NormalizedWorkoutCatalogQuery,
  params: Array<string | number>
): void {
  if (query.normalizedFocusTags.length) {
    params.push(...query.normalizedFocusTags);
  }
  if (query.timeMinutes) {
    params.push(query.timeMinutes);
  }
  if (query.energy) {
    params.push(query.energy);
  }
  if (query.normalizedRecentExerciseIds.length) {
    params.push(...query.normalizedRecentExerciseIds);
  }
  if (query.adaptivePlanIntent) {
    params.push(...buildAdaptiveIntentTags(query));
  }
  if (query.normalizedRecentCatalogRecipeIds.length) {
    params.push(...query.normalizedRecentCatalogRecipeIds);
  }
}

function buildAdaptiveIntentTags(
  query: NormalizedWorkoutCatalogQuery
): string[] {
  return [
    ...new Set([
      ...deriveWorkoutFocusTags(query.adaptivePlanIntent?.role),
      ...deriveWorkoutFocusTags(query.adaptivePlanIntent?.category),
      ...deriveWorkoutFocusTags(query.adaptivePlanIntent?.label),
    ]),
  ];
}

function buildWorkoutCatalogDiagnostics(
  row: WorkoutCatalogRecipeRow,
  candidateCount: number,
  strictFocusGap = false
): WorkoutCatalogDiagnostics {
  const blockerCodes: WorkoutCatalogDiagnostics['blockerCodes'] = [];
  const reasons = [
    `score=${row.score}`,
    `focus=${row.focus_score}`,
    `duration=${row.duration_score}`,
    `energy=${row.energy_score}`,
    `diversity=${row.diversity_score}`,
    `adaptive=${row.adaptive_score}`,
    `recipeCooldownPenalty=${row.recipe_cooldown_penalty}`,
  ];

  if (row.focus_score <= 0) {
    blockerCodes.push('focus_gap');
  }
  if (strictFocusGap && !blockerCodes.includes('focus_gap')) {
    blockerCodes.push('focus_gap');
    reasons.push('strict full-body focus missing');
  }
  if (row.energy_score <= 0) {
    blockerCodes.push('energy_gap');
  }
  if (row.recipe_cooldown_penalty > 0) {
    blockerCodes.push('catalog_recipe_cooldown');
  }

  return {
    blockerCodes,
    candidateCount,
    bestScore: row.score,
    selectedRecipeId: row.id,
    reasons,
  };
}

function hasStrictWorkoutCatalogFocusGap(
  recipe: WorkoutCatalogRecipe,
  query: NormalizedWorkoutCatalogQuery
): boolean {
  if (!isExplicitFullBodyRequest(query.focus)) {
    return false;
  }

  return !recipe.focusTags.includes('full_body');
}

function prioritizeExactFocusCandidates(
  candidates: WorkoutCatalogRecipeRow[],
  query: NormalizedWorkoutCatalogQuery
): WorkoutCatalogRecipeRow[] {
  const exactFocus = deriveExactRequestedFocus(query.focus);
  if (!exactFocus) {
    return candidates;
  }

  const exactCandidates = candidates.filter((candidate) =>
    candidate.focus.toLowerCase().includes(exactFocus)
  );
  return exactCandidates.length > 0 ? exactCandidates : candidates;
}

function deriveExactRequestedFocus(
  value: string | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (/\b(full|total)\b/.test(normalized)) {
    return 'full body';
  }
  if (/\bupper body\b/.test(normalized)) {
    return 'upper body';
  }
  if (/\blower body\b/.test(normalized)) {
    return 'lower body';
  }
  if (/\bconditioning|cardio|aerobic\b/.test(normalized)) {
    return 'conditioning';
  }
  if (/\bpush\b/.test(normalized)) {
    return 'push';
  }
  if (/\bpull\b/.test(normalized)) {
    return 'pull';
  }
  return undefined;
}

function isExplicitFullBodyRequest(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return /\b(total|full)\b/.test(normalized);
}

function diagnoseWorkoutCatalogEmpty(
  database: Database.Database,
  query: NormalizedWorkoutCatalogQuery
): WorkoutCatalogDiagnostics {
  const blockerCodes = new Set<
    WorkoutCatalogDiagnostics['blockerCodes'][number]
  >();
  const reasons: string[] = [];

  if (query.normalizedEquipment.length) {
    const relaxedEquipment = countWorkoutCatalogMatches(database, {
      ...query,
      normalizedEquipment: [],
    });
    if (relaxedEquipment > 0) {
      blockerCodes.add('unsupported_equipment');
      reasons.push(`relaxed equipment matches=${relaxedEquipment}`);
    }
  }

  if (query.timeMinutes) {
    const relaxedDuration = countWorkoutCatalogMatches(database, {
      ...query,
      timeMinutes: undefined,
    });
    if (relaxedDuration > 0) {
      blockerCodes.add('duration_gap');
      reasons.push(`relaxed duration matches=${relaxedDuration}`);
    }
  }

  if (query.experienceLevel) {
    const relaxedExperience = countWorkoutCatalogMatches(database, {
      ...query,
      experienceLevel: undefined,
    });
    if (relaxedExperience > 0) {
      blockerCodes.add('experience_gap');
      reasons.push(`relaxed experience matches=${relaxedExperience}`);
    }
  }

  if (query.normalizedDisallowedStressors.length) {
    const relaxedStressors = countWorkoutCatalogMatches(database, {
      ...query,
      normalizedDisallowedStressors: [],
    });
    if (relaxedStressors > 0) {
      blockerCodes.add('stressor_conflict');
      reasons.push(`relaxed stressors matches=${relaxedStressors}`);
    }
  }

  if (!blockerCodes.size) {
    blockerCodes.add('constraint_conflict');
  }

  return {
    blockerCodes: [...blockerCodes],
    candidateCount: 0,
    reasons,
  };
}

function countWorkoutCatalogMatches(
  database: Database.Database,
  query: NormalizedWorkoutCatalogQuery
): number {
  const rows = database
    .prepare(buildWorkoutCatalogMatchSql(query))
    .all(...buildWorkoutCatalogMatchParams({ ...query, limit: 1 })) as
    | WorkoutCatalogRecipeRow[]
    | [];
  return rows.length;
}

function listWorkoutCatalogValues(
  database: Database.Database,
  tableName: string,
  recipeId: string,
  valueColumn: string
): string[] {
  const rows = database
    .prepare(
      `SELECT ${valueColumn} as value FROM ${tableName} WHERE recipe_id = ? ORDER BY value ASC`
    )
    .all(recipeId) as Array<{ value: string }>;
  return rows.map((row) => row.value);
}

function listWorkoutCatalogTags(
  database: Database.Database,
  recipeId: string,
  tagType: string
): string[] {
  const rows = database
    .prepare(
      `SELECT tag FROM workout_catalog_recipe_tags WHERE recipe_id = ? AND tag_type = ? ORDER BY tag ASC`
    )
    .all(recipeId, tagType) as Array<{ tag: string }>;
  return rows.map((row) => row.tag);
}

function listWorkoutCatalogConstraints(
  database: Database.Database,
  recipeId: string
): Record<string, string[]> {
  const rows = database
    .prepare(
      `SELECT constraint_type, value
        FROM workout_catalog_recipe_constraints
        WHERE recipe_id = ?
        ORDER BY constraint_type ASC, value ASC`
    )
    .all(recipeId) as Array<{ constraint_type: string; value: string }>;
  const constraints: Record<string, string[]> = {};
  for (const row of rows) {
    constraints[row.constraint_type] ??= [];
    constraints[row.constraint_type].push(row.value);
  }
  return constraints;
}

function mapWorkoutCatalogBlock(
  database: Database.Database,
  recipeId: string,
  block: WorkoutCatalogBlockRow
): WorkoutCatalogBlock {
  const rows = database
    .prepare(
      `${BASE_SELECT_SQL},
        ws.block_id,
        ws.slot_id,
        ws.slot_order,
        ws.role,
        ws.prescription,
        ws.detail,
        ws.intensity
      FROM workout_catalog_slots ws
      JOIN exercises e ON e.id = ws.exercise_id
      WHERE ws.recipe_id = ? AND ws.block_id = ?
      ORDER BY ws.slot_order ASC`
    )
    .all(recipeId, block.block_id) as WorkoutCatalogSlotRow[];

  return {
    id: block.block_id,
    order: block.block_order,
    title: block.title,
    durationMinutes: block.duration_minutes,
    focus: block.focus,
    slots: rows.map((row) => mapWorkoutCatalogSlot(database, recipeId, row)),
  };
}

function mapWorkoutCatalogSlot(
  database: Database.Database,
  recipeId: string,
  row: WorkoutCatalogSlotRow
): WorkoutCatalogSlot {
  return {
    id: row.slot_id,
    order: row.slot_order,
    exercise: mapExerciseRow(row),
    role: row.role as WorkoutCatalogSlot['role'],
    prescription: row.prescription,
    detail: row.detail,
    intensity: row.intensity,
    substitutionExerciseIds: listWorkoutSlotSubstitutions(
      database,
      recipeId,
      row.block_id,
      row.slot_id
    ),
  };
}

function listWorkoutSlotSubstitutions(
  database: Database.Database,
  recipeId: string,
  blockId: string,
  slotId: string
): string[] {
  const rows = database
    .prepare(
      `SELECT exercise_id
        FROM workout_catalog_slot_substitutions
        WHERE recipe_id = ? AND block_id = ? AND slot_id = ?
        ORDER BY substitution_order ASC`
    )
    .all(recipeId, blockId, slotId) as Array<{ exercise_id: string }>;
  return rows.map((row) => row.exercise_id);
}

function materializeWorkoutCatalogPlan(
  database: Database.Database,
  recipe: WorkoutCatalogRecipe,
  query: NormalizedWorkoutCatalogQuery
): WorkoutCatalogMatch['plan'] {
  const targetDurationMinutes = Math.max(
    query.timeMinutes ?? recipe.targetDurationMinutes,
    recipe.blocks.length
  );
  const blockDurations = scaleWorkoutCatalogBlockDurations(
    recipe.blocks,
    targetDurationMinutes
  );

  return {
    id: `library:${recipe.slug}`,
    focus: recipe.focus,
    durationMinutes: targetDurationMinutes,
    equipment: recipe.equipment,
    source: 'library',
    energy: resolveWorkoutCatalogPlanEnergy(recipe, query),
    summary: recipe.summary,
    blocks: recipe.blocks.map((block, index) => ({
      id: `${recipe.slug}:${block.id}`,
      title: block.title,
      durationMinutes: blockDurations[index] ?? block.durationMinutes,
      focus: block.focus,
      exercises: block.slots.map((slot) => {
        const exercise = selectWorkoutCatalogSlotExercise(
          database,
          slot,
          query
        );
        return {
          id: `${exercise.id}:${block.id}:${slot.id}`,
          name: exercise.name,
          prescription: slot.prescription,
          detail: slot.detail,
        };
      }),
    })),
  };
}

function resolveWorkoutCatalogPlanEnergy(
  recipe: WorkoutCatalogRecipe,
  query: NormalizedWorkoutCatalogQuery
): WorkoutCatalogEnergy {
  if (query.energy && recipe.energyLevels.includes(query.energy)) {
    return query.energy;
  }

  return recipe.energyLevels[0] ?? 'moderate';
}

function scaleWorkoutCatalogBlockDurations(
  blocks: WorkoutCatalogBlock[],
  targetDurationMinutes: number
): number[] {
  const originalTotal = blocks.reduce(
    (total, block) => total + block.durationMinutes,
    0
  );
  if (
    !Number.isFinite(targetDurationMinutes) ||
    targetDurationMinutes <= 0 ||
    originalTotal <= 0 ||
    targetDurationMinutes === originalTotal
  ) {
    return blocks.map((block) => block.durationMinutes);
  }

  const allocations = blocks.map((block, index) => {
    const raw = (block.durationMinutes * targetDurationMinutes) / originalTotal;
    const floor = Math.floor(raw);
    return {
      index,
      duration: Math.max(1, floor),
      fractional: raw - floor,
    };
  });

  let allocatedTotal = allocations.reduce(
    (total, allocation) => total + allocation.duration,
    0
  );

  if (allocatedTotal > targetDurationMinutes) {
    const reducible = allocations
      .slice()
      .sort(
        (left, right) =>
          right.duration - left.duration || left.fractional - right.fractional
      );
    for (const allocation of reducible) {
      while (
        allocation.duration > 1 &&
        allocatedTotal > targetDurationMinutes
      ) {
        allocation.duration -= 1;
        allocatedTotal -= 1;
      }
      if (allocatedTotal === targetDurationMinutes) {
        break;
      }
    }
  }

  if (allocatedTotal < targetDurationMinutes) {
    const expandable = allocations
      .slice()
      .sort(
        (left, right) =>
          right.fractional - left.fractional || left.index - right.index
      );
    let cursor = 0;
    while (allocatedTotal < targetDurationMinutes && expandable.length > 0) {
      expandable[cursor % expandable.length].duration += 1;
      allocatedTotal += 1;
      cursor += 1;
    }
  }

  return allocations
    .sort((left, right) => left.index - right.index)
    .map((allocation) => allocation.duration);
}

function selectWorkoutCatalogSlotExercise(
  database: Database.Database,
  slot: WorkoutCatalogSlot,
  query: NormalizedWorkoutCatalogQuery
): ExerciseRecord {
  if (!query.normalizedRecentExerciseIds.includes(slot.exercise.id)) {
    return slot.exercise;
  }

  const substituteId = slot.substitutionExerciseIds.find(
    (id) => !query.normalizedRecentExerciseIds.includes(id)
  );
  if (!substituteId) {
    return slot.exercise;
  }

  const row = database
    .prepare(`${BASE_SELECT_SQL} FROM exercises e WHERE e.id = ? LIMIT 1`)
    .get(substituteId) as ExerciseRow | undefined;

  return row ? mapExerciseRow(row) : slot.exercise;
}

function diagnoseEmptyResult(
  library: ExerciseLibrary,
  query: CandidateQuery
): CandidateDiagnostics {
  const blockerCodes = new Set<CandidateDiagnostics['blockerCodes'][number]>();
  const counts: CandidateDiagnostics['counts'] = {};

  if (query.availableEquipment?.length) {
    counts.relaxedEquipment = library.countEligibleExercises({
      ...query,
      availableEquipment: undefined,
    });
    if (counts.relaxedEquipment > 0) {
      blockerCodes.add('unsupported_equipment');
    }
  }

  if (query.focusTags?.length) {
    counts.relaxedFocus = library.countEligibleExercises({
      ...query,
      focusTags: undefined,
    });
    if (counts.relaxedFocus > 0) {
      blockerCodes.add('focus_gap');
    }
  }

  if (query.blockRole) {
    counts.relaxedRole = library.countEligibleExercises({
      ...query,
      blockRole: undefined,
    });
    if (counts.relaxedRole > 0) {
      blockerCodes.add('role_gap');
    }
  }

  if (query.disallowedStressors?.length) {
    counts.relaxedStressors = library.countEligibleExercises({
      ...query,
      disallowedStressors: undefined,
    });
    if (counts.relaxedStressors > 0) {
      blockerCodes.add('stressor_conflict');
    }
  }

  counts.lowerCompleteness = library.countEligibleExercises({
    ...query,
    minimumMetadataCompleteness: 'curated',
  });
  if (counts.lowerCompleteness > 0) {
    blockerCodes.add('planner_ready_gap');
  }

  if (!blockerCodes.size) {
    blockerCodes.add('constraint_conflict');
  }

  return {
    blockerCodes: [...blockerCodes],
    counts,
  };
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
  countOnly: boolean
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
      normalizeEquipmentId
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
      'EXISTS (SELECT 1 FROM exercise_roles er WHERE er.exercise_id = e.id AND er.role = ?)'
    );
    params.push(query.blockRole);
  }

  if (query.contraindicationTags?.length) {
    addTagExclusionCondition(
      conditions,
      params,
      'contraindication',
      query.contraindicationTags
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
      query.disallowedStressors
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
  params: Array<string | number>
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
  params: Array<string | number>
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
  tags: string[]
): void {
  const placeholders = tags.map(() => '?').join(', ');
  conditions.push(
    `EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = ? AND et.tag IN (${placeholders}))`
  );
  params.push(tagType, ...tags);
}

function addTagExclusionCondition(
  conditions: string[],
  params: Array<string | number>,
  tagType: string,
  tags: string[]
): void {
  const placeholders = tags.map(() => '?').join(', ');
  conditions.push(
    `NOT EXISTS (SELECT 1 FROM exercise_tags et WHERE et.exercise_id = e.id AND et.tag_type = ? AND et.tag IN (${placeholders}))`
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
      row.allowed_roles_json
    ) as ExerciseRecord['allowedRoles'],
    metadataCompleteness: row.metadata_completeness,
    sortKey: row.sort_key,
    sourceRefs: JSON.parse(
      row.source_refs_json
    ) as ExerciseRecord['sourceRefs'],
  };
}

function parseJsonArray(value: string): string[] {
  return JSON.parse(value) as string[];
}
