import { readFile } from 'node:fs/promises';
import {
  ensureDirectories,
  normalizeTag,
  paths,
  readJson,
  slugify,
  writeJson,
} from './_common.js';

const HIGH_RISK_CATEGORIES = new Set([
  'plyometrics',
  'powerlifting',
  'olympic weightlifting',
  'strongman',
]);

const MEDIUM_RISK_EQUIPMENT = new Set([
  'barbell',
  'kettlebell',
  'medicine_ball',
  'exercise_ball',
  'ez_curl_bar',
  'sandbag',
]);

const HIGH_RISK_TEXT_PROBES = [
  'behind the neck',
  'burpee',
  'clean',
  'clap',
  'depth jump',
  'dip',
  'handstand',
  'jerk',
  'jump',
  'muscle up',
  'pistol squat',
  'snatch',
  'sprint',
];

function buildEquipmentResolver(equipmentVocab) {
  const aliasMap = new Map();
  for (const entry of equipmentVocab.items) {
    aliasMap.set(entry.id, entry.id);
    aliasMap.set(entry.label.toLowerCase(), entry.id);
    for (const alias of entry.aliases) {
      aliasMap.set(alias.toLowerCase(), entry.id);
    }
  }

  return (value) => {
    const normalized = value.trim().toLowerCase();
    return aliasMap.get(normalized) ?? normalizeTag(value);
  };
}

function buildTagSet(value) {
  return [...new Set(value.filter(Boolean))].sort();
}

function maybeContainsText(text, probes) {
  const haystack = text.toLowerCase();
  return probes.some((probe) => haystack.includes(probe));
}

function deriveRequiredEquipment(source, resolveEquipment) {
  const text = `${source.name} ${source.instructions.join(' ')}`.toLowerCase();
  const required = new Set();
  const sourceEquipment = source.equipment
    ? resolveEquipment(source.equipment)
    : null;

  if (sourceEquipment && sourceEquipment !== 'other') {
    required.add(sourceEquipment);
  }

  if (text.includes('incline bench')) {
    required.add('incline_bench');
  } else if (text.includes('bench')) {
    required.add('bench');
  }

  if (maybeContainsText(text, ['pull-up bar', 'pullup bar', 'chin-up bar'])) {
    required.add('pull_up_bar');
  }

  if (maybeContainsText(text, ['squat rack', 'power rack'])) {
    required.add('squat_rack');
  }

  if (maybeContainsText(text, ['treadmill'])) {
    required.add('treadmill');
  }

  if (maybeContainsText(text, ['rowing machine', 'rower', 'erg'])) {
    required.add('rowing_machine');
  }

  if (maybeContainsText(text, ['jump rope', 'rope jumping'])) {
    required.add('jump_rope');
  }

  if (maybeContainsText(text, ['sandbag'])) {
    required.add('sandbag');
  }

  if (
    maybeContainsText(text, [
      'resistance band',
      'resistance bands',
      ' band ',
      ' bands ',
      'banded',
    ])
  ) {
    required.add('resistance_bands');
  }

  if (
    maybeContainsText(text, [
      'chin-up',
      'chin up',
      'pull-up',
      'pull up',
      'chins',
    ])
  ) {
    required.add('pull_up_bar');
    required.add('bodyweight');
  }

  if (maybeContainsText(text, ['kettlebell', 'kettlebells'])) {
    required.add('kettlebell');
  }

  if (maybeContainsText(text, ['dumbbell', 'dumbbells'])) {
    required.add('dumbbell');
  }

  if (maybeContainsText(text, ['barbell'])) {
    required.add('barbell');
  }

  if (maybeContainsText(text, ['ez-bar', 'ez bar', 'e-z bar', 'ez curl'])) {
    required.add('ez_curl_bar');
  }

  if (
    maybeContainsText(text, ['exercise ball', 'stability ball', 'swiss ball'])
  ) {
    required.add('exercise_ball');
  }

  if (maybeContainsText(text, ['medicine ball'])) {
    required.add('medicine_ball');
  }

  if (maybeContainsText(text, ['foam roll', 'foam roller'])) {
    required.add('foam_roller');
  }

  if (sourceEquipment === 'other' && required.size === 0) {
    required.add('other');
  }

  return [...required].sort();
}

function deriveFocusTags(source) {
  const tags = new Set();
  const muscles = [...source.primaryMuscles, ...source.secondaryMuscles].map(
    normalizeTag,
  );
  muscles.forEach((muscle) => tags.add(muscle));

  if (
    muscles.some((muscle) =>
      [
        'chest',
        'shoulders',
        'triceps',
        'biceps',
        'lats',
        'middle_back',
        'traps',
        'forearms',
      ].includes(muscle),
    )
  ) {
    tags.add('upper_body');
  }

  if (
    muscles.some((muscle) =>
      [
        'quadriceps',
        'hamstrings',
        'glutes',
        'calves',
        'abductors',
        'adductors',
      ].includes(muscle),
    )
  ) {
    tags.add('lower_body');
  }

  if (muscles.some((muscle) => ['abdominals', 'lower_back'].includes(muscle))) {
    tags.add('core');
  }

  if (source.category === 'cardio') {
    tags.add('conditioning');
  }

  if (source.category === 'stretching') {
    tags.add('mobility');
    tags.add('recovery');
  }

  return buildTagSet([...tags]);
}

function deriveMovementTags(source) {
  const tags = new Set();
  if (source.force) {
    tags.add(normalizeTag(source.force));
  }
  if (source.mechanic) {
    tags.add(normalizeTag(source.mechanic));
  }

  const name = source.name.toLowerCase();
  if (name.includes('squat')) tags.add('squat');
  if (name.includes('deadlift') || name.includes('good morning'))
    tags.add('hinge');
  if (name.includes('lunge') || name.includes('step up')) tags.add('lunge');
  if (name.includes('carry')) tags.add('carry');
  if (name.includes('press')) tags.add('press');
  if (name.includes('row')) tags.add('row');
  if (name.includes('curl')) tags.add('curl');
  if (
    name.includes('pull-up') ||
    name.includes('pullup') ||
    name.includes('chin-up')
  ) {
    tags.add('vertical_pull');
  }
  if (name.includes('run') || name.includes('walk') || name.includes('jog')) {
    tags.add('gait');
  }

  return buildTagSet([...tags]);
}

function deriveStyleTags(source) {
  const tags = new Set([normalizeTag(source.category)]);
  if (source.category === 'strength' || source.category === 'powerlifting') {
    tags.add('strength');
  }
  if (source.category === 'cardio') {
    tags.add('conditioning');
    tags.add('cardio');
  }
  if (source.category === 'stretching') {
    tags.add('mobility');
    tags.add('recovery');
  }
  if (source.category === 'strongman') {
    tags.add('strongman');
  }
  if (source.category === 'plyometrics') {
    tags.add('conditioning');
    tags.add('plyometrics');
  }
  return buildTagSet([...tags]);
}

function deriveStressorTags(source, equipment) {
  const tags = new Set();
  const name = source.name.toLowerCase();
  const muscles = [...source.primaryMuscles, ...source.secondaryMuscles].map(
    normalizeTag,
  );

  if (
    muscles.some((muscle) =>
      [
        'quadriceps',
        'hamstrings',
        'glutes',
        'calves',
        'adductors',
        'abductors',
      ].includes(muscle),
    )
  ) {
    tags.add('lower_body_fatigue');
  }

  if (
    source.force === 'push' &&
    muscles.some((muscle) => ['chest', 'shoulders', 'triceps'].includes(muscle))
  ) {
    tags.add('upper_body_push_fatigue');
  }

  if (
    source.force === 'pull' &&
    muscles.some((muscle) =>
      ['lats', 'middle_back', 'traps', 'biceps', 'forearms'].includes(muscle),
    )
  ) {
    tags.add('upper_body_pull_fatigue');
  }

  if (
    equipment.includes('barbell') ||
    name.includes('deadlift') ||
    name.includes('squat')
  ) {
    tags.add('axial_loading');
    tags.add('high_bracing');
  }

  if (name.includes('overhead') || name.includes('press')) {
    tags.add('shoulder_loading');
  }

  if (source.category === 'plyometrics' || name.includes('jump')) {
    tags.add('plyometric');
  }

  if (source.category === 'strongman' || name.includes('carry')) {
    tags.add('grip_heavy');
  }

  return buildTagSet([...tags]);
}

function deriveImpactLevel(source) {
  const name = source.name.toLowerCase();
  if (source.category === 'stretching') return 'none';
  if (
    source.category === 'plyometrics' ||
    name.includes('jump') ||
    name.includes('bound')
  ) {
    return 'high';
  }
  if (
    source.category === 'cardio' ||
    name.includes('run') ||
    name.includes('jog')
  ) {
    return 'moderate';
  }
  return 'low';
}

function deriveNoiseLevel(source) {
  const name = source.name.toLowerCase();
  if (source.category === 'stretching') return 'quiet';
  if (
    name.includes('jump') ||
    source.category === 'plyometrics' ||
    source.category === 'strongman'
  ) {
    return 'loud';
  }
  if (source.category === 'cardio') return 'moderate';
  return 'quiet';
}

function deriveSpaceFootprint(source) {
  const name = source.name.toLowerCase();
  if (
    name.includes('walk') ||
    name.includes('run') ||
    name.includes('drag') ||
    name.includes('carry')
  ) {
    return 'large';
  }
  if (source.category === 'plyometrics' || source.category === 'strongman') {
    return 'medium';
  }
  return 'small';
}

function deriveTravelFriendly(source, requiredEquipment) {
  if (
    requiredEquipment.length === 0 ||
    (requiredEquipment.length === 1 && requiredEquipment[0] === 'bodyweight')
  ) {
    return true;
  }

  return requiredEquipment.every((equipment) =>
    ['bodyweight', 'resistance_bands', 'jump_rope'].includes(equipment),
  );
}

function deriveFloorRequired(source) {
  const text = `${source.name} ${source.instructions.join(' ')}`.toLowerCase();
  return maybeContainsText(text, [
    'lie on the floor',
    'lay on the floor',
    'kneel on the floor',
    'on all your hands and knees',
    'lie flat on the floor',
    'lay flat on the floor',
    'lying on your back',
    'lying face down',
  ]);
}

function mapExperienceLevel(level) {
  if (level === 'expert') {
    return 'advanced';
  }
  return level;
}

function deriveLoadLevel(source) {
  if (source.category === 'stretching') return 'light';
  if (source.category === 'cardio') return 'moderate';
  if (source.category === 'strongman' || source.category === 'powerlifting') {
    return 'heavy';
  }
  return source.mechanic === 'isolation' ? 'light' : 'moderate';
}

function deriveAllowedRoles(source) {
  if (source.category === 'stretching') {
    return ['warmup', 'recovery'];
  }

  if (source.category === 'cardio' || source.category === 'plyometrics') {
    return ['main', 'finisher'];
  }

  if (source.mechanic === 'isolation') {
    return ['accessory'];
  }

  return ['main', 'accessory'];
}

function deriveDescription(source) {
  const firstInstruction = source.instructions[0]?.trim();
  if (firstInstruction) {
    return firstInstruction;
  }
  return `${source.name} exercise.`;
}

function mergeRecord(base, patch) {
  if (!patch) {
    return base;
  }

  return {
    ...base,
    ...patch,
    aliases: buildTagSet([...(base.aliases ?? []), ...(patch.aliases ?? [])]),
    requiredEquipment: buildTagSet(
      patch.requiredEquipment ?? base.requiredEquipment,
    ),
    optionalEquipment: buildTagSet(
      patch.optionalEquipment ?? base.optionalEquipment,
    ),
    focusTags: buildTagSet([
      ...(base.focusTags ?? []),
      ...(patch.focusTags ?? []),
    ]),
    movementTags: buildTagSet([
      ...(base.movementTags ?? []),
      ...(patch.movementTags ?? []),
    ]),
    styleTags: buildTagSet([
      ...(base.styleTags ?? []),
      ...(patch.styleTags ?? []),
    ]),
    stressorTags: buildTagSet([
      ...(base.stressorTags ?? []),
      ...(patch.stressorTags ?? []),
    ]),
    contraindicationTags: buildTagSet([
      ...(base.contraindicationTags ?? []),
      ...(patch.contraindicationTags ?? []),
    ]),
    avoidTags: buildTagSet([
      ...(base.avoidTags ?? []),
      ...(patch.avoidTags ?? []),
    ]),
    allowedRoles: buildTagSet([
      ...(base.allowedRoles ?? []),
      ...(patch.allowedRoles ?? []),
    ]),
  };
}

function hasTag(record, field, value) {
  return record[field].includes(value);
}

function textFor(source) {
  return `${source.name} ${source.instructions.join(' ')}`.toLowerCase();
}

function deriveFamilyKey(source, record) {
  const text = textFor(source);
  const isStretching = source.category === 'stretching';
  const isCardio = source.category === 'cardio';
  const has = (equipmentId) => record.requiredEquipment.includes(equipmentId);

  if (isStretching) {
    return record.floorRequired ||
      maybeContainsText(text, ['lying', 'lie', 'kneel'])
      ? 'bodyweight_mobility_floor'
      : 'bodyweight_mobility_standing';
  }

  if (isCardio && has('rowing_machine')) {
    return 'rower_conditioning';
  }

  if (isCardio && has('treadmill')) {
    return 'treadmill_conditioning';
  }

  if (has('bodyweight')) {
    if (
      has('pull_up_bar') &&
      hasTag(record, 'focusTags', 'upper_body') &&
      (hasTag(record, 'movementTags', 'pull') ||
        hasTag(record, 'movementTags', 'vertical_pull'))
    ) {
      return 'bodyweight_vertical_pull';
    }
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      hasTag(record, 'movementTags', 'push')
    ) {
      return 'bodyweight_push';
    }
    if (
      (hasTag(record, 'focusTags', 'core') ||
        hasTag(record, 'focusTags', 'abdominals')) &&
      (record.floorRequired ||
        maybeContainsText(text, ['lying', 'floor', 'knees']))
    ) {
      return 'bodyweight_core_floor';
    }
    if (
      hasTag(record, 'focusTags', 'lower_body') &&
      record.impactLevel !== 'high' &&
      !maybeContainsText(text, ['jump', 'bound', 'sprint'])
    ) {
      return 'bodyweight_lower_body_low_impact';
    }
  }

  if (has('resistance_bands')) {
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      hasTag(record, 'movementTags', 'pull')
    ) {
      return 'band_upper_pull';
    }
    if (hasTag(record, 'focusTags', 'core') || text.includes('pallof')) {
      return 'band_core';
    }
    if (hasTag(record, 'focusTags', 'lower_body')) {
      return 'band_lower_accessory';
    }
    if (hasTag(record, 'focusTags', 'upper_body')) {
      return 'band_upper_accessory';
    }
  }

  if (has('dumbbell')) {
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      hasTag(record, 'movementTags', 'isolation')
    ) {
      return 'dumbbell_upper_isolation';
    }
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      hasTag(record, 'movementTags', 'press') &&
      (has('bench') || has('incline_bench'))
    ) {
      return 'dumbbell_upper_press_supported';
    }
  }

  if (has('barbell')) {
    if (
      hasTag(record, 'focusTags', 'lower_body') ||
      hasTag(record, 'movementTags', 'squat') ||
      hasTag(record, 'movementTags', 'lunge') ||
      hasTag(record, 'movementTags', 'hinge')
    ) {
      return 'barbell_lower_body';
    }
    if (
      hasTag(record, 'focusTags', 'core') ||
      hasTag(record, 'focusTags', 'abdominals')
    ) {
      return 'barbell_core';
    }
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      hasTag(record, 'movementTags', 'press')
    ) {
      return 'barbell_upper_press';
    }
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      hasTag(record, 'movementTags', 'isolation')
    ) {
      return 'barbell_upper_isolation';
    }
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      (hasTag(record, 'movementTags', 'pull') ||
        hasTag(record, 'movementTags', 'row') ||
        hasTag(record, 'movementTags', 'curl'))
    ) {
      return 'barbell_upper_pull';
    }
  }

  if (has('kettlebell')) {
    if (
      hasTag(record, 'focusTags', 'lower_body') ||
      hasTag(record, 'movementTags', 'squat') ||
      hasTag(record, 'movementTags', 'lunge') ||
      hasTag(record, 'movementTags', 'hinge')
    ) {
      return 'kettlebell_lower_body';
    }
    if (
      hasTag(record, 'focusTags', 'core') ||
      hasTag(record, 'focusTags', 'abdominals')
    ) {
      return 'kettlebell_core';
    }
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      hasTag(record, 'movementTags', 'press')
    ) {
      return 'kettlebell_upper_press';
    }
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      (hasTag(record, 'movementTags', 'pull') ||
        hasTag(record, 'movementTags', 'row') ||
        hasTag(record, 'movementTags', 'curl'))
    ) {
      return 'kettlebell_upper_pull';
    }
  }

  if (has('ez_curl_bar') && hasTag(record, 'focusTags', 'upper_body')) {
    if (
      hasTag(record, 'movementTags', 'pull') ||
      hasTag(record, 'movementTags', 'curl') ||
      hasTag(record, 'movementTags', 'row')
    ) {
      return 'ez_bar_upper_pull';
    }
    if (
      hasTag(record, 'movementTags', 'push') ||
      hasTag(record, 'movementTags', 'press')
    ) {
      return 'ez_bar_upper_push';
    }
  }

  if (has('exercise_ball')) {
    if (
      hasTag(record, 'focusTags', 'core') ||
      hasTag(record, 'focusTags', 'abdominals')
    ) {
      return 'exercise_ball_core';
    }
    if (hasTag(record, 'focusTags', 'lower_body')) {
      return 'exercise_ball_lower_body';
    }
  }

  if (has('cable_machine')) {
    if (hasTag(record, 'focusTags', 'core') || text.includes('pallof')) {
      return 'cable_core';
    }
    if (
      hasTag(record, 'focusTags', 'upper_body') &&
      hasTag(record, 'movementTags', 'pull')
    ) {
      return 'cable_upper_pull';
    }
    if (hasTag(record, 'focusTags', 'upper_body')) {
      return 'cable_upper_accessory';
    }
  }

  if (source.equipment === 'machine' && source.mechanic === 'isolation') {
    return 'machine_isolation';
  }

  return null;
}

function deriveRiskTier(source, record, familyKey, template) {
  if (template?.riskTier) {
    return template.riskTier;
  }

  if (
    HIGH_RISK_CATEGORIES.has(source.category) ||
    record.requiredEquipment.includes('other')
  ) {
    return 'high';
  }

  if (
    record.requiredEquipment.some((equipmentId) =>
      MEDIUM_RISK_EQUIPMENT.has(equipmentId),
    )
  ) {
    return 'medium';
  }

  if (familyKey) {
    return 'medium';
  }

  return 'high';
}

function deriveAmbiguityFlags(source, record, familyKey) {
  const flags = new Set();

  if (record.requiredEquipment.includes('other')) {
    flags.add('unresolved_equipment');
  }

  if (source.equipment == null && record.requiredEquipment.length === 0) {
    flags.add('source_equipment_missing');
  }

  if (
    source.equipment === 'other' &&
    record.requiredEquipment.every((equipmentId) => equipmentId === 'other')
  ) {
    flags.add('source_equipment_other');
  }

  if (source.equipment === 'machine' && !familyKey) {
    flags.add('generic_machine_setup');
  }

  if (source.category === 'strength' && source.mechanic == null && !familyKey) {
    flags.add('missing_mechanic');
  }

  if (source.category === 'strength' && source.force == null && !familyKey) {
    flags.add('missing_force');
  }

  return [...flags].sort();
}

function hasHighRiskText(source) {
  const text = textFor(source);
  return maybeContainsText(text, HIGH_RISK_TEXT_PROBES);
}

function derivePromotionBlockers(
  source,
  record,
  familyKey,
  template,
  riskTier,
  ambiguityFlags,
) {
  const blockers = new Set(ambiguityFlags);

  if (!familyKey) {
    blockers.add('no_family_template');
  }

  if (riskTier !== 'low') {
    blockers.add('risk_tier_not_low');
  }

  if (hasHighRiskText(source)) {
    blockers.add('high_risk_text');
  }

  if (!record.description || !record.instructionSteps.length) {
    blockers.add('missing_text');
  }

  if (
    !record.focusTags.length ||
    !record.movementTags.length ||
    !record.styleTags.length
  ) {
    blockers.add('missing_core_tags');
  }

  if (!record.allowedRoles.length) {
    blockers.add('missing_roles');
  }

  if (template?.autoPromote && record.requiredEquipment.length === 0) {
    blockers.add('missing_required_equipment');
  }

  return [...blockers].sort();
}

function deriveMetadataCompleteness(
  baseCompleteness,
  override,
  template,
  blockers,
) {
  if (
    Object.prototype.hasOwnProperty.call(override ?? {}, 'metadataCompleteness')
  ) {
    return override.metadataCompleteness;
  }

  if (template?.autoPromote && blockers.length === 0) {
    return 'planner-ready';
  }

  if (override) {
    return 'curated';
  }

  return baseCompleteness;
}

function derivePromotionSource(override, template, blockers) {
  if (
    Object.prototype.hasOwnProperty.call(override ?? {}, 'metadataCompleteness')
  ) {
    return 'override';
  }

  if (template?.autoPromote && blockers.length === 0) {
    return 'template-auto';
  }

  if (override) {
    return 'override-curated';
  }

  if (template) {
    return 'template-derived';
  }

  return 'derived';
}

function countBy(records, keySelector) {
  const counts = new Map();
  for (const record of records) {
    const key = keySelector(record) ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function buildReadinessReport(canonical, sourceSnapshot) {
  const sourceById = new Map(
    sourceSnapshot.map((record) => [record.id, record]),
  );
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
    countsByCategory: countBy(
      canonical,
      (exercise) => sourceById.get(exercise.sourceId)?.category,
    ),
    countsByEquipment: countBy(
      canonical,
      (exercise) => sourceById.get(exercise.sourceId)?.equipment ?? 'null',
    ),
    blockerCounts: Object.fromEntries(
      [...blockerCounts.entries()].sort((a, b) => b[1] - a[1]),
    ),
    plannerReadySample: plannerReady.slice(0, 50).map((exercise) => ({
      id: exercise.id,
      sourceId: exercise.sourceId,
      familyKey: exercise.familyKey,
      promotionSource: exercise.promotionSource,
    })),
    promotionCandidates: canonical
      .filter(
        (exercise) =>
          exercise.riskTier === 'low' &&
          exercise.metadataCompleteness !== 'planner-ready' &&
          (exercise.promotionBlockers?.length ?? 0) <= 2,
      )
      .slice(0, 100)
      .map((exercise) => ({
        id: exercise.id,
        sourceId: exercise.sourceId,
        familyKey: exercise.familyKey,
        promotionBlockers: exercise.promotionBlockers,
      })),
  };
}

const [
  sourceSnapshot,
  sourceManifest,
  equipmentVocab,
  templates,
  overridesText,
] = await Promise.all([
  readJson(paths.sourceSnapshot),
  readJson(paths.sourceManifest),
  readJson(paths.equipmentVocab),
  readJson(paths.templates),
  readFile(paths.overrides, 'utf8'),
]);

const overrides = JSON.parse(overridesText);
const resolveEquipment = buildEquipmentResolver(equipmentVocab);

await ensureDirectories();

const canonical = sourceSnapshot.map((source, index) => {
  const requiredEquipment = deriveRequiredEquipment(source, resolveEquipment);
  const slug = slugify(source.id);
  const override = overrides[source.id];
  const base = {
    id: `fedb:${slug}`,
    sourceId: source.id,
    slug,
    name: source.name,
    aliases: [],
    description: deriveDescription(source),
    instructionSteps: source.instructions,
    requiredEquipment,
    optionalEquipment: [],
    focusTags: deriveFocusTags(source),
    movementTags: deriveMovementTags(source),
    styleTags: deriveStyleTags(source),
    stressorTags: deriveStressorTags(source, requiredEquipment),
    contraindicationTags: [],
    avoidTags: [],
    impactLevel: deriveImpactLevel(source),
    noiseLevel: deriveNoiseLevel(source),
    spaceFootprint: deriveSpaceFootprint(source),
    travelFriendly: deriveTravelFriendly(source, requiredEquipment),
    floorRequired: deriveFloorRequired(source),
    experienceLevelMin: mapExperienceLevel(source.level),
    loadLevel: deriveLoadLevel(source),
    allowedRoles: deriveAllowedRoles(source),
    metadataCompleteness: 'derived',
    sortKey: (index + 1) * 10,
    sourceRefs: [
      {
        source: 'free-exercise-db',
        sourceId: source.id,
        sourceVersion: `github:yuhonas/free-exercise-db@${sourceManifest.upstreamCommit}`,
      },
    ],
  };

  const familyKey = deriveFamilyKey(source, base);
  const template = familyKey ? templates[familyKey] : undefined;
  const templated = mergeRecord(base, template);
  const merged = mergeRecord(templated, override);
  const riskTier = deriveRiskTier(source, merged, familyKey, template);
  const ambiguityFlags = deriveAmbiguityFlags(source, merged, familyKey);
  const promotionBlockers = derivePromotionBlockers(
    source,
    merged,
    familyKey,
    template,
    riskTier,
    ambiguityFlags,
  );
  const metadataCompleteness = deriveMetadataCompleteness(
    base.metadataCompleteness,
    override,
    template,
    promotionBlockers,
  );
  const promotionSource = derivePromotionSource(
    override,
    template,
    promotionBlockers,
  );

  return {
    ...merged,
    metadataCompleteness,
    familyKey,
    appliedTemplateKey: familyKey,
    riskTier,
    ambiguityFlags,
    promotionBlockers,
    promotionSource,
  };
});

const plannerReadyCount = canonical.filter(
  (exercise) => exercise.metadataCompleteness === 'planner-ready',
).length;
const readinessReport = buildReadinessReport(canonical, sourceSnapshot);

await writeJson(paths.generatedCanonical, canonical);
await writeJson(paths.generatedManifest, {
  libraryVersion: `${sourceManifest.upstreamCommit.slice(0, 12)}-${plannerReadyCount}`,
  sourceVersion: sourceManifest.upstreamCommit,
  builtAt: new Date().toISOString(),
  exerciseCount: canonical.length,
  plannerReadyCount,
});
await writeJson(paths.generatedReadinessReport, readinessReport);

console.log(
  `Built canonical exercise dataset with ${canonical.length} records (${plannerReadyCount} planner-ready)`,
);
