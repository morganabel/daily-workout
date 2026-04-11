import { readFile } from 'node:fs/promises';
import {
  ensureDirectories,
  normalizeTag,
  paths,
  readJson,
  slugify,
  writeJson,
} from './_common.js';

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

  if (source.equipment) {
    required.add(resolveEquipment(source.equipment));
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
  )
    tags.add('vertical_pull');
  if (name.includes('run') || name.includes('walk') || name.includes('jog'))
    tags.add('gait');

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
  )
    return 'high';
  if (
    source.category === 'cardio' ||
    name.includes('run') ||
    name.includes('jog')
  )
    return 'moderate';
  return 'low';
}

function deriveNoiseLevel(source) {
  const name = source.name.toLowerCase();
  if (source.category === 'stretching') return 'quiet';
  if (
    name.includes('jump') ||
    source.category === 'plyometrics' ||
    source.category === 'strongman'
  )
    return 'loud';
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
  )
    return 'large';
  if (source.category === 'plyometrics' || source.category === 'strongman')
    return 'medium';
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
  if (source.category === 'strongman' || source.category === 'powerlifting')
    return 'heavy';
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

function mergeRecord(base, override) {
  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    aliases: buildTagSet([
      ...(base.aliases ?? []),
      ...(override.aliases ?? []),
    ]),
    requiredEquipment: buildTagSet(
      override.requiredEquipment ?? base.requiredEquipment,
    ),
    optionalEquipment: buildTagSet(
      override.optionalEquipment ?? base.optionalEquipment,
    ),
    focusTags: buildTagSet(override.focusTags ?? base.focusTags),
    movementTags: buildTagSet(override.movementTags ?? base.movementTags),
    styleTags: buildTagSet(override.styleTags ?? base.styleTags),
    stressorTags: buildTagSet(override.stressorTags ?? base.stressorTags),
    contraindicationTags: buildTagSet(
      override.contraindicationTags ?? base.contraindicationTags,
    ),
    avoidTags: buildTagSet(override.avoidTags ?? base.avoidTags),
    allowedRoles: buildTagSet(override.allowedRoles ?? base.allowedRoles),
  };
}

const [sourceSnapshot, sourceManifest, equipmentVocab, overridesText] =
  await Promise.all([
    readJson(paths.sourceSnapshot),
    readJson(paths.sourceManifest),
    readJson(paths.equipmentVocab),
    readFile(paths.overrides, 'utf8'),
  ]);

const overrides = JSON.parse(overridesText);
const resolveEquipment = buildEquipmentResolver(equipmentVocab);

await ensureDirectories();

const canonical = sourceSnapshot.map((source, index) => {
  const requiredEquipment = deriveRequiredEquipment(source, resolveEquipment);
  const slug = slugify(source.id);
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

  return mergeRecord(base, overrides[source.id]);
});

const plannerReadyCount = canonical.filter(
  (exercise) => exercise.metadataCompleteness === 'planner-ready',
).length;

await writeJson(paths.generatedCanonical, canonical);
await writeJson(paths.generatedManifest, {
  libraryVersion: `${sourceManifest.upstreamCommit.slice(0, 12)}-${plannerReadyCount}`,
  sourceVersion: sourceManifest.upstreamCommit,
  builtAt: new Date().toISOString(),
  exerciseCount: canonical.length,
  plannerReadyCount,
});

console.log(
  `Built canonical exercise dataset with ${canonical.length} records (${plannerReadyCount} planner-ready)`,
);
