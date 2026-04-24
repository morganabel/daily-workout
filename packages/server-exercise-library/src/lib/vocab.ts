const equipmentAliasPairs = [
  ['Bodyweight', 'bodyweight'],
  ['body only', 'bodyweight'],
  ['body weight', 'bodyweight'],
  ['none (bodyweight exercise)', 'bodyweight'],
  ['gym mat', 'bodyweight'],
  ['Dumbbells', 'dumbbell'],
  ['dumbbell', 'dumbbell'],
  ['Barbell', 'barbell'],
  ['barbell', 'barbell'],
  ['olympic barbell', 'barbell'],
  ['trap bar', 'barbell'],
  ['Kettlebells', 'kettlebell'],
  ['kettlebells', 'kettlebell'],
  ['Pull-up Bar', 'pull_up_bar'],
  ['pull-up bar', 'pull_up_bar'],
  ['pullup bar', 'pull_up_bar'],
  ['chin-up bar', 'pull_up_bar'],
  ['Resistance Bands', 'resistance_bands'],
  ['bands', 'resistance_bands'],
  ['resistance bands', 'resistance_bands'],
  ['resistance band', 'resistance_bands'],
  ['Cable Machine', 'cable_machine'],
  ['cable', 'cable_machine'],
  ['machine', 'machine'],
  ['leverage machine', 'machine'],
  ['smith machine', 'machine'],
  ['Bench', 'bench'],
  ['bench', 'bench'],
  ['Incline Bench', 'incline_bench'],
  ['incline bench', 'incline_bench'],
  ['Squat Rack', 'squat_rack'],
  ['squat rack', 'squat_rack'],
  ['Treadmill', 'treadmill'],
  ['treadmill', 'treadmill'],
  ['Rowing Machine', 'rowing_machine'],
  ['rowing machine', 'rowing_machine'],
  ['rower', 'rowing_machine'],
  ['erg', 'rowing_machine'],
  ['Jump Rope', 'jump_rope'],
  ['jump rope', 'jump_rope'],
  ['rope jumping', 'jump_rope'],
  ['Medicine Ball', 'medicine_ball'],
  ['medicine ball', 'medicine_ball'],
  ['Exercise Ball', 'exercise_ball'],
  ['exercise ball', 'exercise_ball'],
  ['stability ball', 'exercise_ball'],
  ['swiss ball', 'exercise_ball'],
  ['bosu ball', 'exercise_ball'],
  ['Foam Roll', 'foam_roller'],
  ['foam roll', 'foam_roller'],
  ['EZ Curl Bar', 'ez_curl_bar'],
  ['e-z curl bar', 'ez_curl_bar'],
  ['sz-bar', 'ez_curl_bar'],
  ['ez barbell', 'ez_curl_bar'],
  ['Sandbag', 'sandbag'],
  ['sandbag', 'sandbag'],
  ['Other', 'other'],
  ['other', 'other'],
] as const;

const equipmentAliasMap = new Map<string, string>(
  equipmentAliasPairs.map(([label, id]) => [label.toLowerCase(), id]),
);

const equipmentPresets: Record<string, string[]> = {
  gym: [
    'bodyweight',
    'barbell',
    'dumbbell',
    'bench',
    'incline_bench',
    'squat_rack',
    'machine',
    'cable_machine',
    'pull_up_bar',
    'resistance_bands',
    'kettlebell',
    'ez_curl_bar',
    'medicine_ball',
    'exercise_ball',
    'foam_roller',
    'rowing_machine',
    'treadmill',
  ],
  full_gym: [
    'bodyweight',
    'barbell',
    'dumbbell',
    'bench',
    'incline_bench',
    'squat_rack',
    'machine',
    'cable_machine',
    'pull_up_bar',
    'resistance_bands',
    'kettlebell',
    'ez_curl_bar',
    'medicine_ball',
    'exercise_ball',
    'foam_roller',
    'rowing_machine',
    'treadmill',
    'jump_rope',
    'sandbag',
    'other',
  ],
  minimal_home: ['bodyweight', 'resistance_bands', 'dumbbell', 'bench'],
  dumbbell_bench: ['bodyweight', 'dumbbell', 'bench', 'incline_bench'],
};

export function normalizeEquipmentId(value: string): string {
  const normalized = value.trim().toLowerCase();
  return (
    equipmentAliasMap.get(normalized) ?? normalized.replace(/[^a-z0-9]+/g, '_')
  );
}

export function expandAvailableEquipment(values: string[]): string[] {
  const expanded = new Set<string>();

  for (const value of values) {
    const normalized = normalizeEquipmentId(value);
    const preset = equipmentPresets[normalized];
    if (preset) {
      for (const equipmentId of preset) {
        expanded.add(equipmentId);
      }
      continue;
    }

    expanded.add(normalized);
  }

  return [...expanded];
}

const experienceRank: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

export function getExperienceRank(value: string): number {
  return experienceRank[value] ?? 0;
}

const loadRank: Record<string, number> = {
  light: 1,
  moderate: 2,
  heavy: 3,
};

export function getLoadRank(value: string): number {
  return loadRank[value] ?? 0;
}

const metadataRank: Record<string, number> = {
  raw: 1,
  derived: 2,
  curated: 3,
  'planner-ready': 4,
};

export function getMetadataCompletenessRank(value: string): number {
  return metadataRank[value] ?? 0;
}

const impactRank: Record<string, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

export function getImpactRank(value: string): number {
  return impactRank[value] ?? Number.MAX_SAFE_INTEGER;
}

const noiseRank: Record<string, number> = {
  quiet: 1,
  moderate: 2,
  loud: 3,
};

export function getNoiseRank(value: string): number {
  return noiseRank[value] ?? Number.MAX_SAFE_INTEGER;
}

const spaceRank: Record<string, number> = {
  small: 1,
  medium: 2,
  large: 3,
};

export function getSpaceRank(value: string): number {
  return spaceRank[value] ?? Number.MAX_SAFE_INTEGER;
}
