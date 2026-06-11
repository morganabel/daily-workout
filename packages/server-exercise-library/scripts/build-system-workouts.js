import { paths, readJson, writeJson } from './_common.js';

const CATALOG_VERSION = '2026.06.09';
const TARGET_RECIPE_COUNT = 81;

const x = {
  catCow: 'ex:00508',
  childPose: 'fedb:childs-pose',
  deadBug: 'fedb:dead-bug',
  plank: 'fedb:plank',
  bodyweightSquat: 'fedb:bodyweight-squat',
  inclinePushUp: 'fedb:incline-push-up',
  pushUp: 'fedb:pushups',
  kneePushUp: 'ex:00215',
  walking: 'ex:00153',
  lunge: 'ex:00683',
  reverseLunge: 'ex:00692',
  walkingLunge: 'ex:01767',
  stepUp: 'fedb:step-up-with-knee-raise',
  gluteBridge: 'fedb:butt-lift-bridge',
  singleLegBridge: 'fedb:single-leg-glute-bridge',
  birdDog: 'ex:00486',
  superman: 'fedb:superman',
  crunch: 'fedb:crunches',
  reverseCrunch: 'fedb:reverse-crunch',
  bicycleCrunch: 'ex:00364',
  airBike: 'fedb:air-bike',
  cycling: 'ex:00056',
  elliptical: 'ex:00022',
  jogInPlace: 'ex:00498',
  hamstringStretch: 'fedb:hamstring-stretch',
  chestStretch: 'fedb:behind-head-chest-stretch',
  armCircles: 'fedb:arm-circles',
  treadmillWalk: 'fedb:walking-treadmill',
  treadmillJog: 'fedb:jogging-treadmill',
  treadmillRun: 'fedb:running-treadmill',
  inclineTreadmill: 'ex:02157',
  rower: 'fedb:rowing-stationary',
  rowerMachine: 'ex:00160',

  dumbbellBenchPress: 'fedb:dumbbell-bench-press',
  dumbbellFloorPress: 'fedb:dumbbell-floor-press',
  dumbbellShoulderPress: 'fedb:dumbbell-shoulder-press',
  arnoldPress: 'fedb:arnold-dumbbell-press',
  inclineDumbbellPress: 'fedb:incline-dumbbell-press',
  dumbbellFly: 'fedb:dumbbell-flyes',
  dumbbellStepUp: 'fedb:dumbbell-step-ups',
  dumbbellBicepCurl: 'fedb:dumbbell-bicep-curl',
  hammerCurl: 'fedb:hammer-curls',
  concentrationCurl: 'fedb:concentration-curls',
  sideLateralRaise: 'fedb:side-lateral-raise',
  dumbbellScaption: 'fedb:dumbbell-scaption',
  rearDeltRaise: 'fedb:seated-bent-over-rear-delt-raise',
  dumbbellShrug: 'fedb:dumbbell-shrug',
  dumbbellTricepsExtension: 'fedb:standing-dumbbell-triceps-extension',
  seatedTricepsPress: 'fedb:seated-triceps-press',
  inclineBenchPull: 'fedb:incline-bench-pull',
  dumbbellOverheadCarry: 'ex:02133',

  bandGoodMorning: 'fedb:band-good-morning',
  bandPullApart: 'fedb:band-pull-apart',
  bandShoulderPress: 'fedb:shoulder-press-with-bands',
  bandBenchPress: 'fedb:bench-press-with-bands',
  bandSquat: 'fedb:squat-with-bands',
  bandDeadlift: 'fedb:deadlift-with-bands',
  bandHipExtension: 'fedb:hip-extension-with-bands',
  bandLegExtension: 'ex:02032',
  bandCalfRaise: 'ex:01695',
  bandRow: 'ex:00670',
  bandFacePull: 'ex:00534',
  bandChestPress: 'ex:02046',
  bandLateralRaise: 'fedb:lateral-raise-with-bands',
  bandLegCurl: 'ex:00511',
  bandSkullCrusher: 'fedb:band-skull-crusher',
  monsterWalk: 'fedb:monster-walk',

  kettlebellSwing: 'ex:00013',
  gobletSquat: 'fedb:goblet-squat',
  kettlebellRow: 'fedb:one-arm-kettlebell-row',
  kettlebellTwoArmRow: 'fedb:two-arm-kettlebell-row',
  kettlebellFloorPress: 'fedb:one-arm-kettlebell-floor-press',
  kettlebellSeatedPress: 'fedb:kettlebell-seated-press',
  kettlebellDeadlift: 'fedb:kettlebell-one-legged-deadlift',

  barbellSquat: 'fedb:barbell-squat',
  boxSquat: 'fedb:box-squat',
  frontSquat: 'fedb:front-barbell-squat',
  barbellDeadlift: 'fedb:barbell-deadlift',
  romanianDeadlift: 'fedb:romanian-deadlift',
  barbellBench: 'fedb:barbell-bench-press-medium-grip',
  barbellInclineBench: 'fedb:barbell-incline-bench-press-medium-grip',
  closeGripBench: 'fedb:close-grip-barbell-bench-press',
  declineBench: 'fedb:decline-barbell-bench-press',
  barbellRow: 'fedb:bent-over-barbell-row',
  barbellShoulderPress: 'fedb:barbell-shoulder-press',
  barbellCurl: 'fedb:barbell-curl',
  barbellGluteBridge: 'fedb:barbell-glute-bridge',
  barbellHipThrust: 'fedb:barbell-hip-thrust',
  barbellLunge: 'fedb:barbell-lunge',
  barbellShrug: 'fedb:barbell-shrug',

  cableRow: 'fedb:seated-cable-rows',
  elevatedCableRow: 'fedb:elevated-cable-rows',
  cableLatPulldown: 'fedb:wide-grip-lat-pulldown',
  cableClosePulldown: 'fedb:close-grip-front-lat-pulldown',
  cableFacePull: 'fedb:face-pull',
  cableStraightArmPulldown: 'fedb:rope-straight-arm-pulldown',
  cableChestPress: 'fedb:cable-chest-press',
  cableInclinePress: 'fedb:incline-cable-chest-press',
  cableShoulderPress: 'fedb:cable-shoulder-press',
  cableRearDeltFly: 'fedb:cable-rear-delt-fly',
  cableRearDeltRow: 'fedb:cable-rope-rear-delt-rows',
  cableCrunch: 'fedb:cable-crunch',
  cableHammerCurl: 'fedb:cable-hammer-curls-rope-attachment',
  cablePreacherCurl: 'fedb:cable-preacher-curl',
  cableDeadlift: 'fedb:cable-deadlifts',
  cableTriceps: 'fedb:cable-rope-overhead-triceps-extension',
  cableTricepsPushdown: 'fedb:triceps-pushdown-rope-attachment',

  pullUp: 'fedb:pullups',
  bandAssistedPullUp: 'fedb:band-assisted-pull-up',
  scapularPullUp: 'fedb:scapular-pull-up',
  sandbagLoad: 'fedb:sandbag-load',

  machineLegExtension: 'fedb:leg-extensions',
  machineSingleLegExtension: 'fedb:single-leg-leg-extension',
  machineLegCurl: 'fedb:lying-leg-curls',
  machineSeatedLegCurl: 'fedb:seated-leg-curl',
  machineCalfPress: 'fedb:calf-press',
  machineAbCrunch: 'fedb:ab-crunch-machine',
  machineButterfly: 'fedb:butterfly',
  machineTriceps: 'fedb:machine-triceps-extension',
  machineBicepCurl: 'fedb:machine-bicep-curl',
  machineReverseFly: 'fedb:reverse-machine-flyes',
  machineShrug: 'fedb:leverage-shrug',
};

function slot(
  id,
  exerciseId,
  role,
  prescription,
  detail,
  intensity = 'moderate',
  substitutionExerciseIds = [],
) {
  return {
    id,
    exerciseId,
    role,
    prescription,
    detail,
    intensity,
    substitutionExerciseIds,
  };
}

function block(id, title, durationMinutes, focus, slots) {
  return {
    id,
    title,
    durationMinutes,
    focus,
    slots,
  };
}

function recipe(definition) {
  return {
    id: `catalog:${definition.slug}`,
    slug: definition.slug,
    ownership: 'system',
    version: 1,
    status: 'active',
    title: definition.title,
    summary: definition.summary,
    focus: definition.focus,
    focusTags: definition.focusTags,
    styleTags: definition.styleTags,
    equipment: definition.equipment,
    environmentTags: definition.environmentTags,
    minExperienceLevel: definition.minExperienceLevel ?? 'beginner',
    durationMinutes: definition.durationMinutes,
    durationRange: definition.durationRange ?? {
      min: Math.max(5, definition.durationMinutes - 5),
      max: definition.durationMinutes + 10,
    },
    energyLevels: definition.energyLevels,
    qualityScore: definition.qualityScore,
    constraints: {
      contraindicationTags: [],
      avoidTags: [],
      disallowedStressors: definition.disallowedStressors ?? [],
    },
    blocks: definition.blocks,
  };
}

// Curated movement families used to derive equipment-valid exercise
// substitutions. Each family lists interchangeable movements ordered roughly
// easiest -> hardest, so the first offered swap is a sensible regression. The
// library's focus/movement tags are too noisy for automatic similarity (e.g.
// Goblet Squat is tagged `shoulders`/`push`), so substitution candidates are
// curated here and then filtered at build time to the recipe's equipment.
const MOVEMENT_FAMILIES = {
  squat: [x.bodyweightSquat, x.gobletSquat, x.bandSquat, x.frontSquat, x.barbellSquat],
  pullUp: [x.scapularPullUp, x.bandAssistedPullUp, x.pullUp],
  hinge: [
    x.gluteBridge, x.singleLegBridge, x.bandGoodMorning, x.bandHipExtension,
    x.bandDeadlift, x.kettlebellDeadlift, x.kettlebellSwing, x.romanianDeadlift,
    x.barbellGluteBridge, x.barbellHipThrust, x.cableDeadlift, x.barbellDeadlift,
  ],
  lunge: [x.stepUp, x.reverseLunge, x.lunge, x.walkingLunge, x.dumbbellStepUp, x.barbellLunge],
  horizontalPush: [
    x.kneePushUp, x.inclinePushUp, x.pushUp, x.dumbbellFloorPress, x.kettlebellFloorPress,
    x.dumbbellBenchPress, x.inclineDumbbellPress, x.dumbbellFly, x.bandChestPress,
    x.bandBenchPress, x.cableChestPress, x.cableInclinePress, x.machineButterfly,
    x.barbellBench, x.barbellInclineBench,
  ],
  verticalPush: [
    x.sideLateralRaise, x.dumbbellScaption, x.bandLateralRaise, x.dumbbellShoulderPress,
    x.arnoldPress, x.bandShoulderPress, x.kettlebellSeatedPress, x.cableShoulderPress,
    x.barbellShoulderPress,
  ],
  horizontalPull: [
    x.bandPullApart, x.bandRow, x.bandFacePull, x.cableFacePull, x.rearDeltRaise,
    x.cableRearDeltFly, x.machineReverseFly, x.inclineBenchPull, x.kettlebellRow,
    x.kettlebellTwoArmRow, x.cableRow, x.elevatedCableRow, x.barbellRow,
  ],
  verticalPull: [
    x.bandAssistedPullUp, x.pullUp, x.cableStraightArmPulldown,
    x.cableClosePulldown, x.cableLatPulldown,
  ],
  core: [
    x.deadBug, x.birdDog, x.plank, x.crunch, x.reverseCrunch, x.bicycleCrunch,
    x.airBike, x.superman, x.cableCrunch, x.machineAbCrunch,
  ],
  bicep: [
    x.dumbbellBicepCurl, x.hammerCurl, x.concentrationCurl, x.cableHammerCurl,
    x.machineBicepCurl, x.barbellCurl,
  ],
  triceps: [x.seatedTricepsPress, x.dumbbellTricepsExtension, x.cableTriceps, x.machineTriceps],
  quadIso: [x.bandLegExtension, x.machineSingleLegExtension, x.machineLegExtension],
  hamIso: [x.bandLegCurl, x.machineSeatedLegCurl, x.machineLegCurl],
  calf: ['ex:00245', x.bandCalfRaise, x.machineCalfPress],
  shrug: [x.dumbbellShrug, x.barbellShrug, x.machineShrug],
  cardio: [
    x.walking, x.jogInPlace, x.cycling, x.elliptical, x.treadmillWalk,
    x.treadmillJog, x.inclineTreadmill, x.treadmillRun, x.rower, x.rowerMachine,
  ],
};

const FAMILY_BY_EXERCISE = new Map();
for (const [family, exerciseIds] of Object.entries(MOVEMENT_FAMILIES)) {
  for (const exerciseId of exerciseIds) {
    if (!FAMILY_BY_EXERCISE.has(exerciseId)) {
      FAMILY_BY_EXERCISE.set(exerciseId, family);
    }
  }
}

const SUBSTITUTABLE_ROLES = new Set(['main', 'accessory']);

// Resolve up to two equipment-valid, planner-ready substitutions for a slot
// from the same movement family and role. Curated substitutions on the slot
// are kept and validated by the catalog validator.
// `offeredSubstitutions` tracks swaps already proposed elsewhere in the recipe
// so limited-equipment recipes still vary their suggestions where possible.
function resolveSubstitutions(
  slot,
  recipeEquipment,
  usedExerciseIds,
  offeredSubstitutions,
  exerciseIndex,
) {
  if (slot.substitutionExerciseIds.length > 0) {
    return slot.substitutionExerciseIds;
  }
  if (!SUBSTITUTABLE_ROLES.has(slot.role)) {
    return [];
  }

  const family = FAMILY_BY_EXERCISE.get(slot.exerciseId);
  if (!family) {
    return [];
  }

  const equipment = new Set([...recipeEquipment, 'bodyweight']);
  const candidates = MOVEMENT_FAMILIES[family]
    .filter((candidateId) => candidateId !== slot.exerciseId)
    .filter((candidateId) => !usedExerciseIds.has(candidateId))
    .filter((candidateId) => {
      const candidate = exerciseIndex.get(candidateId);
      return (
        candidate &&
        candidate.metadataCompleteness === 'planner-ready' &&
        candidate.allowedRoles.includes(slot.role) &&
        candidate.requiredEquipment.every((id) => equipment.has(id))
      );
    });

  // Prefer substitutes not already proposed for another slot in this recipe,
  // preserving the family's easiest-first ordering within each group.
  const fresh = candidates.filter((id) => !offeredSubstitutions.has(id));
  const reused = candidates.filter((id) => offeredSubstitutions.has(id));
  const selected = [...fresh, ...reused].slice(0, 2);
  for (const id of selected) {
    offeredSubstitutions.add(id);
  }
  return selected;
}

// Derive recipe-level contraindication/avoid advisories from the exercises the
// recipe actually programs. This keeps the constraint summary accurate (rather
// than an empty placeholder) so it can describe stressors present in the
// workout for display and future recipe-level filtering.
function deriveRecipeConstraints(recipe, exerciseIndex) {
  const contraindicationTags = new Set();
  const avoidTags = new Set();
  for (const block of recipe.blocks) {
    for (const slot of block.slots) {
      const exercise = exerciseIndex.get(slot.exerciseId);
      if (!exercise) {
        continue;
      }
      for (const tag of exercise.contraindicationTags ?? []) {
        contraindicationTags.add(tag);
      }
      for (const tag of exercise.avoidTags ?? []) {
        avoidTags.add(tag);
      }
    }
  }
  return {
    contraindicationTags: [...contraindicationTags].sort(),
    avoidTags: [...avoidTags].sort(),
    disallowedStressors: recipe.constraints.disallowedStressors,
  };
}

function mobilityPrep(durationMinutes = 6) {
  return block('prep', 'Prep', durationMinutes, 'Mobility and trunk control', [
    slot('cat-cow', x.catCow, 'warmup', '60 seconds', 'Move slowly through the spine.', 'easy'),
    slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Keep ribs down and exhale with each reach.', 'easy'),
  ]);
}

function recoveryFinish(durationMinutes = 5) {
  return block('finish', 'Cooldown', durationMinutes, 'Easy recovery', [
    slot('child-pose', x.childPose, 'recovery', '2 minutes', 'Let the breath slow down.', 'easy'),
    slot('hamstring-stretch', x.hamstringStretch, 'recovery', '60 seconds per side', 'Keep the stretch mild.', 'easy'),
  ]);
}

const recipes = [
  recipe({
    slug: 'bodyweight-foundation-30',
    title: 'Bodyweight Foundation',
    summary: 'A balanced bodyweight session with squat, push, core, and easy conditioning work.',
    focus: 'Full Body Strength',
    focusTags: ['full_body', 'lower_body', 'upper_body', 'core'],
    styleTags: ['strength', 'conditioning'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 30,
    durationRange: { min: 25, max: 35 },
    energyLevels: ['easy', 'moderate'],
    qualityScore: 95,
    blocks: [
      mobilityPrep(6),
      block('main', 'Strength Circuit', 18, 'Squat, push, and trunk control', [
        slot('squat', x.bodyweightSquat, 'main', '3 x 10-12', 'Keep the pace steady and stop 2 reps before form breaks.'),
        slot('push', x.inclinePushUp, 'main', '3 x 8-12', 'Use a height that lets every rep stay crisp.', 'moderate', [x.kneePushUp]),
        slot('core', x.deadBug, 'accessory', '3 x 8 per side', 'Pause briefly with each reach.', 'easy'),
      ]),
      block('finisher', 'Easy Finish', 6, 'Low-impact conditioning', [
        slot('walk', x.walking, 'finisher', '6 minutes brisk', 'Stay conversational and nasal-breathe if possible.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bodyweight-express-20',
    title: 'Bodyweight Express',
    summary: 'A quick no-equipment strength circuit for busy days.',
    focus: 'Full Body Strength',
    focusTags: ['full_body', 'upper_body', 'lower_body', 'core'],
    styleTags: ['strength'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 20,
    energyLevels: ['easy', 'moderate'],
    qualityScore: 88,
    blocks: [
      block('prep', 'Prep', 4, 'Joints and core', [
        slot('cat-cow', x.catCow, 'warmup', '45 seconds', 'Move comfortably.'),
        slot('plank', x.plank, 'warmup', '2 x 20 seconds', 'Brace gently.'),
      ]),
      block('circuit', 'Main Circuit', 12, 'Squat, push, and core', [
        slot('squat', x.bodyweightSquat, 'main', '3 x 12', 'Smooth reps with full foot pressure.'),
        slot('push', x.inclinePushUp, 'main', '3 x 8', 'Keep shoulders away from ears.'),
        slot('dead-bug', x.deadBug, 'accessory', '3 x 6 per side', 'Own the slow tempo.', 'easy'),
      ]),
      block('finish', 'Reset', 4, 'Breathing cooldown', [
        slot('child-pose', x.childPose, 'recovery', '2 minutes', 'Relax the low back.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bodyweight-lower-30',
    title: 'Bodyweight Lower Strength',
    summary: 'A lower-body session built around squats, lunges, bridges, and calves.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'glutes', 'hamstrings', 'quadriceps', 'calves'],
    styleTags: ['strength'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 30,
    energyLevels: ['moderate'],
    qualityScore: 89,
    disallowedStressors: ['lower_body_fatigue'],
    blocks: [
      block('prep', 'Prep', 5, 'Hips and ankles', [
        slot('squat', x.bodyweightSquat, 'accessory', '2 x 8', 'Use this as a controlled warm-up.'),
        slot('bridge', x.gluteBridge, 'warmup', '2 x 10', 'Pause at the top.', 'easy'),
      ]),
      block('strength', 'Lower Strength', 20, 'Single-leg and squat work', [
        slot('reverse-lunge', x.reverseLunge, 'main', '3 x 8 per side', 'Step back softly and stay tall.'),
        slot('squat', x.bodyweightSquat, 'main', '3 x 12', 'Keep reps smooth.'),
        slot('calves', 'ex:00245', 'accessory', '3 x 15', 'Pause briefly at the top.'),
      ]),
      recoveryFinish(5),
    ],
  }),
  recipe({
    slug: 'bodyweight-upper-core-25',
    title: 'Bodyweight Upper and Core',
    summary: 'A compact push and trunk-control workout for home or travel.',
    focus: 'Upper Body and Core',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps', 'core'],
    styleTags: ['strength'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 25,
    energyLevels: ['easy', 'moderate'],
    qualityScore: 87,
    blocks: [
      mobilityPrep(5),
      block('main', 'Push and Brace', 15, 'Pressing and core', [
        slot('push-up', x.inclinePushUp, 'main', '4 x 8-10', 'Choose a pain-free incline.'),
        slot('plank', x.plank, 'accessory', '4 x 25 seconds', 'Stop before shaking changes your position.', 'moderate'),
        slot('dead-bug', x.deadBug, 'accessory', '3 x 8 per side', 'Move slowly.', 'easy'),
      ]),
      recoveryFinish(5),
    ],
  }),
  recipe({
    slug: 'bodyweight-core-stability-20',
    title: 'Bodyweight Core Stability',
    summary: 'A low-impact trunk session for bracing, rotation control, and recovery-friendly core work.',
    focus: 'Core Stability',
    focusTags: ['core', 'abdominals', 'recovery'],
    styleTags: ['strength', 'recovery'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 20,
    energyLevels: ['easy', 'moderate'],
    qualityScore: 86,
    blocks: [
      block('prep', 'Prep', 4, 'Breathing and spine', [
        slot('cat-cow', x.catCow, 'warmup', '60 seconds', 'Move gently.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 5 per side', 'Exhale on the reach.', 'easy'),
      ]),
      block('core', 'Stability Work', 12, 'Anti-extension and posterior chain', [
        slot('plank', x.plank, 'accessory', '4 x 20-30 seconds', 'Keep a quiet brace.'),
        slot('bird-dog', x.birdDog, 'accessory', '3 x 6 per side', 'Reach long without twisting.'),
        slot('superman', x.superman, 'warmup', '3 x 8', 'Lift only as high as comfortable.', 'easy'),
      ]),
      recoveryFinish(4),
    ],
  }),
  recipe({
    slug: 'bodyweight-conditioning-35',
    title: 'Bodyweight Conditioning',
    summary: 'A moderate conditioning circuit using simple bodyweight strength and aerobic intervals.',
    focus: 'Full Body Conditioning',
    focusTags: ['conditioning', 'full_body', 'lower_body', 'core'],
    styleTags: ['conditioning', 'cardio'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 35,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 87,
    blocks: [
      mobilityPrep(6),
      block('circuit', 'Strength Conditioning', 21, 'Low-skill intervals', [
        slot('squat', x.bodyweightSquat, 'main', '4 x 12', 'Keep the tempo steady.'),
        slot('push-up', x.inclinePushUp, 'main', '4 x 8', 'Use a sustainable incline.'),
        slot('jog', x.jogInPlace, 'finisher', '4 x 45 seconds', 'Stay springy but quiet.', 'moderate'),
      ]),
      block('finish', 'Aerobic Finish', 8, 'Easy-to-moderate cardio', [
        slot('walking', x.walking, 'finisher', '8 minutes brisk', 'Finish at a sustainable pace.'),
      ]),
    ],
  }),
  recipe({
    slug: 'bodyweight-recovery-mobility-25',
    title: 'Bodyweight Recovery Mobility',
    summary: 'A gentle mobility and recovery session for easy days.',
    focus: 'Recovery Mobility',
    focusTags: ['mobility', 'recovery', 'core', 'lower_body'],
    styleTags: ['mobility', 'recovery'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 25,
    durationRange: { min: 20, max: 35 },
    energyLevels: ['easy'],
    qualityScore: 90,
    blocks: [
      block('spine', 'Spine and Breath', 8, 'Gentle reset', [
        slot('cat-cow', x.catCow, 'recovery', '3 minutes', 'Move slowly and breathe.'),
        slot('child-pose', x.childPose, 'recovery', '2 minutes', 'Let hips and back relax.'),
      ]),
      block('hips', 'Hips and Hamstrings', 12, 'Lower-body mobility', [
        slot('hamstring', x.hamstringStretch, 'recovery', '2 x 60 seconds per side', 'Stay below a sharp stretch.', 'easy'),
        slot('bridge', x.gluteBridge, 'recovery', '2 x 10', 'Use smooth activation reps.', 'easy'),
      ]),
      block('finish', 'Easy Walk', 5, 'Circulation', [
        slot('walk', x.walking, 'finisher', '5 minutes easy', 'Move at a relaxed pace.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bodyweight-glute-core-30',
    title: 'Bodyweight Glute and Core',
    summary: 'A glute-focused bodyweight workout with controlled trunk work.',
    focus: 'Glutes and Core',
    focusTags: ['lower_body', 'glutes', 'hamstrings', 'core'],
    styleTags: ['strength'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 30,
    energyLevels: ['moderate'],
    qualityScore: 88,
    blocks: [
      mobilityPrep(5),
      block('strength', 'Glute Strength', 20, 'Hinge and bridge patterning', [
        slot('bridge', x.gluteBridge, 'main', '4 x 12', 'Pause at full hip extension.'),
        slot('single-leg-bridge', x.singleLegBridge, 'main', '3 x 8 per side', 'Keep hips level.'),
        slot('bird-dog', x.birdDog, 'accessory', '3 x 6 per side', 'Reach long and stay square.'),
      ]),
      recoveryFinish(5),
    ],
  }),
  recipe({
    slug: 'bodyweight-push-volume-35',
    title: 'Bodyweight Push Volume',
    summary: 'A push-focused bodyweight session with scalable pressing and shoulder-friendly volume.',
    focus: 'Upper Body Push',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps', 'core'],
    styleTags: ['strength'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 35,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 86,
    disallowedStressors: ['upper_body_push_fatigue'],
    blocks: [
      block('prep', 'Shoulder Prep', 6, 'Shoulders and trunk', [
        slot('arm-circles', x.armCircles, 'warmup', '2 x 45 seconds', 'Keep the motion easy.', 'easy'),
        slot('cat-cow', x.catCow, 'warmup', '60 seconds', 'Move through the upper back.', 'easy'),
      ]),
      block('push', 'Push Volume', 23, 'Pressing and brace', [
        slot('incline-push-up', x.inclinePushUp, 'main', '5 x 8-12', 'Adjust height to stay smooth.'),
        slot('push-up', x.pushUp, 'main', '3 x submaximal', 'Stop 2 reps before form breaks.', 'moderate', [x.kneePushUp]),
        slot('plank', x.plank, 'accessory', '4 x 25 seconds', 'Keep shoulders stacked.', 'moderate'),
      ]),
      recoveryFinish(6),
    ],
  }),
  recipe({
    slug: 'bodyweight-travel-circuit-40',
    title: 'Bodyweight Travel Circuit',
    summary: 'A longer no-equipment circuit that alternates lower body, push, core, and walking work.',
    focus: 'Full Body Conditioning',
    focusTags: ['full_body', 'conditioning', 'lower_body', 'upper_body', 'core'],
    styleTags: ['conditioning', 'strength'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 40,
    energyLevels: ['moderate'],
    qualityScore: 87,
    blocks: [
      mobilityPrep(6),
      block('strength', 'Strength Circuit', 24, 'Simple repeated patterns', [
        slot('lunge', x.lunge, 'main', '4 x 8 per side', 'Keep steps controlled.'),
        slot('push-up', x.inclinePushUp, 'main', '4 x 10', 'Use crisp reps.'),
        slot('crunch', x.reverseCrunch, 'accessory', '4 x 10', 'Move slowly.'),
      ]),
      block('finish', 'Walk Finish', 10, 'Aerobic close', [
        slot('walk', x.walking, 'finisher', '10 minutes brisk', 'Stay conversational.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'bodyweight-easy-walk-core-30',
    title: 'Easy Walk and Core',
    summary: 'A low-stress walking and core session for an easy training day.',
    focus: 'Conditioning and Core',
    focusTags: ['conditioning', 'core', 'recovery'],
    styleTags: ['cardio', 'recovery'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 30,
    energyLevels: ['easy'],
    qualityScore: 88,
    blocks: [
      block('walk', 'Easy Walk', 18, 'Aerobic base', [
        slot('walking', x.walking, 'finisher', '18 minutes easy to brisk', 'Stay relaxed and conversational.', 'easy'),
      ]),
      block('core', 'Core Control', 8, 'Gentle brace', [
        slot('dead-bug', x.deadBug, 'accessory', '3 x 8 per side', 'Slow exhale each rep.', 'easy'),
        slot('plank', x.plank, 'accessory', '3 x 20 seconds', 'Leave plenty in reserve.', 'easy'),
      ]),
      recoveryFinish(4),
    ],
  }),
  recipe({
    slug: 'bodyweight-athletic-base-45',
    title: 'Bodyweight Athletic Base',
    summary: 'A longer bodyweight session for strength endurance and aerobic base.',
    focus: 'Full Body Athletic Base',
    focusTags: ['full_body', 'conditioning', 'lower_body', 'upper_body', 'core'],
    styleTags: ['strength', 'conditioning'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 45,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 85,
    blocks: [
      mobilityPrep(7),
      block('strength', 'Strength Endurance', 28, 'Push, legs, and trunk', [
        slot('walking-lunge', x.walkingLunge, 'main', '4 x 10 per side', 'Keep a steady cadence.'),
        slot('push-up', x.pushUp, 'main', '4 x 8-12', 'Stay shy of failure.', 'moderate', [x.inclinePushUp]),
        slot('air-bike', x.airBike, 'accessory', '4 x 30 seconds', 'Move under control.', 'moderate'),
      ]),
      block('finish', 'Aerobic Close', 10, 'Low-impact finish', [
        slot('cycling', x.cycling, 'finisher', '10 minutes moderate', 'Keep breathing controlled.', 'moderate'),
      ]),
    ],
  }),

  recipe({
    slug: 'dumbbell-upper-35',
    title: 'Dumbbell Upper Strength',
    summary: 'A concise upper-body dumbbell session for pressing strength and core control.',
    focus: 'Upper Body Strength',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps', 'core'],
    styleTags: ['strength'],
    equipment: ['bodyweight', 'bench', 'dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 35,
    durationRange: { min: 30, max: 45 },
    energyLevels: ['moderate', 'intense'],
    qualityScore: 92,
    disallowedStressors: ['upper_body_push_fatigue'],
    blocks: [
      mobilityPrep(6),
      block('strength', 'Pressing Strength', 23, 'Chest and shoulders', [
        slot('bench-press', x.dumbbellBenchPress, 'main', '4 x 8', 'Use a moderate load and leave 1-2 reps in reserve.', 'moderate', [x.dumbbellFloorPress]),
        slot('shoulder-press', x.dumbbellShoulderPress, 'main', '3 x 8-10', 'Brace before each rep and keep the range pain-free.'),
        slot('dead-bug', x.deadBug, 'accessory', '3 x 8 per side', 'Match each reach with a slow exhale.', 'easy'),
      ]),
      recoveryFinish(6),
    ],
  }),
  recipe({
    slug: 'dumbbell-floor-press-core-30',
    title: 'Dumbbell Floor Press and Core',
    summary: 'A floor-based dumbbell push workout with core stability work.',
    focus: 'Upper Body Push',
    focusTags: ['upper_body', 'chest', 'triceps', 'core'],
    styleTags: ['strength'],
    equipment: ['bodyweight', 'dumbbell'],
    environmentTags: ['home'],
    durationMinutes: 30,
    energyLevels: ['moderate'],
    qualityScore: 88,
    blocks: [
      block('prep', 'Prep', 5, 'Shoulders and trunk', [
        slot('scaption', x.dumbbellScaption, 'accessory', '2 x 10 light', 'Keep reps easy and smooth.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Slow exhale.', 'easy'),
      ]),
      block('main', 'Press and Brace', 20, 'Floor press strength', [
        slot('floor-press', x.dumbbellFloorPress, 'main', '4 x 8-10', 'Pause elbows lightly on the floor.'),
        slot('fly', x.dumbbellFly, 'accessory', '3 x 10', 'Use a small, comfortable range.'),
        slot('plank', x.plank, 'accessory', '3 x 30 seconds', 'Keep ribs stacked.', 'moderate'),
      ]),
      recoveryFinish(5),
    ],
  }),
  recipe({
    slug: 'dumbbell-shoulder-arms-30',
    title: 'Dumbbell Shoulders and Arms',
    summary: 'A dumbbell-only upper-body accessory session for shoulders, biceps, and triceps.',
    focus: 'Upper Body Shoulders and Arms',
    focusTags: ['upper_body', 'shoulders', 'biceps', 'triceps'],
    styleTags: ['strength'],
    equipment: ['dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 30,
    energyLevels: ['moderate'],
    qualityScore: 84,
    blocks: [
      block('primer', 'Light Primer', 5, 'Shoulder control', [
        slot('scaption', x.dumbbellScaption, 'accessory', '2 x 12 light', 'Raise only to a comfortable height.', 'easy'),
      ]),
      block('work', 'Accessory Strength', 20, 'Shoulders and arms', [
        slot('lateral-raise', x.sideLateralRaise, 'main', '3 x 12', 'Lead with elbows and avoid swinging.'),
        slot('curl', x.hammerCurl, 'main', '3 x 10', 'Keep wrists neutral.'),
        slot('triceps', x.dumbbellTricepsExtension, 'accessory', '3 x 10', 'Move through a controlled range.'),
      ]),
      block('finish', 'Pump Finish', 5, 'Arm volume', [
        slot('curl-finish', x.concentrationCurl, 'accessory', '2 x 12 per side', 'Use a clean tempo.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-bench-push-45',
    title: 'Dumbbell Bench Push',
    summary: 'A longer bench-and-dumbbell pressing workout with shoulder and triceps assistance.',
    focus: 'Upper Body Push',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps'],
    styleTags: ['strength'],
    equipment: ['bench', 'dumbbell'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 45,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 87,
    blocks: [
      block('primer', 'Press Primer', 7, 'Pressing mechanics', [
        slot('scaption', x.dumbbellScaption, 'accessory', '2 x 12', 'Light and controlled.', 'easy'),
        slot('rear-delt', x.rearDeltRaise, 'accessory', '2 x 12', 'Move smoothly.', 'easy'),
      ]),
      block('main', 'Pressing Work', 30, 'Chest and shoulders', [
        slot('bench-press', x.dumbbellBenchPress, 'main', '4 x 8', 'Use a strong but repeatable load.'),
        slot('incline-press', x.inclineDumbbellPress, 'main', '3 x 8-10', 'Keep shoulder range comfortable.'),
        slot('triceps', x.seatedTricepsPress, 'accessory', '3 x 10', 'Avoid flaring ribs.'),
      ]),
      block('finish', 'Shoulder Finish', 8, 'Accessory volume', [
        slot('lateral-raise', x.sideLateralRaise, 'accessory', '3 x 12-15', 'Small pause at the top.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-pull-posture-35',
    title: 'Dumbbell Pull and Posture',
    summary: 'A dumbbell pull session for upper back, rear delts, traps, and biceps.',
    focus: 'Upper Body Pull',
    focusTags: ['upper_body', 'middle_back', 'lats', 'biceps', 'traps'],
    styleTags: ['strength'],
    equipment: ['dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 86,
    blocks: [
      block('primer', 'Posture Primer', 6, 'Rear shoulders', [
        slot('rear-delt', x.rearDeltRaise, 'accessory', '2 x 12 light', 'Use smooth reps.', 'easy'),
      ]),
      block('pull', 'Pull Strength', 24, 'Back and arms', [
        slot('row', x.inclineBenchPull, 'main', '4 x 8-10', 'Pull elbows back and pause briefly.'),
        slot('shrug', x.dumbbellShrug, 'main', '3 x 10', 'Lift and lower without rolling shoulders.'),
        slot('curl', x.dumbbellBicepCurl, 'accessory', '3 x 10', 'Stay strict.'),
      ]),
      block('finish', 'Rear Delt Finish', 5, 'Upper-back control', [
        slot('rear-delt-finish', x.rearDeltRaise, 'accessory', '2 x 15', 'Use a light load.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-step-up-lower-35',
    title: 'Dumbbell Step-Up Lower',
    summary: 'A bench-and-dumbbell lower-body workout built around step-ups and glute work.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'glutes', 'hamstrings', 'quadriceps'],
    styleTags: ['strength'],
    equipment: ['bodyweight', 'bench', 'dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 84,
    blocks: [
      block('prep', 'Lower Prep', 6, 'Hips and balance', [
        slot('bridge', x.gluteBridge, 'warmup', '2 x 10', 'Pause at the top.', 'easy'),
        slot('squat', x.bodyweightSquat, 'accessory', '2 x 8', 'Use a warm-up tempo.', 'easy'),
      ]),
      block('strength', 'Step-Up Strength', 24, 'Unilateral legs', [
        slot('step-up', x.dumbbellStepUp, 'main', '4 x 8 per side', 'Drive through the full foot.'),
        slot('bridge', x.singleLegBridge, 'main', '3 x 8 per side', 'Keep hips level.'),
        slot('dead-bug', x.deadBug, 'accessory', '3 x 8 per side', 'Control the pelvis.', 'easy'),
      ]),
      recoveryFinish(5),
    ],
  }),
  recipe({
    slug: 'dumbbell-full-body-home-40',
    title: 'Dumbbell Full Body Home',
    summary: 'A home-friendly dumbbell and bodyweight workout with push, legs, and core.',
    focus: 'Full Body Strength',
    focusTags: ['full_body', 'upper_body', 'lower_body', 'core'],
    styleTags: ['strength', 'conditioning'],
    equipment: ['bodyweight', 'dumbbell'],
    environmentTags: ['home'],
    durationMinutes: 40,
    energyLevels: ['moderate'],
    qualityScore: 86,
    blocks: [
      mobilityPrep(6),
      block('main', 'Full Body Strength', 26, 'Push, squat, and brace', [
        slot('floor-press', x.dumbbellFloorPress, 'main', '4 x 8', 'Use a controlled floor pause.'),
        slot('squat', x.bodyweightSquat, 'main', '4 x 12', 'Keep tempo steady.'),
        slot('curl', x.hammerCurl, 'accessory', '3 x 10', 'Keep shoulders quiet.'),
      ]),
      block('finish', 'Core Finish', 8, 'Trunk control', [
        slot('plank', x.plank, 'accessory', '4 x 25 seconds', 'Hold a clean brace.'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-arms-core-25',
    title: 'Dumbbell Arms and Core',
    summary: 'A quick dumbbell accessory session for arms with a bodyweight core close.',
    focus: 'Arms and Core',
    focusTags: ['upper_body', 'biceps', 'triceps', 'core'],
    styleTags: ['strength'],
    equipment: ['bodyweight', 'dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 25,
    energyLevels: ['easy', 'moderate'],
    qualityScore: 83,
    blocks: [
      block('arms', 'Arm Strength', 16, 'Biceps and triceps', [
        slot('curl', x.dumbbellBicepCurl, 'main', '3 x 10', 'Use a smooth tempo.'),
        slot('hammer', x.hammerCurl, 'accessory', '3 x 10', 'Keep elbows near the ribs.'),
        slot('triceps', x.dumbbellTricepsExtension, 'accessory', '3 x 10', 'Move without shoulder discomfort.'),
      ]),
      block('core', 'Core Close', 6, 'Brace', [
        slot('dead-bug', x.deadBug, 'accessory', '3 x 8 per side', 'Slow exhale each rep.', 'easy'),
      ]),
      recoveryFinish(3),
    ],
  }),
  recipe({
    slug: 'dumbbell-intense-upper-50',
    title: 'Dumbbell Intense Upper',
    summary: 'A higher-volume dumbbell upper-body session for experienced lifters.',
    focus: 'Upper Body Strength',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps', 'biceps'],
    styleTags: ['strength'],
    equipment: ['bench', 'dumbbell'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 50,
    energyLevels: ['intense'],
    qualityScore: 84,
    blocks: [
      block('primer', 'Upper Primer', 8, 'Shoulders and rear delts', [
        slot('scaption', x.dumbbellScaption, 'accessory', '2 x 12', 'Light load only.', 'easy'),
        slot('rear-delt', x.rearDeltRaise, 'accessory', '2 x 12', 'Keep the neck relaxed.', 'easy'),
      ]),
      block('main', 'Main Upper Work', 34, 'Press and pull balance', [
        slot('bench-press', x.dumbbellBenchPress, 'main', '5 x 6-8', 'Use a strong repeatable load.', 'intense'),
        slot('row', x.inclineBenchPull, 'main', '4 x 8-10', 'Pause at the top.'),
        slot('shoulder-press', x.dumbbellShoulderPress, 'main', '3 x 8', 'Brace hard before pressing.'),
      ]),
      block('accessory', 'Accessory Close', 8, 'Arms', [
        slot('curl', x.hammerCurl, 'accessory', '3 x 10', 'No swinging.'),
        slot('triceps', x.seatedTricepsPress, 'accessory', '3 x 10', 'Control the lowering.'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-easy-primer-20',
    title: 'Dumbbell Easy Primer',
    summary: 'A short dumbbell-only primer for light upper-body movement.',
    focus: 'Upper Body Primer',
    focusTags: ['upper_body', 'shoulders', 'biceps', 'traps'],
    styleTags: ['strength', 'recovery'],
    equipment: ['dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 20,
    energyLevels: ['easy'],
    qualityScore: 82,
    blocks: [
      block('primer', 'Light Upper Primer', 12, 'Shoulder and arm control', [
        slot('scaption', x.dumbbellScaption, 'accessory', '3 x 10 light', 'Raise with control.', 'easy'),
        slot('curl', x.concentrationCurl, 'accessory', '2 x 10 per side', 'Smooth reps only.', 'easy'),
      ]),
      block('finish', 'Posture Finish', 8, 'Traps and rear shoulders', [
        slot('shrug', x.dumbbellShrug, 'accessory', '2 x 12', 'Lift straight up and down.', 'easy'),
        slot('rear-delt', x.rearDeltRaise, 'accessory', '2 x 12', 'Keep load light.', 'easy'),
      ]),
    ],
  }),

  recipe({
    slug: 'bands-full-body-30',
    title: 'Bands Full Body',
    summary: 'A resistance-band session covering squat, hinge, push, pull, and trunk-friendly volume.',
    focus: 'Full Body Strength',
    focusTags: ['full_body', 'upper_body', 'lower_body', 'core'],
    styleTags: ['strength'],
    equipment: ['resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 30,
    energyLevels: ['moderate'],
    qualityScore: 88,
    blocks: [
      block('prep', 'Band Prep', 5, 'Shoulders and hips', [
        slot('pull-apart', x.bandPullApart, 'warmup', '2 x 12', 'Keep tension light.', 'easy'),
        slot('good-morning', x.bandGoodMorning, 'warmup', '2 x 10', 'Hinge slowly.', 'easy'),
      ]),
      block('main', 'Band Strength', 20, 'Push, pull, squat', [
        slot('squat', x.bandSquat, 'main', '3 x 12', 'Control the bottom.'),
        slot('chest-press', x.bandChestPress, 'main', '3 x 10', 'Press with steady tension.'),
        slot('row', x.bandRow, 'main', '3 x 10', 'Pause shoulder blades back.'),
      ]),
      block('finish', 'Shoulder Finish', 5, 'Posture', [
        slot('face-pull', x.bandFacePull, 'accessory', '2 x 15', 'Keep it smooth.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bands-lower-body-35',
    title: 'Bands Lower Body',
    summary: 'A banded lower-body workout for hips, hamstrings, quads, and calves.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'glutes', 'hamstrings', 'quadriceps', 'calves'],
    styleTags: ['strength'],
    equipment: ['resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 86,
    blocks: [
      block('prep', 'Hip Prep', 6, 'Hips and hinge', [
        slot('monster-walk', x.monsterWalk, 'warmup', '2 x 10 steps each way', 'Small controlled steps.', 'easy'),
        slot('good-morning', x.bandGoodMorning, 'warmup', '2 x 10', 'Practice hinge mechanics.', 'easy'),
      ]),
      block('strength', 'Lower Strength', 24, 'Squat and hinge', [
        slot('squat', x.bandSquat, 'main', '4 x 10', 'Keep band tension even.'),
        slot('deadlift', x.bandDeadlift, 'main', '4 x 8', 'Brace before each pull.'),
        slot('leg-extension', x.bandLegExtension, 'accessory', '3 x 12 per side', 'Control the lockout.'),
      ]),
      block('finish', 'Calves', 5, 'Lower-leg finish', [
        slot('calves', x.bandCalfRaise, 'accessory', '3 x 15', 'Pause at the top.'),
      ]),
    ],
  }),
  recipe({
    slug: 'bands-upper-posture-25',
    title: 'Bands Upper Posture',
    summary: 'A light band session for shoulders, upper back, and posture.',
    focus: 'Upper Body Posture',
    focusTags: ['upper_body', 'middle_back', 'shoulders', 'traps', 'recovery'],
    styleTags: ['strength', 'recovery'],
    equipment: ['resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 25,
    energyLevels: ['easy', 'moderate'],
    qualityScore: 87,
    blocks: [
      block('prep', 'Scap Prep', 5, 'Shoulder control', [
        slot('pull-apart', x.bandPullApart, 'warmup', '2 x 15', 'Use light tension.', 'easy'),
      ]),
      block('work', 'Posture Work', 16, 'Rear shoulder and rows', [
        slot('face-pull', x.bandFacePull, 'main', '3 x 12', 'Pull toward eye level.'),
        slot('row', x.bandRow, 'main', '3 x 10', 'Pause back.'),
        slot('lateral-raise', x.bandLateralRaise, 'accessory', '2 x 12', 'Move without shrugging.', 'easy'),
      ]),
      block('finish', 'Easy Pull-Aparts', 4, 'Blood flow', [
        slot('pull-apart-finish', x.bandPullApart, 'accessory', '2 x 20', 'Keep the neck relaxed.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bands-push-strength-35',
    title: 'Bands Push Strength',
    summary: 'A resistance-band push workout for chest, shoulders, and triceps.',
    focus: 'Upper Body Push',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps'],
    styleTags: ['strength'],
    equipment: ['resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 85,
    blocks: [
      block('prep', 'Push Prep', 6, 'Shoulders', [
        slot('pull-apart', x.bandPullApart, 'warmup', '2 x 12', 'Use light tension.', 'easy'),
        slot('lateral-raise', x.bandLateralRaise, 'warmup', '2 x 10', 'Small smooth reps.', 'easy'),
      ]),
      block('main', 'Push Strength', 24, 'Pressing patterns', [
        slot('bench-press', x.bandBenchPress, 'main', '4 x 10', 'Keep band path steady.'),
        slot('shoulder-press', x.bandShoulderPress, 'main', '3 x 8-10', 'Brace before pressing.'),
        slot('chest-press', x.bandChestPress, 'accessory', '3 x 12', 'Finish with smooth reps.'),
      ]),
      block('finish', 'Shoulder Pump', 5, 'Lateral delts', [
        slot('lateral-raise-finish', x.bandLateralRaise, 'accessory', '2 x 15', 'Light burn only.'),
      ]),
    ],
  }),
  recipe({
    slug: 'bands-pull-core-35',
    title: 'Bands Pull and Core',
    summary: 'A banded pull workout with rows, face pulls, hinge work, and core-friendly pacing.',
    focus: 'Upper Body Pull',
    focusTags: ['upper_body', 'middle_back', 'lats', 'biceps', 'core'],
    styleTags: ['strength'],
    equipment: ['resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 86,
    blocks: [
      block('prep', 'Pull Prep', 6, 'Upper back', [
        slot('pull-apart', x.bandPullApart, 'warmup', '2 x 15', 'Light tension.', 'easy'),
      ]),
      block('pull', 'Pull Strength', 24, 'Rows and hinge', [
        slot('row', x.bandRow, 'main', '4 x 10', 'Pause each rep.'),
        slot('face-pull', x.bandFacePull, 'main', '3 x 12', 'Pull high with control.'),
        slot('good-morning', x.bandGoodMorning, 'accessory', '3 x 12', 'Keep back neutral.'),
      ]),
      block('finish', 'Core-Friendly Finish', 5, 'Light hinge', [
        slot('deadlift', x.bandDeadlift, 'accessory', '2 x 10 light', 'Keep it submaximal.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bands-travel-mobility-20',
    title: 'Bands Travel Mobility',
    summary: 'A short travel-friendly band session for hips and shoulders.',
    focus: 'Mobility Reset',
    focusTags: ['mobility', 'recovery', 'shoulders', 'glutes'],
    styleTags: ['mobility', 'recovery'],
    equipment: ['resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 20,
    energyLevels: ['easy'],
    qualityScore: 84,
    blocks: [
      block('shoulders', 'Shoulders', 8, 'Light band control', [
        slot('pull-apart', x.bandPullApart, 'recovery', '3 x 15', 'Keep tension easy.', 'easy'),
        slot('face-pull', x.bandFacePull, 'warmup', '2 x 12', 'Move smoothly.', 'easy'),
      ]),
      block('hips', 'Hips', 8, 'Glute activation', [
        slot('monster-walk', x.monsterWalk, 'warmup', '3 x 10 steps each way', 'Small steps.', 'easy'),
        slot('hip-extension', x.bandHipExtension, 'warmup', '2 x 12 per side', 'Pause lightly.', 'easy'),
      ]),
      block('finish', 'Easy Hinge', 4, 'Gentle posterior chain', [
        slot('good-morning', x.bandGoodMorning, 'recovery', '2 x 10 easy', 'Move slowly.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bands-glute-hamstring-40',
    title: 'Bands Glute Hamstring',
    summary: 'A longer banded posterior-chain workout for glutes and hamstrings.',
    focus: 'Glutes and Hamstrings',
    focusTags: ['lower_body', 'glutes', 'hamstrings'],
    styleTags: ['strength'],
    equipment: ['resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 40,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 84,
    blocks: [
      block('prep', 'Posterior Prep', 6, 'Hinge and glutes', [
        slot('monster-walk', x.monsterWalk, 'warmup', '2 x 12 steps each way', 'Keep hips level.', 'easy'),
        slot('good-morning', x.bandGoodMorning, 'warmup', '2 x 10', 'Use light tension.', 'easy'),
      ]),
      block('main', 'Posterior Chain', 28, 'Hinge and hip extension', [
        slot('deadlift', x.bandDeadlift, 'main', '4 x 8', 'Brace and pull evenly.'),
        slot('hip-extension', x.bandHipExtension, 'main', '4 x 12 per side', 'Squeeze glute at the top.'),
        slot('hamstring-curl', 'fedb:seated-band-hamstring-curl', 'accessory', '3 x 12', 'Control both directions.'),
      ]),
      block('finish', 'Calf Finish', 6, 'Lower-leg work', [
        slot('calf', x.bandCalfRaise, 'accessory', '3 x 15', 'Pause at top and bottom.'),
      ]),
    ],
  }),
  recipe({
    slug: 'bands-conditioning-circuit-30',
    title: 'Bands Conditioning Circuit',
    summary: 'A fast, repeatable band circuit pairing hinge, squat, and overhead pressing for a higher-effort metabolic session.',
    focus: 'Full Body Conditioning',
    focusTags: ['full_body', 'conditioning', 'upper_body', 'lower_body', 'glutes'],
    styleTags: ['conditioning', 'strength'],
    equipment: ['resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 30,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 84,
    blocks: [
      block('prep', 'Band Prep', 5, 'Glutes and shoulders', [
        slot('monster-walk', x.monsterWalk, 'warmup', '2 x 20 steps', 'Stay low and keep tension.', 'easy'),
        slot('pull-apart', x.bandPullApart, 'warmup', '2 x 15', 'Light tension.', 'easy'),
      ]),
      block('circuit', 'Conditioning Circuit', 21, 'Continuous band rounds, short rest', [
        slot('squat', x.bandSquat, 'main', '5 rounds x 12', 'Move fast but controlled; rest ~30s between rounds.', 'intense'),
        slot('deadlift', x.bandDeadlift, 'main', '5 rounds x 10', 'Drive the hips through.', 'intense'),
        slot('press', x.bandShoulderPress, 'main', '5 rounds x 10', 'Press overhead without leaning back.', 'moderate'),
        slot('row', x.bandRow, 'main', '5 rounds x 12', 'Pull to the ribs and pause.', 'moderate'),
      ]),
      block('finish', 'Posture Finish', 4, 'Upper back', [
        slot('face-pull', x.bandFacePull, 'accessory', '2 x 15', 'Easy controlled reps.', 'easy'),
      ]),
    ],
  }),

  recipe({
    slug: 'kettlebell-swing-strength-30',
    title: 'Kettlebell Swing Strength',
    summary: 'A kettlebell hinge and swing session with row support.',
    focus: 'Kettlebell Conditioning',
    focusTags: ['conditioning', 'lower_body', 'glutes', 'hamstrings', 'upper_body'],
    styleTags: ['strength', 'conditioning'],
    equipment: ['kettlebell'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 30,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 86,
    blocks: [
      block('prep', 'Hinge Prep', 5, 'Patterning', [
        slot('deadlift', x.kettlebellDeadlift, 'accessory', '2 x 8 per side', 'Use light controlled reps.', 'easy'),
      ]),
      block('main', 'Swing and Row', 20, 'Power and pull', [
        slot('swing', x.kettlebellSwing, 'main', '6 x 12', 'Stop if the hinge gets sloppy.', 'intense'),
        slot('row', x.kettlebellRow, 'main', '4 x 8 per side', 'Pause at the top.'),
      ]),
      block('finish', 'Easy Press', 5, 'Upper close', [
        slot('press', x.kettlebellSeatedPress, 'accessory', '2 x 8', 'Keep this submaximal.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'kettlebell-lower-power-35',
    title: 'Kettlebell Lower Power',
    summary: 'A kettlebell lower-body workout using goblet squats, hinges, and swings.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'glutes', 'hamstrings', 'quadriceps'],
    styleTags: ['strength', 'conditioning'],
    equipment: ['kettlebell'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 35,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 85,
    blocks: [
      block('prep', 'Lower Prep', 6, 'Squat and hinge', [
        slot('goblet-squat', x.gobletSquat, 'accessory', '2 x 8 light', 'Use this to find depth.', 'easy'),
      ]),
      block('strength', 'Lower Strength', 24, 'Squat and hinge', [
        slot('goblet-squat-main', x.gobletSquat, 'main', '4 x 8', 'Brace and sit between the hips.'),
        slot('deadlift', x.kettlebellDeadlift, 'main', '3 x 8 per side', 'Stay balanced.'),
        slot('swing', x.kettlebellSwing, 'main', '5 x 10', 'Crisp hip snaps.', 'moderate'),
      ]),
      block('finish', 'Row Finish', 5, 'Upper-back support', [
        slot('row', x.kettlebellRow, 'accessory', '2 x 10 per side', 'Finish smooth.'),
      ]),
    ],
  }),
  recipe({
    slug: 'kettlebell-upper-pull-30',
    title: 'Kettlebell Upper Pull',
    summary: 'A kettlebell pull workout for rows, lats, and grip.',
    focus: 'Upper Body Pull',
    focusTags: ['upper_body', 'middle_back', 'lats', 'biceps'],
    styleTags: ['strength'],
    equipment: ['kettlebell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 30,
    energyLevels: ['moderate'],
    qualityScore: 83,
    blocks: [
      block('prep', 'Pull Prep', 5, 'Light rows', [
        slot('row-light', x.kettlebellRow, 'accessory', '2 x 8 per side light', 'Groove the path.', 'easy'),
      ]),
      block('pull', 'Pull Strength', 20, 'Rows and hinge', [
        slot('row', x.kettlebellTwoArmRow, 'main', '4 x 8', 'Pause hard at the top.'),
        slot('one-arm-row', x.kettlebellRow, 'main', '3 x 8 per side', 'Keep ribs down.'),
        slot('deadlift', x.kettlebellDeadlift, 'accessory', '3 x 8 per side', 'Use a controlled hinge.'),
      ]),
      block('finish', 'Swing Flush', 5, 'Moderate conditioning', [
        slot('swing', x.kettlebellSwing, 'main', '4 x 10', 'Keep power crisp.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'kettlebell-push-core-35',
    title: 'Kettlebell Push and Core',
    summary: 'A kettlebell pressing session with floor press and seated press, balanced by a dedicated trunk-stability finisher.',
    focus: 'Upper Body Push',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps', 'core'],
    styleTags: ['strength'],
    equipment: ['kettlebell', 'bodyweight'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 83,
    blocks: [
      block('prep', 'Press Prep', 5, 'Shoulders and trunk', [
        slot('arm-circles', x.armCircles, 'warmup', '60 seconds', 'Open the shoulders.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Set the bracing pattern.', 'easy'),
      ]),
      block('main', 'Push Strength', 22, 'Pressing work and upper-back balance', [
        slot('floor-press', x.kettlebellFloorPress, 'main', '4 x 8 per side', 'Keep the shoulder packed.'),
        slot('seated-press', x.kettlebellSeatedPress, 'main', '3 x 8', 'Brace tall and press without leaning back.'),
        slot('row', x.kettlebellRow, 'accessory', '3 x 10 per side', 'Pull to the ribs to balance the pressing.'),
      ]),
      block('core', 'Core Finish', 8, 'Anti-extension and anti-rotation', [
        slot('plank', x.plank, 'accessory', '3 x 30 seconds', 'Squeeze glutes and brace.', 'moderate'),
        slot('bird-dog', x.birdDog, 'accessory', '2 x 8 per side', 'Move slowly and resist twisting.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'kettlebell-full-body-45',
    title: 'Kettlebell Full Body',
    summary: 'A longer kettlebell workout with squat, hinge, pull, push, and conditioning.',
    focus: 'Full Body Strength',
    focusTags: ['full_body', 'upper_body', 'lower_body', 'conditioning', 'core'],
    styleTags: ['strength', 'conditioning'],
    equipment: ['kettlebell'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 45,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 86,
    blocks: [
      block('prep', 'Pattern Prep', 7, 'Squat and hinge', [
        slot('goblet-light', x.gobletSquat, 'accessory', '2 x 8', 'Find a strong position.', 'easy'),
        slot('row-light', x.kettlebellRow, 'accessory', '2 x 8 per side', 'Use light effort.', 'easy'),
      ]),
      block('main', 'Full Body Work', 30, 'Squat, pull, push', [
        slot('goblet-squat', x.gobletSquat, 'main', '4 x 8', 'Brace and control depth.'),
        slot('row', x.kettlebellRow, 'main', '4 x 8 per side', 'Pause at the ribcage.'),
        slot('floor-press', x.kettlebellFloorPress, 'main', '3 x 8 per side', 'Keep the shoulder stable.'),
      ]),
      block('finish', 'Swing Finish', 8, 'Conditioning', [
        slot('swing', x.kettlebellSwing, 'main', '6 x 10', 'Rest until each set is crisp.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'kettlebell-easy-technique-20',
    title: 'Kettlebell Easy Technique',
    summary: 'A short lower-intensity kettlebell technique session.',
    focus: 'Kettlebell Technique',
    focusTags: ['full_body', 'lower_body', 'upper_body', 'recovery'],
    styleTags: ['strength', 'recovery'],
    equipment: ['kettlebell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 20,
    energyLevels: ['easy'],
    qualityScore: 82,
    blocks: [
      block('technique', 'Technique Practice', 15, 'Easy patterning', [
        slot('goblet', x.gobletSquat, 'accessory', '3 x 6 light', 'Practice depth and brace.', 'easy'),
        slot('row', x.kettlebellRow, 'accessory', '3 x 8 per side', 'Move smoothly.', 'easy'),
        slot('press', x.kettlebellSeatedPress, 'accessory', '2 x 8', 'Stay submaximal.', 'easy'),
      ]),
      block('finish', 'Easy Hinge', 5, 'Low-volume hinge', [
        slot('deadlift', x.kettlebellDeadlift, 'accessory', '2 x 6 per side', 'Keep this technique-only.', 'easy'),
      ]),
    ],
  }),

  recipe({
    slug: 'barbell-squat-strength-45',
    title: 'Barbell Squat Strength',
    summary: 'A barbell lower-body strength workout centered on squats and posterior-chain assistance.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'quadriceps', 'glutes', 'hamstrings', 'core'],
    styleTags: ['strength', 'powerlifting'],
    equipment: ['barbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 45,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 86,
    blocks: [
      block('ramp', 'Ramp Sets', 10, 'Squat preparation', [
        slot('squat-light', x.barbellSquat, 'accessory', '3 x 5 ramping', 'Add load gradually.', 'easy'),
      ]),
      block('main', 'Squat Work', 28, 'Primary lower-body strength', [
        slot('squat', x.barbellSquat, 'main', '5 x 5', 'Keep reps powerful and repeatable.'),
        slot('lunge', x.barbellLunge, 'accessory', '3 x 8 per side', 'Use a moderate load.'),
      ]),
      block('finish', 'Posterior Finish', 7, 'Hinge assistance', [
        slot('rdl', x.romanianDeadlift, 'accessory', '3 x 8', 'Own the hinge.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'barbell-deadlift-pull-45',
    title: 'Barbell Deadlift Pull',
    summary: 'A deadlift and barbell row session for posterior-chain and upper-back strength.',
    focus: 'Pull Strength',
    focusTags: ['upper_body', 'middle_back', 'lower_body', 'hamstrings', 'glutes'],
    styleTags: ['strength', 'powerlifting'],
    equipment: ['barbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 45,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 86,
    blocks: [
      block('ramp', 'Hinge Ramp', 10, 'Deadlift preparation', [
        slot('rdl-light', x.romanianDeadlift, 'accessory', '3 x 6 light', 'Hinge smoothly.', 'easy'),
      ]),
      block('main', 'Deadlift Pull', 28, 'Primary pull work', [
        slot('deadlift', x.barbellDeadlift, 'main', '5 x 3-5', 'Keep every rep technically clean.', 'intense'),
        slot('row', x.barbellRow, 'main', '4 x 8', 'Pause at the top.'),
      ]),
      block('finish', 'Curl Finish', 7, 'Arm accessory', [
        slot('curl', x.barbellCurl, 'accessory', '3 x 10', 'Keep it strict.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'barbell-bench-upper-40',
    title: 'Barbell Bench Upper',
    summary: 'A barbell upper-body pressing workout with rows and arm assistance.',
    focus: 'Upper Body Strength',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps', 'middle_back'],
    styleTags: ['strength', 'powerlifting'],
    equipment: ['barbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 40,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 85,
    blocks: [
      block('ramp', 'Bench Ramp', 8, 'Press preparation', [
        slot('bench-light', x.barbellBench, 'accessory', '3 x 5 ramping', 'Build gradually.', 'easy'),
      ]),
      block('main', 'Bench and Row', 25, 'Press-pull strength', [
        slot('bench', x.barbellBench, 'main', '5 x 5', 'Press with a stable setup.'),
        slot('row', x.barbellRow, 'main', '4 x 8', 'Keep torso position fixed.'),
      ]),
      block('finish', 'Arms', 7, 'Accessory finish', [
        slot('curl', x.barbellCurl, 'accessory', '3 x 10', 'Stay controlled.'),
      ]),
    ],
  }),
  recipe({
    slug: 'barbell-full-body-strength-55',
    title: 'Barbell Full Body Strength',
    summary: 'A longer barbell workout combining squat, press, hinge, and row patterns.',
    focus: 'Full Body Strength',
    focusTags: ['full_body', 'upper_body', 'lower_body', 'core', 'middle_back'],
    styleTags: ['strength', 'powerlifting'],
    equipment: ['barbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 55,
    energyLevels: ['intense'],
    qualityScore: 83,
    blocks: [
      block('ramp', 'Ramp Work', 10, 'Full-body prep', [
        slot('front-squat-light', x.frontSquat, 'accessory', '3 x 5 light', 'Groove the brace.', 'easy'),
      ]),
      block('main', 'Main Lifts', 35, 'Squat, press, and pull', [
        slot('squat', x.barbellSquat, 'main', '4 x 5', 'Leave 1-2 reps in reserve.', 'intense'),
        slot('bench', x.barbellBench, 'main', '4 x 6', 'Keep the setup repeatable.'),
        slot('row', x.barbellRow, 'main', '4 x 8', 'Pull with control.'),
      ]),
      block('finish', 'Hinge Finish', 10, 'Posterior chain', [
        slot('rdl', x.romanianDeadlift, 'accessory', '3 x 8', 'Own the eccentric.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'barbell-glute-bridge-lower-35',
    title: 'Barbell Glute Bridge Lower',
    summary: 'A lower-body barbell session focused on glute strength and hinge assistance.',
    focus: 'Glutes and Hamstrings',
    focusTags: ['lower_body', 'glutes', 'hamstrings'],
    styleTags: ['strength'],
    equipment: ['barbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 84,
    blocks: [
      block('ramp', 'Bridge Ramp', 6, 'Glute prep', [
        slot('bridge-light', x.barbellGluteBridge, 'accessory', '2 x 8 light', 'Find position.', 'easy'),
      ]),
      block('main', 'Glute Strength', 24, 'Hip extension', [
        slot('hip-thrust', x.barbellHipThrust, 'main', '4 x 8', 'Pause at the top.'),
        slot('glute-bridge', x.barbellGluteBridge, 'main', '3 x 10', 'Keep ribs down.'),
        slot('rdl', x.romanianDeadlift, 'accessory', '3 x 8', 'Keep shins mostly vertical.'),
      ]),
      block('finish', 'Calves', 5, 'Lower-leg finish', [
        slot('calf', 'fedb:standing-barbell-calf-raise', 'accessory', '3 x 12', 'Control top and bottom.'),
      ]),
    ],
  }),
  recipe({
    slug: 'barbell-pull-arms-35',
    title: 'Barbell Pull Arms',
    summary: 'A barbell back, trap, and biceps session.',
    focus: 'Upper Body Pull',
    focusTags: ['upper_body', 'middle_back', 'lats', 'biceps', 'traps'],
    styleTags: ['strength'],
    equipment: ['barbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 82,
    blocks: [
      block('pull', 'Main Pulls', 24, 'Rows and traps', [
        slot('row', x.barbellRow, 'main', '4 x 8', 'Keep the torso steady.'),
        slot('shrug', x.barbellShrug, 'main', '3 x 10', 'Lift straight up and down.'),
        slot('curl', x.barbellCurl, 'accessory', '3 x 10', 'No swinging.'),
      ]),
      block('finish', 'Rear Delt Row', 11, 'Upper-back finish', [
        slot('rear-delt-row', 'fedb:barbell-rear-delt-row', 'accessory', '3 x 10', 'Use a controlled load.'),
      ]),
    ],
  }),
  recipe({
    slug: 'barbell-intense-lower-60',
    title: 'Barbell Intense Lower',
    summary: 'A high-effort lower-body barbell workout for advanced lifters.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'quadriceps', 'glutes', 'hamstrings', 'core'],
    styleTags: ['strength', 'powerlifting'],
    equipment: ['barbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 60,
    energyLevels: ['intense'],
    qualityScore: 82,
    blocks: [
      block('ramp', 'Heavy Ramp', 12, 'Squat and hinge prep', [
        slot('front-squat', x.frontSquat, 'accessory', '3 x 5 ramping', 'Build gradually.', 'easy'),
      ]),
      block('main', 'Lower Strength', 38, 'Heavy squat and hinge', [
        slot('squat', x.barbellSquat, 'main', '5 x 3-5', 'Use clean heavy reps.', 'intense'),
        slot('deadlift', x.barbellDeadlift, 'main', '4 x 3', 'Stop if speed or position drops.', 'intense'),
        slot('lunge', x.barbellLunge, 'accessory', '3 x 6 per side', 'Use moderate loading.'),
      ]),
      block('finish', 'Posterior Accessory', 10, 'Hinge volume', [
        slot('rdl', x.romanianDeadlift, 'accessory', '3 x 8', 'Control the eccentric.'),
      ]),
    ],
  }),

  recipe({
    slug: 'gym-pull-conditioning-40',
    title: 'Gym Pull and Conditioning',
    summary: 'A gym session combining cable rowing, treadmill work, and trunk stability.',
    focus: 'Pull and Conditioning',
    focusTags: ['upper_body', 'middle_back', 'conditioning', 'core'],
    styleTags: ['strength', 'conditioning', 'cardio'],
    equipment: ['bodyweight', 'cable_machine', 'treadmill'],
    environmentTags: ['gym'],
    durationMinutes: 40,
    durationRange: { min: 35, max: 50 },
    energyLevels: ['moderate'],
    qualityScore: 90,
    disallowedStressors: ['upper_body_pull_fatigue'],
    blocks: [
      block('warmup', 'Warm-up', 8, 'Easy aerobic ramp', [
        slot('treadmill-warmup', x.treadmillWalk, 'warmup', '8 minutes easy', 'Increase speed gradually without pushing effort.', 'easy'),
      ]),
      block('strength', 'Pull Strength', 20, 'Rows and trunk control', [
        slot('cable-row', x.cableRow, 'main', '4 x 10', 'Pause with shoulder blades back on each rep.'),
        slot('dead-bug', x.deadBug, 'accessory', '3 x 8 per side', 'Keep the low back quiet against the floor.', 'easy'),
      ]),
      block('conditioning', 'Conditioning', 12, 'Steady aerobic work', [
        slot('treadmill-finish', x.treadmillWalk, 'finisher', '12 minutes brisk', 'Keep the effort moderate and sustainable.', 'moderate', [x.walking]),
      ]),
    ],
  }),
  recipe({
    slug: 'cable-push-core-35',
    title: 'Cable Push and Core',
    summary: 'A cable-based push workout with chest, shoulders, triceps, and core.',
    focus: 'Upper Body Push',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps', 'core'],
    styleTags: ['strength'],
    equipment: ['cable_machine'],
    environmentTags: ['gym'],
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 86,
    blocks: [
      block('prep', 'Cable Prep', 5, 'Shoulders', [
        slot('rear-delt', x.cableRearDeltFly, 'warmup', '2 x 12 light', 'Use easy tension.', 'easy'),
      ]),
      block('push', 'Cable Push', 24, 'Press and shoulders', [
        slot('chest-press', x.cableChestPress, 'main', '4 x 10', 'Press with steady control.'),
        slot('shoulder-press', x.cableShoulderPress, 'main', '3 x 8-10', 'Brace before each rep.'),
        slot('triceps', x.cableTriceps, 'accessory', '3 x 12', 'Keep elbows controlled.'),
      ]),
      block('core', 'Cable Core', 6, 'Anterior core', [
        slot('crunch', x.cableCrunch, 'accessory', '3 x 12', 'Curl down without yanking.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'cable-pull-back-35',
    title: 'Cable Pull Back',
    summary: 'A cable pull workout for lats, rows, rear delts, and biceps.',
    focus: 'Upper Body Pull',
    focusTags: ['upper_body', 'middle_back', 'lats', 'biceps', 'shoulders'],
    styleTags: ['strength'],
    equipment: ['cable_machine'],
    environmentTags: ['gym'],
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 88,
    blocks: [
      block('prep', 'Upper-Back Prep', 5, 'Scap control', [
        slot('face-pull', x.cableFacePull, 'warmup', '2 x 12', 'Light and smooth.', 'easy'),
      ]),
      block('pull', 'Cable Pull', 24, 'Rows and pulldowns', [
        slot('row', x.cableRow, 'main', '4 x 10', 'Pause back.'),
        slot('pulldown', x.cableLatPulldown, 'main', '4 x 8-10', 'Pull elbows down.'),
        slot('curl', x.cableHammerCurl, 'accessory', '3 x 10', 'Keep elbows steady.'),
      ]),
      block('finish', 'Rear Delt Finish', 6, 'Shoulder balance', [
        slot('rear-delt', x.cableRearDeltFly, 'accessory', '3 x 12', 'Move under control.'),
      ]),
    ],
  }),
  recipe({
    slug: 'machine-lower-accessory-35',
    title: 'Machine Lower Accessory',
    summary: 'A gym machine lower-body workout for quads, hamstrings, and calves.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'quadriceps', 'hamstrings', 'calves'],
    styleTags: ['strength'],
    equipment: ['machine'],
    environmentTags: ['gym'],
    durationMinutes: 35,
    energyLevels: ['moderate'],
    qualityScore: 84,
    blocks: [
      block('quad', 'Quad Work', 12, 'Knee extension', [
        slot('leg-extension', x.machineLegExtension, 'main', '4 x 10', 'Pause at the top.'),
      ]),
      block('hamstring', 'Hamstring Work', 12, 'Knee flexion', [
        slot('leg-curl', x.machineLegCurl, 'main', '4 x 10', 'Control the lowering.'),
      ]),
      block('calves-core', 'Calves and Core', 11, 'Accessory close', [
        slot('calf-press', x.machineCalfPress, 'accessory', '4 x 12', 'Full range reps.'),
        slot('ab-crunch', x.machineAbCrunch, 'accessory', '3 x 12', 'Curl down slowly.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'machine-upper-accessory-30',
    title: 'Machine Upper Accessory',
    summary: 'A gym machine accessory workout for chest, rear delts, arms, and traps.',
    focus: 'Upper Body Strength',
    focusTags: ['upper_body', 'chest', 'shoulders', 'biceps', 'triceps', 'traps'],
    styleTags: ['strength'],
    equipment: ['machine'],
    environmentTags: ['gym'],
    durationMinutes: 30,
    energyLevels: ['moderate'],
    qualityScore: 83,
    blocks: [
      block('push-pull', 'Machine Upper', 18, 'Chest and rear shoulders', [
        slot('butterfly', x.machineButterfly, 'main', '3 x 10', 'Keep shoulders down.'),
        slot('reverse-fly', x.machineReverseFly, 'main', '3 x 12', 'Squeeze the upper back.'),
      ]),
      block('arms', 'Arms and Traps', 12, 'Accessory finish', [
        slot('biceps', x.machineBicepCurl, 'accessory', '3 x 10', 'Stay strict.'),
        slot('triceps', x.machineTriceps, 'accessory', '3 x 10', 'Control the handle.'),
        slot('shrug', x.machineShrug, 'accessory', '2 x 12', 'Lift straight up.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'treadmill-row-conditioning-35',
    title: 'Treadmill Row Conditioning',
    summary: 'A gym conditioning session alternating treadmill and rower work.',
    focus: 'Conditioning',
    focusTags: ['conditioning', 'lower_body', 'upper_body', 'core'],
    styleTags: ['cardio', 'conditioning'],
    equipment: ['treadmill', 'rowing_machine'],
    environmentTags: ['gym'],
    durationMinutes: 35,
    energyLevels: ['moderate', 'intense'],
    qualityScore: 84,
    blocks: [
      block('warmup', 'Treadmill Warm-up', 8, 'Aerobic ramp', [
        slot('walk', x.treadmillWalk, 'warmup', '8 minutes easy', 'Build gradually.', 'easy'),
      ]),
      block('intervals', 'Conditioning Intervals', 20, 'Run and row', [
        slot('jog', x.treadmillJog, 'main', '5 x 2 minutes moderate', 'Keep repeats sustainable.', 'moderate'),
        slot('rower', x.rower, 'main', '5 x 90 seconds', 'Drive with legs and finish tall.', 'moderate'),
      ]),
      block('cooldown', 'Cooldown', 7, 'Easy walk', [
        slot('walk-cooldown', x.treadmillWalk, 'recovery', '7 minutes easy', 'Downshift gradually.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'gym-recovery-cardio-30',
    title: 'Gym Recovery Cardio',
    summary: 'An easy gym cardio and mobility session for recovery days.',
    focus: 'Recovery Cardio',
    focusTags: ['recovery', 'conditioning', 'mobility'],
    styleTags: ['cardio', 'recovery', 'mobility'],
    equipment: ['bodyweight', 'treadmill'],
    environmentTags: ['gym'],
    durationMinutes: 30,
    energyLevels: ['easy'],
    qualityScore: 86,
    blocks: [
      block('cardio', 'Easy Cardio', 20, 'Low-intensity walk', [
        slot('walk', x.inclineTreadmill, 'main', '20 minutes easy incline', 'Keep effort relaxed.', 'easy'),
      ]),
      block('mobility', 'Mobility Reset', 10, 'Spine and hamstrings', [
        slot('cat-cow', x.catCow, 'recovery', '2 minutes', 'Breathe slowly.', 'easy'),
        slot('hamstring', x.hamstringStretch, 'recovery', '60 seconds per side', 'Keep it gentle.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'kettlebell-advanced-full-body-50',
    title: 'Kettlebell Advanced Full Body',
    summary: 'A high-effort kettlebell session pairing ballistic hinge work with squat, press, and pull strength for advanced trainees.',
    focus: 'Full Body Athletic Base',
    focusTags: ['full_body', 'lower_body', 'upper_body', 'glutes', 'hamstrings', 'conditioning'],
    styleTags: ['strength', 'conditioning'],
    equipment: ['kettlebell', 'bodyweight'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 50,
    energyLevels: ['intense'],
    qualityScore: 86,
    blocks: [
      block('prep', 'Movement Prep', 8, 'Spine, hips, and trunk', [
        slot('cat-cow', x.catCow, 'warmup', '90 seconds', 'Move slowly through the spine.', 'easy'),
        slot('arm-circles', x.armCircles, 'warmup', '60 seconds', 'Open the shoulders.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 8 per side', 'Set the bracing pattern.', 'easy'),
      ]),
      block('main', 'Power and Strength', 34, 'Swing, squat, press, and pull', [
        slot('swing', x.kettlebellSwing, 'main', '6 x 12', 'Snap the hips; let the bell float.', 'intense'),
        slot('goblet-squat', x.gobletSquat, 'main', '4 x 8', 'Stay tall through the torso.', 'intense'),
        slot('floor-press', x.kettlebellFloorPress, 'main', '4 x 8 per side', 'Keep the shoulder packed.', 'moderate'),
        slot('row', x.kettlebellRow, 'main', '4 x 10 per side', 'Pull to the ribs and pause.', 'moderate'),
        slot('deadlift', x.kettlebellDeadlift, 'accessory', '3 x 8 per side', 'Hinge with a flat back.', 'moderate'),
      ]),
      block('finish', 'Cooldown', 8, 'Hips and posterior chain', [
        slot('child-pose', x.childPose, 'recovery', '3 minutes', 'Let the breath slow.', 'easy'),
        slot('hamstring', x.hamstringStretch, 'recovery', '60 seconds per side', 'Keep the stretch mild.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-advanced-push-45',
    title: 'Dumbbell Advanced Push',
    summary: 'An advanced dumbbell pressing day building chest, shoulder, and arm strength with a dedicated triceps and biceps finish.',
    focus: 'Upper Body Push',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps', 'biceps'],
    styleTags: ['strength'],
    equipment: ['dumbbell', 'bench', 'bodyweight'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 45,
    energyLevels: ['intense'],
    qualityScore: 85,
    blocks: [
      block('prep', 'Press Prep', 6, 'Shoulders and trunk', [
        slot('arm-circles', x.armCircles, 'warmup', '60 seconds', 'Open the shoulders.', 'easy'),
        slot('plank', x.plank, 'warmup', '2 x 30 seconds', 'Brace before pressing.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Set the ribs down.', 'easy'),
      ]),
      block('main', 'Press Strength', 33, 'Chest, shoulders, and arms', [
        slot('bench-press', x.dumbbellBenchPress, 'main', '5 x 6-8', 'Control the descent; press hard.', 'intense'),
        slot('incline-press', x.inclineDumbbellPress, 'main', '4 x 8', 'Keep the path over the upper chest.', 'intense'),
        slot('shoulder-press', x.arnoldPress, 'main', '4 x 8', 'Rotate smoothly without leaning back.', 'moderate'),
        slot('fly', x.dumbbellFly, 'accessory', '3 x 12', 'Soft elbows and a wide arc.', 'moderate'),
        slot('triceps', x.dumbbellTricepsExtension, 'accessory', '3 x 10', 'Keep the elbows tucked.', 'moderate'),
        slot('biceps', x.dumbbellBicepCurl, 'accessory', '3 x 10', 'No swinging.', 'moderate'),
      ]),
      block('finish', 'Cooldown', 6, 'Chest and spine', [
        slot('child-pose', x.childPose, 'recovery', '2 minutes', 'Relax the shoulders.', 'easy'),
        slot('cat-cow', x.catCow, 'recovery', '90 seconds', 'Breathe slowly.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bands-knee-friendly-lower-30',
    title: 'Knee-Friendly Lower Strength',
    summary: 'A hinge-dominant lower-body session built around glute and hamstring work that avoids deep knee loading.',
    focus: 'Glutes and Hamstrings',
    focusTags: ['lower_body', 'glutes', 'hamstrings'],
    styleTags: ['strength'],
    equipment: ['bodyweight', 'resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 30,
    energyLevels: ['easy', 'moderate'],
    qualityScore: 87,
    blocks: [
      block('prep', 'Hip Prep', 5, 'Glutes and spine', [
        slot('cat-cow', x.catCow, 'warmup', '60 seconds', 'Move slowly through the spine.', 'easy'),
        slot('bridge', x.gluteBridge, 'warmup', '2 x 10', 'Pause and squeeze at the top.', 'easy'),
      ]),
      block('strength', 'Posterior Strength', 20, 'Bridges and hinge work', [
        slot('single-leg-bridge', x.singleLegBridge, 'main', '3 x 10 per side', 'Keep the hips level.'),
        slot('hip-extension', x.bandHipExtension, 'main', '3 x 12', 'Drive through the heel.'),
        slot('good-morning', x.bandGoodMorning, 'accessory', '3 x 12', 'Soft knees; hinge from the hips.'),
        slot('monster-walk', x.monsterWalk, 'accessory', '3 x 20 steps', 'Stay low and keep band tension.', 'moderate'),
      ]),
      block('finish', 'Cooldown', 5, 'Hamstrings and hips', [
        slot('child-pose', x.childPose, 'recovery', '2 minutes', 'Let the breath slow.', 'easy'),
        slot('hamstring', x.hamstringStretch, 'recovery', '60 seconds per side', 'Keep the stretch mild.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bodyweight-conditioning-express-20',
    title: 'Bodyweight Conditioning Express',
    summary: 'A short no-equipment conditioning session built from simple low-skill intervals without burpees.',
    focus: 'Conditioning',
    focusTags: ['conditioning', 'full_body', 'lower_body', 'upper_body', 'core'],
    styleTags: ['conditioning', 'cardio'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 20,
    durationRange: { min: 18, max: 25 },
    energyLevels: ['moderate', 'intense'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Prep', 4, 'Joints and breathing', [
        slot('cat-cow', x.catCow, 'warmup', '60 seconds', 'Move smoothly through the spine.', 'easy'),
        slot('squat-primer', x.bodyweightSquat, 'accessory', '2 x 8', 'Use this to find a comfortable rhythm.', 'easy'),
      ]),
      block('intervals', 'Conditioning Circuit', 12, 'Bodyweight intervals', [
        slot('squat', x.bodyweightSquat, 'main', '4 x 30 seconds', 'Move quickly while keeping depth controlled.', 'intense'),
        slot('push', x.inclinePushUp, 'main', '4 x 30 seconds', 'Use a height that lets reps stay clean.', 'moderate', [x.kneePushUp]),
        slot('jog', x.jogInPlace, 'finisher', '4 x 30 seconds', 'Keep the landing quiet and relaxed.', 'intense'),
      ]),
      block('finish', 'Cooldown', 4, 'Breathing reset', [
        slot('walk', x.walking, 'finisher', '3 minutes easy', 'Let breathing settle.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bodyweight-shoulder-safe-full-body-25',
    title: 'Shoulder-Safe Bodyweight Full Body',
    summary: 'A shoulder-friendly full-body option using legs, trunk control, and easy aerobic work.',
    focus: 'Full Body Strength',
    focusTags: ['full_body', 'lower_body', 'upper_body', 'core', 'recovery'],
    styleTags: ['strength', 'recovery'],
    equipment: ['bodyweight'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 25,
    durationRange: { min: 20, max: 30 },
    energyLevels: ['easy', 'moderate'],
    qualityScore: 90,
    blocks: [
      block('prep', 'Prep', 5, 'Spine and brace', [
        slot('cat-cow', x.catCow, 'warmup', '60 seconds', 'Stay pain-free through the shoulders.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Set a quiet brace.', 'easy'),
      ]),
      block('main', 'Strength Circuit', 15, 'Legs and trunk', [
        slot('squat', x.bodyweightSquat, 'main', '3 x 10', 'Use a controlled tempo.', 'moderate'),
        slot('bridge', x.gluteBridge, 'main', '3 x 12', 'Pause at the top.', 'moderate'),
        slot('bird-dog', x.birdDog, 'accessory', '3 x 6 per side', 'Reach long without shrugging.', 'easy'),
      ]),
      block('finish', 'Easy Finish', 5, 'Low-stress circulation', [
        slot('walk', x.walking, 'finisher', '5 minutes easy', 'Keep effort comfortable.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-full-body-primer-20',
    title: 'Dumbbell Full Body Primer',
    summary: 'A quick dumbbell session with push, legs, pull, and core-friendly work.',
    focus: 'Full Body Strength',
    focusTags: ['full_body', 'upper_body', 'lower_body', 'core'],
    styleTags: ['strength'],
    equipment: ['dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 20,
    durationRange: { min: 18, max: 25 },
    energyLevels: ['easy', 'moderate'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Prep', 4, 'Brace and squat pattern', [
        slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Exhale on each reach.', 'easy'),
        slot('squat', x.bodyweightSquat, 'accessory', '2 x 8', 'Use an easy tempo.', 'easy'),
      ]),
      block('main', 'Full Body Circuit', 13, 'Push, legs, and pull', [
        slot('floor-press', x.dumbbellFloorPress, 'main', '3 x 8', 'Pause lightly at the floor.', 'moderate'),
        slot('squat', x.bodyweightSquat, 'main', '3 x 10', 'Keep the pace smooth.', 'easy'),
        slot('row', x.inclineBenchPull, 'accessory', '3 x 8', 'Pull elbows back with control.', 'moderate'),
      ]),
      block('finish', 'Core Close', 3, 'Brace', [
        slot('plank', x.plank, 'accessory', '2 x 25 seconds', 'Stop before form drifts.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-full-body-strength-30',
    title: 'Dumbbell Full Body Strength',
    summary: 'A balanced dumbbell workout for pressing, rowing, legs, and trunk control.',
    focus: 'Full Body Strength',
    focusTags: ['full_body', 'upper_body', 'lower_body', 'core'],
    styleTags: ['strength'],
    equipment: ['dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 30,
    durationRange: { min: 25, max: 40 },
    energyLevels: ['moderate'],
    qualityScore: 92,
    blocks: [
      block('prep', 'Prep', 5, 'Joints and brace', [
        slot('cat-cow', x.catCow, 'warmup', '60 seconds', 'Move comfortably.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Set the ribs down.', 'easy'),
      ]),
      block('strength', 'Full Body Strength', 20, 'Press, row, and legs', [
        slot('floor-press', x.dumbbellFloorPress, 'main', '4 x 8', 'Control each rep.', 'moderate'),
        slot('row', x.inclineBenchPull, 'main', '4 x 8', 'Pause at the top.', 'moderate'),
        slot('lunge', x.reverseLunge, 'main', '3 x 8 per side', 'Step back softly.', 'moderate'),
      ]),
      block('finish', 'Trunk Finish', 5, 'Core control', [
        slot('plank', x.plank, 'accessory', '3 x 25 seconds', 'Brace without holding breath.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-upper-body-30',
    title: 'Dumbbell Upper Body Strength',
    summary: 'A dumbbell-only upper-body workout with press, row, shoulders, and arms.',
    focus: 'Upper Body Strength',
    focusTags: ['upper_body', 'chest', 'middle_back', 'shoulders', 'biceps', 'triceps'],
    styleTags: ['strength'],
    equipment: ['dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 30,
    durationRange: { min: 25, max: 35 },
    energyLevels: ['moderate'],
    qualityScore: 90,
    blocks: [
      block('prep', 'Upper Prep', 5, 'Shoulders and rear delts', [
        slot('scaption', x.dumbbellScaption, 'accessory', '2 x 12 light', 'Move smoothly.', 'easy'),
        slot('rear-delt', x.rearDeltRaise, 'accessory', '2 x 12', 'Keep the neck relaxed.', 'easy'),
      ]),
      block('main', 'Upper Strength', 20, 'Press and pull', [
        slot('floor-press', x.dumbbellFloorPress, 'main', '4 x 8-10', 'Use a strong but clean load.', 'moderate'),
        slot('row', x.inclineBenchPull, 'main', '4 x 8-10', 'Pull elbows back and pause.', 'moderate'),
        slot('lateral-raise', x.sideLateralRaise, 'accessory', '3 x 12', 'Avoid swinging.', 'moderate'),
      ]),
      block('finish', 'Arm Finish', 5, 'Biceps and triceps', [
        slot('curl', x.hammerCurl, 'accessory', '2 x 12', 'Keep wrists neutral.', 'moderate'),
        slot('triceps', x.dumbbellTricepsExtension, 'accessory', '2 x 12', 'Move under control.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-push-core-40',
    title: 'Dumbbell Push and Core',
    summary: 'A pull-sparing dumbbell session for pressing, shoulders, arms, and trunk work.',
    focus: 'Upper Body Push',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps', 'core'],
    styleTags: ['strength'],
    equipment: ['dumbbell'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 40,
    durationRange: { min: 35, max: 45 },
    energyLevels: ['moderate'],
    qualityScore: 88,
    disallowedStressors: ['upper_body_pull_fatigue'],
    blocks: [
      block('prep', 'Push Prep', 6, 'Shoulders and trunk', [
        slot('scaption', x.dumbbellScaption, 'accessory', '2 x 12 light', 'Raise smoothly.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Set a brace.', 'easy'),
      ]),
      block('main', 'Pressing Work', 27, 'Chest, shoulders, and triceps', [
        slot('floor-press', x.dumbbellFloorPress, 'main', '5 x 8', 'Pause lightly on each rep.', 'moderate'),
        slot('fly', x.dumbbellFly, 'accessory', '3 x 10', 'Use a comfortable arc.', 'moderate'),
        slot('lateral-raise', x.sideLateralRaise, 'accessory', '3 x 12', 'Lead with elbows.', 'moderate'),
        slot('triceps', x.dumbbellTricepsExtension, 'accessory', '3 x 10', 'Keep ribs down.', 'moderate'),
      ]),
      block('core', 'Core Close', 7, 'Anti-extension', [
        slot('plank', x.plank, 'accessory', '4 x 25 seconds', 'Stay stacked and steady.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-bench-lower-40',
    title: 'Dumbbell Bench Lower Strength',
    summary: 'A lower-body dumbbell and bench session centered on step-ups, glutes, and trunk control.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'glutes', 'hamstrings', 'quadriceps', 'core'],
    styleTags: ['strength'],
    equipment: ['dumbbell', 'bench'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 40,
    durationRange: { min: 35, max: 50 },
    energyLevels: ['moderate'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Lower Prep', 6, 'Hips and balance', [
        slot('bridge', x.gluteBridge, 'warmup', '2 x 10', 'Pause at the top.', 'easy'),
        slot('squat', x.bodyweightSquat, 'accessory', '2 x 8', 'Use a controlled warm-up pace.', 'easy'),
      ]),
      block('strength', 'Lower Strength', 28, 'Step-ups and posterior chain', [
        slot('step-up', x.dumbbellStepUp, 'main', '4 x 8 per side', 'Drive through the full foot.', 'moderate'),
        slot('single-leg-bridge', x.singleLegBridge, 'main', '3 x 10 per side', 'Keep hips level.', 'moderate'),
        slot('reverse-lunge', x.reverseLunge, 'main', '3 x 8 per side', 'Stay tall and controlled.', 'moderate'),
      ]),
      block('finish', 'Core Finish', 6, 'Brace', [
        slot('dead-bug', x.deadBug, 'accessory', '3 x 8 per side', 'Move slowly.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-band-upper-pump-20',
    title: 'Dumbbell Band Upper Pump',
    summary: 'A quick upper-body pump using dumbbells and bands for lunch-break training.',
    focus: 'Upper Body Strength',
    focusTags: ['upper_body', 'chest', 'middle_back', 'shoulders', 'biceps', 'triceps'],
    styleTags: ['strength', 'bodybuilding'],
    equipment: ['dumbbell', 'resistance_bands'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 20,
    durationRange: { min: 18, max: 25 },
    energyLevels: ['moderate'],
    qualityScore: 89,
    blocks: [
      block('prep', 'Upper Prep', 4, 'Band shoulders', [
        slot('pull-apart', x.bandPullApart, 'warmup', '2 x 15', 'Use light tension.', 'easy'),
      ]),
      block('pump', 'Upper Pump', 13, 'Press, row, and arms', [
        slot('floor-press', x.dumbbellFloorPress, 'main', '3 x 10', 'Keep rest short but clean.', 'moderate'),
        slot('row', x.bandRow, 'main', '3 x 12', 'Pause shoulder blades back.', 'moderate'),
        slot('curl', x.hammerCurl, 'accessory', '2 x 12', 'Stay strict.', 'moderate'),
      ]),
      block('finish', 'Triceps Finish', 3, 'Band arms', [
        slot('triceps', x.bandSkullCrusher, 'accessory', '2 x 15', 'Use smooth tension.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'bands-shoulder-safe-upper-30',
    title: 'Shoulder-Safe Band Upper',
    summary: 'A shoulder-sensitive upper-body band session emphasizing posture, scapular control, and trunk work without overhead pressing.',
    focus: 'Upper Body Posture',
    focusTags: ['upper_body', 'middle_back', 'shoulders', 'core', 'recovery'],
    styleTags: ['strength', 'recovery'],
    equipment: ['resistance_bands'],
    environmentTags: ['home', 'travel'],
    durationMinutes: 30,
    durationRange: { min: 25, max: 35 },
    energyLevels: ['easy', 'moderate'],
    qualityScore: 96,
    blocks: [
      block('prep', 'Shoulder-Friendly Prep', 6, 'Scapular control', [
        slot('pull-apart', x.bandPullApart, 'warmup', '2 x 15 easy', 'Keep range pain-free.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Brace gently.', 'easy'),
      ]),
      block('posture', 'Posture Strength', 18, 'Upper back without overhead loading', [
        slot('face-pull', x.bandFacePull, 'main', '4 x 12', 'Pull toward eye level without shrugging.', 'moderate'),
        slot('pull-apart', x.bandPullApart, 'main', '4 x 15', 'Use smooth shoulder-blade motion.', 'moderate'),
        slot('bird-dog', x.birdDog, 'accessory', '3 x 8 per side', 'Reach long and stay square.', 'easy'),
      ]),
      block('finish', 'Easy Reset', 6, 'Breathing cooldown', [
        slot('cat-cow', x.catCow, 'recovery', '90 seconds', 'Move slowly.', 'easy'),
        slot('child-pose', x.childPose, 'recovery', '2 minutes', 'Keep shoulders relaxed.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'bodyweight-pullup-upper-30',
    title: 'Pull-Up Bar Upper Body',
    summary: 'An upper-body bodyweight session centered on pull-ups, scapular control, pushing, and core.',
    focus: 'Upper Body Pull',
    focusTags: ['upper_body', 'middle_back', 'lats', 'biceps', 'core'],
    styleTags: ['strength'],
    equipment: ['pull_up_bar'],
    environmentTags: ['home', 'gym'],
    durationMinutes: 30,
    durationRange: { min: 25, max: 35 },
    energyLevels: ['moderate'],
    qualityScore: 90,
    blocks: [
      block('prep', 'Pull Prep', 6, 'Scapular control', [
        slot('scapular-pull', x.scapularPullUp, 'accessory', '3 x 5', 'Keep reps small and controlled.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 6 per side', 'Brace gently.', 'easy'),
      ]),
      block('main', 'Upper Strength', 19, 'Pull, push, and trunk', [
        slot('pull-up', x.pullUp, 'main', '4 x submaximal', 'Stop before form breaks.', 'moderate'),
        slot('push-up', x.inclinePushUp, 'main', '4 x 8-12', 'Use a smooth range.', 'moderate'),
        slot('plank', x.plank, 'accessory', '3 x 30 seconds', 'Stay stacked.', 'moderate'),
      ]),
      recoveryFinish(5),
    ],
  }),
  recipe({
    slug: 'dumbbell-treadmill-hotel-full-body-30',
    title: 'Hotel Gym Full Body',
    summary: 'A compact hotel-gym workout using dumbbells, bodyweight strength, and treadmill conditioning.',
    focus: 'Full Body Conditioning',
    focusTags: ['full_body', 'conditioning', 'upper_body', 'lower_body', 'core'],
    styleTags: ['strength', 'conditioning', 'travel'],
    equipment: ['dumbbell', 'treadmill'],
    environmentTags: ['gym', 'travel'],
    durationMinutes: 30,
    durationRange: { min: 25, max: 35 },
    energyLevels: ['moderate'],
    qualityScore: 91,
    blocks: [
      block('warmup', 'Treadmill Warm-up', 6, 'Aerobic ramp', [
        slot('walk', x.treadmillWalk, 'warmup', '6 minutes easy', 'Build gradually.', 'easy'),
      ]),
      block('strength', 'Full Body Strength', 17, 'Press, row, and legs', [
        slot('floor-press', x.dumbbellFloorPress, 'main', '3 x 10', 'Control the floor pause.', 'moderate'),
        slot('row', x.inclineBenchPull, 'main', '3 x 10', 'Pull to the ribs.', 'moderate'),
        slot('squat', x.bodyweightSquat, 'main', '3 x 12', 'Keep reps smooth.', 'moderate'),
      ]),
      block('finish', 'Treadmill Finish', 7, 'Moderate cardio', [
        slot('incline-walk', x.inclineTreadmill, 'finisher', '7 minutes brisk', 'Stay conversational.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'treadmill-recovery-cardio-30',
    title: 'Treadmill Recovery Cardio',
    summary: 'An easy treadmill-only recovery cardio session with a gentle incline option.',
    focus: 'Conditioning Recovery',
    focusTags: ['conditioning', 'recovery', 'lower_body'],
    styleTags: ['cardio', 'recovery'],
    equipment: ['treadmill'],
    environmentTags: ['gym'],
    durationMinutes: 30,
    durationRange: { min: 25, max: 35 },
    energyLevels: ['easy'],
    qualityScore: 94,
    blocks: [
      block('warmup', 'Warm-up Walk', 6, 'Easy ramp', [
        slot('walk', x.treadmillWalk, 'warmup', '6 minutes easy', 'Start relaxed.', 'easy'),
      ]),
      block('cardio', 'Recovery Cardio', 18, 'Steady walking', [
        slot('incline-walk', x.inclineTreadmill, 'main', '18 minutes easy incline', 'Keep effort conversational.', 'easy'),
      ]),
      block('cooldown', 'Cooldown', 6, 'Easy walk', [
        slot('cooldown-walk', x.treadmillWalk, 'recovery', '6 minutes easy', 'Downshift gradually.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'rower-intervals-25',
    title: 'Rower Intervals',
    summary: 'A rower-only interval session with enough warm-up and cooldown to stay repeatable.',
    focus: 'Conditioning',
    focusTags: ['conditioning', 'upper_body', 'lower_body', 'core'],
    styleTags: ['cardio', 'conditioning', 'intervals'],
    equipment: ['rowing_machine'],
    environmentTags: ['gym'],
    durationMinutes: 25,
    durationRange: { min: 20, max: 30 },
    energyLevels: ['moderate', 'intense'],
    qualityScore: 93,
    blocks: [
      block('warmup', 'Warm-up Row', 5, 'Easy technique', [
        slot('row-easy', x.rower, 'main', '5 minutes easy', 'Build stroke rhythm gradually.', 'easy'),
      ]),
      block('intervals', 'Intervals', 15, 'Power repeats', [
        slot('row-intervals', x.rowerMachine, 'main', '8 x 45 seconds hard / 45 seconds easy', 'Drive with legs and sit tall.', 'intense'),
      ]),
      block('cooldown', 'Cooldown Row', 5, 'Easy aerobic finish', [
        slot('row-cooldown', x.rower, 'finisher', '5 minutes easy', 'Let the stroke rate fall.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'barbell-rower-conditioning-45',
    title: 'Barbell Rower Conditioning',
    summary: 'A full-gym conditioning session pairing barbell strength endurance with rowing intervals.',
    focus: 'Conditioning',
    focusTags: ['conditioning', 'full_body', 'lower_body', 'upper_body'],
    styleTags: ['conditioning', 'strength'],
    equipment: ['barbell', 'rowing_machine'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 45,
    durationRange: { min: 40, max: 50 },
    energyLevels: ['intense'],
    qualityScore: 90,
    blocks: [
      block('warmup', 'Warm-up', 7, 'Row and hinge prep', [
        slot('row-easy', x.rower, 'main', '5 minutes easy', 'Build rhythm gradually.', 'easy'),
        slot('rdl-light', x.romanianDeadlift, 'accessory', '2 x 6 light', 'Groove the hinge.', 'easy'),
      ]),
      block('strength', 'Strength Endurance', 22, 'Barbell density', [
        slot('deadlift', x.barbellDeadlift, 'main', '5 x 3', 'Fast, clean singles or triples.', 'intense'),
        slot('row', x.barbellRow, 'main', '4 x 8', 'Pause briefly at the top.', 'moderate'),
      ]),
      block('conditioning', 'Rower Finish', 16, 'Intervals', [
        slot('row-intervals', x.rowerMachine, 'finisher', '6 x 1 minute hard / 1 minute easy', 'Keep power consistent.', 'intense'),
      ]),
    ],
  }),
  recipe({
    slug: 'barbell-lower-strength-75',
    title: 'Barbell Lower Strength 75',
    summary: 'A long barbell lower-body session with squat emphasis and posterior-chain accessories.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'quadriceps', 'glutes', 'hamstrings', 'core'],
    styleTags: ['strength', 'powerlifting'],
    equipment: ['barbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 75,
    durationRange: { min: 70, max: 80 },
    energyLevels: ['intense'],
    qualityScore: 90,
    blocks: [
      block('ramp', 'Squat Ramp', 12, 'Heavy squat prep', [
        slot('squat-ramp', x.barbellSquat, 'accessory', '4 x 4 ramping', 'Add load gradually.', 'easy'),
      ]),
      block('main', 'Squat Strength', 34, 'Primary lower-body work', [
        slot('squat', x.barbellSquat, 'main', '5 x 4', 'Keep every rep powerful.', 'intense'),
        slot('front-squat', x.frontSquat, 'main', '4 x 5', 'Stay upright and braced.', 'intense'),
      ]),
      block('accessory', 'Posterior Accessories', 21, 'Hinge and single-leg support', [
        slot('rdl', x.romanianDeadlift, 'accessory', '4 x 8', 'Own the eccentric.', 'moderate'),
        slot('lunge', x.barbellLunge, 'accessory', '3 x 8 per side', 'Use a moderate load.', 'moderate'),
      ]),
      recoveryFinish(8),
    ],
  }),
  recipe({
    slug: 'climber-pull-core-60',
    title: 'Climber Pull and Core',
    summary: 'A climbing-support session for pull endurance, scapular control, grip-friendly rows, and trunk tension.',
    focus: 'Pull Strength',
    focusTags: ['upper_body', 'middle_back', 'lats', 'biceps', 'core'],
    styleTags: ['strength', 'sport_specific'],
    equipment: ['pull_up_bar', 'resistance_bands', 'dumbbell'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 60,
    durationRange: { min: 55, max: 65 },
    energyLevels: ['moderate'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Scap Prep', 8, 'Shoulder blades and trunk', [
        slot('scapular-pull', x.scapularPullUp, 'accessory', '3 x 5', 'Small controlled reps.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 8 per side', 'Keep ribs down.', 'easy'),
      ]),
      block('endurance', 'Pull Endurance', 30, 'Pull-ups and rows', [
        slot('assisted-pull-up', x.bandAssistedPullUp, 'main', '5 x submaximal', 'Leave 2 reps in reserve.', 'moderate', [x.pullUp]),
        slot('row', x.bandRow, 'main', '4 x 12', 'Pause shoulder blades back.', 'moderate'),
        slot('dumbbell-row', x.inclineBenchPull, 'main', '4 x 10', 'Pull with control.', 'moderate'),
      ]),
      block('core', 'Trunk Tension', 14, 'Anti-extension and posterior chain', [
        slot('plank', x.plank, 'accessory', '4 x 30 seconds', 'Stay long and braced.', 'moderate'),
        slot('bird-dog', x.birdDog, 'accessory', '3 x 8 per side', 'Do not rotate.', 'easy'),
      ]),
      recoveryFinish(8),
    ],
  }),
  recipe({
    slug: 'kettlebell-density-conditioning-60',
    title: 'Kettlebell Density Conditioning',
    summary: 'A long kettlebell density session built around swings, squats, rows, and crisp repeatable work.',
    focus: 'Conditioning',
    focusTags: ['conditioning', 'full_body', 'lower_body', 'upper_body', 'core'],
    styleTags: ['conditioning', 'density', 'strength'],
    equipment: ['kettlebell'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 60,
    durationRange: { min: 55, max: 65 },
    energyLevels: ['intense'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Technique Prep', 8, 'Hinge and squat', [
        slot('deadlift', x.kettlebellDeadlift, 'accessory', '3 x 6 per side', 'Move deliberately.', 'easy'),
        slot('goblet', x.gobletSquat, 'accessory', '2 x 8', 'Find depth and brace.', 'easy'),
      ]),
      block('density', 'Density Block', 36, 'Repeated kettlebell rounds', [
        slot('swing', x.kettlebellSwing, 'main', '10 rounds x 10', 'Rest just enough to keep power crisp.', 'intense'),
        slot('goblet-squat', x.gobletSquat, 'main', '6 x 8', 'Stay tall and steady.', 'intense'),
        slot('row', x.kettlebellRow, 'main', '5 x 8 per side', 'Pause at the ribs.', 'moderate'),
      ]),
      block('finish', 'Press and Cooldown', 16, 'Upper close', [
        slot('floor-press', x.kettlebellFloorPress, 'accessory', '3 x 8 per side', 'Keep shoulders packed.', 'moderate'),
        slot('hamstring', x.hamstringStretch, 'recovery', '60 seconds per side', 'Downshift effort.', 'easy'),
      ]),
    ],
  }),
  recipe({
    slug: 'dumbbell-band-ski-legs-80',
    title: 'Ski Prep Lower Body',
    summary: 'A long lower-body ski-prep session with step-ups, eccentric leg work, hamstrings, and trunk stiffness.',
    focus: 'Lower Body Strength',
    focusTags: ['lower_body', 'glutes', 'hamstrings', 'quadriceps', 'core'],
    styleTags: ['strength', 'sport_specific'],
    equipment: ['dumbbell', 'resistance_bands', 'bench'],
    environmentTags: ['home', 'gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 80,
    durationRange: { min: 75, max: 85 },
    energyLevels: ['moderate'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Ski Prep', 10, 'Hips, knees, and trunk', [
        slot('monster-walk', x.monsterWalk, 'warmup', '3 x 12 steps each way', 'Keep band tension.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '2 x 8 per side', 'Set the brace.', 'easy'),
      ]),
      block('strength', 'Leg Strength', 34, 'Step-ups and unilateral control', [
        slot('step-up', x.dumbbellStepUp, 'main', '5 x 8 per side', 'Lower slowly.', 'moderate'),
        slot('reverse-lunge', x.reverseLunge, 'main', '4 x 8 per side', 'Use a 3-second descent.', 'moderate'),
        slot('single-leg-bridge', x.singleLegBridge, 'main', '4 x 10 per side', 'Keep hips level.', 'moderate'),
      ]),
      block('accessory', 'Eccentric Accessories', 26, 'Quads, hamstrings, and core', [
        slot('leg-extension', x.bandLegExtension, 'accessory', '4 x 12 per side', 'Control the lowering.', 'moderate'),
        slot('leg-curl', x.bandLegCurl, 'accessory', '4 x 12', 'Slow eccentric reps.', 'moderate'),
        slot('plank', x.plank, 'accessory', '4 x 35 seconds', 'Stay stiff through the trunk.', 'moderate'),
      ]),
      recoveryFinish(10),
    ],
  }),
  recipe({
    slug: 'strongman-sandbag-carry-75',
    title: 'Sandbag Carry Strongman',
    summary: 'A garage strongman-style full-body workout with sandbag loading, carries, pull-ups, and trunk work.',
    focus: 'Full Body Strongman',
    focusTags: ['full_body', 'conditioning', 'upper_body', 'lower_body', 'core'],
    styleTags: ['strength', 'conditioning', 'strongman', 'sport_specific'],
    equipment: ['sandbag', 'dumbbell', 'pull_up_bar'],
    environmentTags: ['garage', 'gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 75,
    durationRange: { min: 65, max: 80 },
    energyLevels: ['intense'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Brace Prep', 10, 'Hips, trunk, and shoulders', [
        slot('cat-cow', x.catCow, 'warmup', '90 seconds', 'Move through the spine.', 'easy'),
        slot('dead-bug', x.deadBug, 'warmup', '3 x 6 per side', 'Brace before the heavy work.', 'easy'),
      ]),
      block('main', 'Odd Object Strength', 30, 'Sandbag and pull work', [
        slot('sandbag-load', x.sandbagLoad, 'main', '6 x 3', 'Reset and brace before each rep.', 'intense'),
        slot('pull-up', x.pullUp, 'main', '5 x submaximal', 'Leave clean reps in reserve.', 'moderate'),
      ]),
      block('carry', 'Carry Block', 25, 'Grip and trunk', [
        slot('overhead-carry', x.dumbbellOverheadCarry, 'main', '5 x 30 seconds per side', 'Walk tall and keep ribs down.', 'intense'),
        slot('step-up', x.stepUp, 'accessory', '4 x 10 per side', 'Move steadily under fatigue.', 'moderate'),
      ]),
      recoveryFinish(10),
    ],
  }),
  recipe({
    slug: 'bodybuilding-upper-volume-75',
    title: 'Bodybuilding Upper Volume',
    summary: 'A long upper-body hypertrophy session with pressing, pulling, delts, and direct arm volume.',
    focus: 'Upper Body Bodybuilding',
    focusTags: ['upper_body', 'chest', 'middle_back', 'lats', 'shoulders', 'biceps', 'triceps'],
    styleTags: ['bodybuilding', 'strength'],
    equipment: ['dumbbell', 'bench', 'cable_machine', 'pull_up_bar'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 75,
    durationRange: { min: 70, max: 80 },
    energyLevels: ['moderate'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Upper Prep', 8, 'Shoulders and lats', [
        slot('face-pull', x.cableFacePull, 'warmup', '2 x 15', 'Light and smooth.', 'easy'),
        slot('scaption', x.dumbbellScaption, 'accessory', '2 x 12', 'Raise under control.', 'easy'),
      ]),
      block('press', 'Press Volume', 24, 'Chest and shoulders', [
        slot('bench', x.dumbbellBenchPress, 'main', '4 x 8-10', 'Use a hypertrophy load.', 'moderate'),
        slot('incline', x.inclineDumbbellPress, 'main', '4 x 10', 'Control the descent.', 'moderate'),
        slot('lateral', x.sideLateralRaise, 'accessory', '4 x 12-15', 'Keep tension on the delts.', 'moderate'),
      ]),
      block('pull', 'Back Volume', 24, 'Rows and pulldowns', [
        slot('pulldown', x.cableLatPulldown, 'main', '4 x 10', 'Pull elbows down.', 'moderate'),
        slot('row', x.cableRow, 'main', '4 x 10', 'Pause back.', 'moderate'),
        slot('rear-delt', x.cableRearDeltFly, 'accessory', '3 x 15', 'Use light tension.', 'easy'),
      ]),
      block('arms', 'Arm Finish', 19, 'Direct arm work', [
        slot('curl', x.cableHammerCurl, 'accessory', '3 x 12', 'Keep elbows quiet.', 'moderate'),
        slot('triceps', x.cableTricepsPushdown, 'accessory', '3 x 12', 'Finish each rep fully.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'bodybuilding-leg-day-90',
    title: 'Bodybuilding Leg Day',
    summary: 'A long leg hypertrophy workout with squat, hinge, unilateral, quad, and glute volume.',
    focus: 'Lower Body Bodybuilding',
    focusTags: ['lower_body', 'quadriceps', 'glutes', 'hamstrings', 'core'],
    styleTags: ['bodybuilding', 'strength'],
    equipment: ['barbell', 'bench', 'cable_machine', 'dumbbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 90,
    durationRange: { min: 85, max: 95 },
    energyLevels: ['intense'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Leg Prep', 10, 'Squat and hinge', [
        slot('squat-ramp', x.barbellSquat, 'accessory', '4 x 5 ramping', 'Build gradually.', 'easy'),
      ]),
      block('main', 'Primary Leg Work', 34, 'Squat and hip extension', [
        slot('squat', x.barbellSquat, 'main', '5 x 6-8', 'Use controlled bodybuilding reps.', 'intense'),
        slot('hip-thrust', x.barbellHipThrust, 'main', '4 x 8-10', 'Pause at lockout.', 'moderate'),
      ]),
      block('volume', 'Leg Volume', 32, 'Unilateral and posterior-chain work', [
        slot('step-up', x.dumbbellStepUp, 'main', '4 x 10 per side', 'Keep tension on the working leg.', 'moderate'),
        slot('rdl', x.romanianDeadlift, 'accessory', '4 x 10', 'Slow eccentric.', 'moderate'),
        slot('cable-deadlift', x.cableDeadlift, 'accessory', '3 x 12', 'Use constant tension.', 'moderate'),
      ]),
      recoveryFinish(14),
    ],
  }),
  recipe({
    slug: 'bodybuilding-back-volume-80',
    title: 'Bodybuilding Back Volume',
    summary: 'A long back-focused hypertrophy session with vertical pulls, rows, rear delts, and biceps.',
    focus: 'Pull Bodybuilding',
    focusTags: ['upper_body', 'middle_back', 'lats', 'biceps', 'shoulders'],
    styleTags: ['bodybuilding', 'strength'],
    equipment: ['cable_machine', 'dumbbell', 'pull_up_bar', 'bench'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 80,
    durationRange: { min: 75, max: 85 },
    energyLevels: ['moderate'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Back Prep', 8, 'Scapular control', [
        slot('scapular-pull', x.scapularPullUp, 'accessory', '3 x 5', 'Move with control.', 'easy'),
        slot('face-pull', x.cableFacePull, 'warmup', '2 x 15', 'Light tension.', 'easy'),
      ]),
      block('vertical', 'Vertical Pulls', 24, 'Lats', [
        slot('pull-up', x.pullUp, 'main', '4 x submaximal', 'Stop short of grindy reps.', 'moderate'),
        slot('pulldown', x.cableLatPulldown, 'main', '4 x 10', 'Pull elbows down and in.', 'moderate'),
        slot('straight-arm', x.cableStraightArmPulldown, 'accessory', '3 x 12', 'Keep arms long.', 'moderate'),
      ]),
      block('rows', 'Row Volume', 30, 'Mid-back and rear delts', [
        slot('cable-row', x.cableRow, 'main', '4 x 10', 'Pause at the torso.', 'moderate'),
        slot('dumbbell-row', x.inclineBenchPull, 'main', '4 x 10', 'Use a strict pull.', 'moderate'),
        slot('rear-delt-row', x.cableRearDeltRow, 'accessory', '3 x 12', 'Lead with elbows.', 'moderate'),
      ]),
      block('arms', 'Biceps Finish', 18, 'Arm accessory', [
        slot('curl', x.cablePreacherCurl, 'accessory', '3 x 12', 'Stay strict.', 'moderate'),
        slot('hammer', x.hammerCurl, 'accessory', '3 x 10', 'No swinging.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'powerbuilding-upper-70',
    title: 'Powerbuilding Upper',
    summary: 'An upper-body session that starts with barbell strength and finishes with bodybuilding accessories.',
    focus: 'Upper Body Powerbuilding',
    focusTags: ['upper_body', 'chest', 'middle_back', 'shoulders', 'biceps', 'triceps'],
    styleTags: ['powerbuilding', 'strength', 'bodybuilding'],
    equipment: ['barbell', 'bench', 'cable_machine', 'dumbbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 70,
    durationRange: { min: 65, max: 75 },
    energyLevels: ['moderate'],
    qualityScore: 91,
    blocks: [
      block('ramp', 'Bench Ramp', 8, 'Press setup', [
        slot('bench-ramp', x.barbellBench, 'accessory', '3 x 5 ramping', 'Build gradually.', 'easy'),
      ]),
      block('strength', 'Strength Work', 26, 'Bench and row', [
        slot('bench', x.barbellBench, 'main', '5 x 5', 'Use crisp strength reps.', 'moderate'),
        slot('row', x.barbellRow, 'main', '4 x 6-8', 'Keep torso position fixed.', 'moderate'),
      ]),
      block('hypertrophy', 'Hypertrophy Work', 26, 'Chest, back, and shoulders', [
        slot('incline', x.inclineDumbbellPress, 'main', '4 x 10', 'Control the lowering.', 'moderate'),
        slot('cable-row', x.cableRow, 'main', '4 x 10', 'Pause back.', 'moderate'),
        slot('lateral', x.sideLateralRaise, 'accessory', '3 x 15', 'Keep tension on delts.', 'moderate'),
      ]),
      block('arms', 'Arms', 10, 'Accessory close', [
        slot('curl', x.cableHammerCurl, 'accessory', '3 x 10', 'Strict reps.', 'moderate'),
        slot('triceps', x.cableTricepsPushdown, 'accessory', '3 x 12', 'Full lockout.', 'moderate'),
      ]),
    ],
  }),
  recipe({
    slug: 'powerlifting-squat-day-90',
    title: 'Powerlifting Squat Day',
    summary: 'A long squat-focused powerlifting session with heavy competition work and lower-body assistance.',
    focus: 'Lower Body Powerlifting',
    focusTags: ['lower_body', 'quadriceps', 'glutes', 'hamstrings', 'core'],
    styleTags: ['powerlifting', 'strength'],
    equipment: ['barbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 90,
    durationRange: { min: 85, max: 95 },
    energyLevels: ['intense'],
    qualityScore: 93,
    blocks: [
      block('ramp', 'Competition Squat Ramp', 15, 'Squat preparation', [
        slot('squat-ramp', x.barbellSquat, 'accessory', '5 x 3 ramping', 'Build to working weight.', 'easy'),
      ]),
      block('main', 'Squat Main Work', 38, 'Competition squat', [
        slot('squat', x.barbellSquat, 'main', '5 x 3 @ RPE 7-8', 'Every rep should look repeatable.', 'intense'),
        slot('box-squat', x.boxSquat, 'main', '4 x 4', 'Sit back under control.', 'intense'),
      ]),
      block('accessory', 'Squat Assistance', 27, 'Posterior chain and legs', [
        slot('rdl', x.romanianDeadlift, 'accessory', '4 x 6-8', 'Keep lats tight.', 'moderate'),
        slot('lunge', x.barbellLunge, 'accessory', '3 x 6 per side', 'Stay balanced.', 'moderate'),
      ]),
      recoveryFinish(10),
    ],
  }),
  recipe({
    slug: 'powerlifting-bench-day-75',
    title: 'Powerlifting Bench Day',
    summary: 'A bench-focused powerlifting day with competition pressing, close-grip work, and upper-body accessories.',
    focus: 'Push Powerlifting',
    focusTags: ['upper_body', 'chest', 'shoulders', 'triceps'],
    styleTags: ['powerlifting', 'strength'],
    equipment: ['barbell', 'dumbbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 75,
    durationRange: { min: 70, max: 80 },
    energyLevels: ['moderate', 'intense'],
    qualityScore: 93,
    blocks: [
      block('ramp', 'Bench Ramp', 10, 'Press setup', [
        slot('bench-ramp', x.barbellBench, 'accessory', '4 x 4 ramping', 'Practice the competition setup.', 'easy'),
      ]),
      block('main', 'Bench Main Work', 32, 'Competition and close-grip bench', [
        slot('bench', x.barbellBench, 'main', '5 x 3 @ RPE 7-8', 'Pause each rep on the chest.', 'moderate'),
        slot('close-grip', x.closeGripBench, 'main', '4 x 5', 'Keep elbows controlled.', 'moderate'),
      ]),
      block('accessory', 'Press Assistance', 23, 'Chest, shoulders, and triceps', [
        slot('decline-bench', x.declineBench, 'accessory', '3 x 8', 'Use clean volume.', 'moderate'),
        slot('floor-press', x.dumbbellFloorPress, 'accessory', '3 x 10', 'Pause softly on the floor.', 'moderate'),
        slot('triceps', x.dumbbellTricepsExtension, 'accessory', '3 x 10', 'Keep reps strict.', 'moderate'),
      ]),
      recoveryFinish(10),
    ],
  }),
  recipe({
    slug: 'powerlifting-deadlift-day-85',
    title: 'Powerlifting Deadlift Day',
    summary: 'A deadlift-focused powerlifting session with heavy pulls, rows, and posterior-chain assistance.',
    focus: 'Pull Powerlifting',
    focusTags: ['upper_body', 'middle_back', 'lower_body', 'hamstrings', 'glutes'],
    styleTags: ['powerlifting', 'strength'],
    equipment: ['barbell', 'pull_up_bar'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 85,
    durationRange: { min: 80, max: 90 },
    energyLevels: ['intense'],
    qualityScore: 94,
    blocks: [
      block('ramp', 'Deadlift Ramp', 12, 'Hinge preparation', [
        slot('rdl-light', x.romanianDeadlift, 'accessory', '3 x 5 ramping', 'Build position and brace.', 'easy'),
      ]),
      block('main', 'Deadlift Main Work', 36, 'Competition pull', [
        slot('deadlift', x.barbellDeadlift, 'main', '5 x 2-3 @ RPE 7-8', 'Reset each rep and keep the bar close.', 'intense'),
        slot('rdl', x.romanianDeadlift, 'main', '4 x 6', 'Own the eccentric.', 'moderate'),
      ]),
      block('pull', 'Upper Pull Assistance', 27, 'Back and lats', [
        slot('pull-up', x.pullUp, 'main', '4 x submaximal', 'Leave reps in reserve.', 'moderate'),
        slot('row', x.barbellRow, 'main', '4 x 8', 'Pause at the top.', 'moderate'),
        slot('shrug', x.barbellShrug, 'accessory', '3 x 10', 'Lift straight up.', 'moderate'),
      ]),
      recoveryFinish(10),
    ],
  }),
  recipe({
    slug: 'glute-bodybuilding-70',
    title: 'Glute Bodybuilding',
    summary: 'A glute-biased lower-body hypertrophy session with hip thrusts, step-ups, bands, and hamstring work.',
    focus: 'Lower Body Glute Hypertrophy',
    focusTags: ['lower_body', 'glutes', 'hamstrings', 'quadriceps'],
    styleTags: ['bodybuilding', 'strength'],
    equipment: ['barbell', 'bench', 'dumbbell', 'resistance_bands'],
    environmentTags: ['gym', 'home'],
    minExperienceLevel: 'intermediate',
    durationMinutes: 70,
    durationRange: { min: 65, max: 75 },
    energyLevels: ['moderate'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Glute Prep', 8, 'Band activation', [
        slot('monster-walk', x.monsterWalk, 'warmup', '3 x 12 steps each way', 'Keep tension.', 'easy'),
        slot('bridge', x.gluteBridge, 'warmup', '2 x 12', 'Pause and squeeze.', 'easy'),
      ]),
      block('main', 'Glute Strength', 30, 'Hip extension', [
        slot('hip-thrust', x.barbellHipThrust, 'main', '5 x 8', 'Pause hard at lockout.', 'moderate'),
        slot('glute-bridge', x.barbellGluteBridge, 'main', '4 x 10', 'Keep ribs down.', 'moderate'),
      ]),
      block('volume', 'Glute Volume', 24, 'Unilateral and hamstrings', [
        slot('step-up', x.dumbbellStepUp, 'main', '4 x 10 per side', 'Drive through the heel.', 'moderate'),
        slot('leg-curl', x.bandLegCurl, 'accessory', '4 x 12', 'Slow eccentric.', 'moderate'),
        slot('hip-extension', x.bandHipExtension, 'accessory', '3 x 15 per side', 'Squeeze at the top.', 'moderate'),
      ]),
      recoveryFinish(8),
    ],
  }),
  recipe({
    slug: 'arm-specialization-65',
    title: 'Arm Specialization',
    summary: 'A long upper-body bodybuilding session focused on direct biceps, triceps, delts, and pump work.',
    focus: 'Upper Body Arm Specialization',
    focusTags: ['upper_body', 'biceps', 'triceps', 'shoulders'],
    styleTags: ['bodybuilding', 'strength'],
    equipment: ['cable_machine', 'dumbbell'],
    environmentTags: ['gym'],
    minExperienceLevel: 'advanced',
    durationMinutes: 65,
    durationRange: { min: 60, max: 70 },
    energyLevels: ['moderate'],
    qualityScore: 91,
    blocks: [
      block('prep', 'Arm Prep', 7, 'Elbows and shoulders', [
        slot('face-pull', x.cableFacePull, 'warmup', '2 x 15', 'Light and controlled.', 'easy'),
        slot('scaption', x.dumbbellScaption, 'accessory', '2 x 12', 'Move smoothly.', 'easy'),
      ]),
      block('biceps', 'Biceps Specialization', 22, 'Curl volume', [
        slot('preacher-curl', x.cablePreacherCurl, 'main', '4 x 10-12', 'Control the stretch.', 'moderate'),
        slot('hammer-curl', x.cableHammerCurl, 'main', '4 x 10', 'Keep wrists neutral.', 'moderate'),
        slot('dumbbell-curl', x.dumbbellBicepCurl, 'accessory', '3 x 12', 'No swinging.', 'moderate'),
      ]),
      block('triceps', 'Triceps Specialization', 22, 'Extension and pushdown volume', [
        slot('pushdown', x.cableTricepsPushdown, 'accessory', '4 x 12', 'Lock out cleanly.', 'moderate'),
        slot('overhead-triceps', x.cableTriceps, 'accessory', '4 x 10', 'Keep elbows steady.', 'moderate'),
        slot('dumbbell-triceps', x.dumbbellTricepsExtension, 'accessory', '3 x 10', 'Use a controlled range.', 'moderate'),
      ]),
      block('delts', 'Delt Pump', 14, 'Shoulder finish', [
        slot('lateral', x.sideLateralRaise, 'accessory', '4 x 15', 'Keep constant tension.', 'moderate'),
        slot('rear-delt', x.rearDeltRaise, 'accessory', '3 x 15', 'Use light load.', 'easy'),
      ]),
    ],
  }),
];

if (recipes.length !== TARGET_RECIPE_COUNT) {
  throw new Error(
    `Expected ${TARGET_RECIPE_COUNT} system workout recipes, found ${recipes.length}`,
  );
}

// Enrich recipes from the canonical exercise dataset: fill equipment-valid
// movement-family substitutions for concrete slots and derive recipe-level
// constraint advisories from the exercises actually programmed.
const canonicalExercises = await readJson(paths.generatedCanonical);
const exerciseIndex = new Map(
  canonicalExercises.map((exercise) => [exercise.id, exercise]),
);

let resolvedSubstitutionCount = 0;
for (const builtRecipe of recipes) {
  const usedExerciseIds = new Set();
  for (const builtBlock of builtRecipe.blocks) {
    for (const builtSlot of builtBlock.slots) {
      usedExerciseIds.add(builtSlot.exerciseId);
    }
  }

  const offeredSubstitutions = new Set();
  for (const builtBlock of builtRecipe.blocks) {
    for (const builtSlot of builtBlock.slots) {
      builtSlot.substitutionExerciseIds = resolveSubstitutions(
        builtSlot,
        builtRecipe.equipment,
        usedExerciseIds,
        offeredSubstitutions,
        exerciseIndex,
      );
      resolvedSubstitutionCount += builtSlot.substitutionExerciseIds.length;
    }
  }

  builtRecipe.constraints = deriveRecipeConstraints(builtRecipe, exerciseIndex);
}

await writeJson(paths.systemWorkoutCatalog, {
  schemaVersion: 1,
  catalogVersion: CATALOG_VERSION,
  source: 'system',
  recipes,
});

console.log(
  `Built system workout catalog with ${recipes.length} recipes (${resolvedSubstitutionCount} slot substitutions) at ${paths.systemWorkoutCatalog}`,
);
