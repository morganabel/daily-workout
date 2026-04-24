import type {
  CandidateQuery,
  ExerciseRole,
  ExperienceLevel,
  LoadLevel,
  MetadataCompleteness,
} from '@workout-agent-ce/server-exercise-library';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

export interface BrowserFormValues {
  searchText: string;
  equipment: string;
  focusTags: string;
  injuries: string;
  avoidTags: string;
  styleBias: string;
  notes: string;
  baselineExerciseIds: string;
  experienceLevel: ExperienceLevel | '';
  minimumMetadataCompleteness: MetadataCompleteness;
  loadCeiling: LoadLevel | '';
  blockRole: ExerciseRole | '';
  limit: string;
}

export interface BrowserQueryState {
  formValues: BrowserFormValues;
  query: CandidateQuery;
  variationMode: boolean;
}

export function buildBrowserQueryState(
  searchParams: SearchParamsRecord | undefined,
): BrowserQueryState {
  const formValues: BrowserFormValues = {
    searchText: getFirst(searchParams, 'searchText'),
    equipment: getFirst(searchParams, 'equipment'),
    focusTags: getFirst(searchParams, 'focusTags'),
    injuries: getFirst(searchParams, 'injuries'),
    avoidTags: getFirst(searchParams, 'avoidTags'),
    styleBias: getFirst(searchParams, 'styleBias'),
    notes: getFirst(searchParams, 'notes'),
    baselineExerciseIds: getFirst(searchParams, 'baselineExerciseIds'),
    experienceLevel: parseExperienceLevel(
      getFirst(searchParams, 'experienceLevel'),
    ),
    minimumMetadataCompleteness:
      parseMetadataCompleteness(
        getFirst(searchParams, 'minimumMetadataCompleteness'),
      ) ?? 'planner-ready',
    loadCeiling: parseLoadLevel(getFirst(searchParams, 'loadCeiling')),
    blockRole: parseExerciseRole(getFirst(searchParams, 'blockRole')),
    limit: getFirst(searchParams, 'limit') || '25',
  };

  const availableEquipment = splitCsv(formValues.equipment);
  const focusTags = normalizeFocusTags(splitCsv(formValues.focusTags));
  const contraindicationTags = normalizeContraindicationTags(
    splitCsv(formValues.injuries),
  );
  const avoidTags = normalizeAvoidTags(splitCsv(formValues.avoidTags));
  const styleBias = normalizeStyleBias(splitCsv(formValues.styleBias));
  const baselineExerciseIds = splitCsv(formValues.baselineExerciseIds);
  const environment = deriveEnvironmentConstraints(formValues.notes);
  const searchText = buildSearchText({
    rawSearchText: formValues.searchText,
    availableEquipment,
    focusTags,
    contraindicationTags,
    avoidTags,
    styleBias,
    notes: formValues.notes,
  });

  return {
    formValues,
    variationMode: baselineExerciseIds.length > 0,
    query: {
      availableEquipment: availableEquipment.length
        ? availableEquipment
        : undefined,
      experienceLevel: formValues.experienceLevel || undefined,
      contraindicationTags: contraindicationTags.length
        ? contraindicationTags
        : undefined,
      avoidTags: avoidTags.length ? avoidTags : undefined,
      searchText,
      environment,
      focusTags: focusTags.length ? focusTags : undefined,
      blockRole: formValues.blockRole || undefined,
      loadCeiling: formValues.loadCeiling || undefined,
      styleBias: styleBias.length ? styleBias : undefined,
      baselineExerciseIds: baselineExerciseIds.length
        ? baselineExerciseIds
        : undefined,
      minimumMetadataCompleteness: formValues.minimumMetadataCompleteness,
      limit: parseLimit(formValues.limit),
    },
  };
}

function getFirst(
  searchParams: SearchParamsRecord | undefined,
  key: string,
): string {
  const value = searchParams?.[key];
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}

function splitCsv(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function parseLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 25;
  }

  return Math.min(parsed, 200);
}

function parseExperienceLevel(value: string): ExperienceLevel | '' {
  return ['beginner', 'intermediate', 'advanced'].includes(value)
    ? (value as ExperienceLevel)
    : '';
}

function parseMetadataCompleteness(
  value: string,
): MetadataCompleteness | undefined {
  return ['raw', 'derived', 'curated', 'planner-ready'].includes(value)
    ? (value as MetadataCompleteness)
    : undefined;
}

function parseLoadLevel(value: string): LoadLevel | '' {
  return ['light', 'moderate', 'heavy'].includes(value)
    ? (value as LoadLevel)
    : '';
}

function parseExerciseRole(value: string): ExerciseRole | '' {
  return ['warmup', 'main', 'accessory', 'finisher', 'recovery'].includes(value)
    ? (value as ExerciseRole)
    : '';
}

function normalizeFocusTags(values: string[]): string[] {
  const tags = new Set<string>();

  for (const value of values) {
    const normalized = normalizeToken(value);

    if (normalized.includes('upper_body')) {
      tags.add('upper_body');
    }
    if (normalized.includes('lower_body') || normalized.includes('legs')) {
      tags.add('lower_body');
    }
    if (normalized.includes('full_body')) {
      tags.add('full_body');
    }
    if (normalized.includes('core') || normalized.includes('abs')) {
      tags.add('core');
      tags.add('abdominals');
    }
    if (normalized.includes('mobility')) {
      tags.add('mobility');
    }
    if (normalized.includes('recovery')) {
      tags.add('recovery');
    }
    if (
      normalized.includes('conditioning') ||
      normalized.includes('cardio') ||
      normalized.includes('endurance')
    ) {
      tags.add('conditioning');
    }

    if (!tags.has(normalized)) {
      tags.add(normalized);
    }
  }

  return [...tags];
}

function normalizeContraindicationTags(values: string[]): string[] {
  const tags = new Set<string>();

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (normalized.includes('shoulder')) {
      tags.add('shoulder_irritation');
      continue;
    }
    if (normalized.includes('back') || normalized.includes('lumbar')) {
      tags.add('lower_back_sensitivity');
      continue;
    }
    if (normalized.includes('knee')) {
      tags.add('knee_sensitivity');
      continue;
    }

    tags.add(normalized);
  }

  return [...tags];
}

function normalizeAvoidTags(values: string[]): string[] {
  const tags = new Set<string>();

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (normalized.includes('burpee')) {
      tags.add('burpee');
      continue;
    }
    if (normalized.includes('jump')) {
      tags.add('jumping');
      continue;
    }
    if (normalized.includes('overhead')) {
      tags.add('overhead_pressing');
      continue;
    }

    tags.add(normalized);
  }

  return [...tags];
}

function normalizeStyleBias(values: string[]): string[] {
  const tags = new Set<string>();

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (normalized.includes('strength')) {
      tags.add('strength');
      continue;
    }
    if (normalized.includes('mobility')) {
      tags.add('mobility');
      continue;
    }
    if (normalized.includes('recovery')) {
      tags.add('recovery');
      continue;
    }
    if (normalized.includes('cardio') || normalized.includes('conditioning')) {
      tags.add('cardio');
      tags.add('conditioning');
      continue;
    }
    if (normalized.includes('strongman')) {
      tags.add('strongman');
      continue;
    }

    tags.add(normalized);
  }

  return [...tags];
}

function deriveEnvironmentConstraints(
  notes: string,
): CandidateQuery['environment'] {
  const normalizedNotes = notes.toLowerCase();
  const environment: NonNullable<CandidateQuery['environment']> = {};

  if (
    normalizedNotes.includes('quiet') ||
    normalizedNotes.includes('apartment')
  ) {
    environment.quietRequired = true;
    environment.maxNoise = 'quiet';
  }

  if (
    normalizedNotes.includes('low impact') ||
    normalizedNotes.includes('low-impact') ||
    normalizedNotes.includes('no jumping') ||
    normalizedNotes.includes('no-jumping')
  ) {
    environment.maxImpact = 'low';
  }

  if (
    normalizedNotes.includes('hotel') ||
    normalizedNotes.includes('travel') ||
    normalizedNotes.includes('on the road')
  ) {
    environment.travelFriendlyRequired = true;
  }

  if (
    normalizedNotes.includes('no floor') ||
    normalizedNotes.includes('standing only')
  ) {
    environment.floorAvailable = false;
  }

  return Object.keys(environment).length ? environment : undefined;
}

function buildSearchText({
  rawSearchText,
  availableEquipment,
  focusTags,
  contraindicationTags,
  avoidTags,
  styleBias,
  notes,
}: {
  rawSearchText: string;
  availableEquipment: string[];
  focusTags: string[];
  contraindicationTags: string[];
  avoidTags: string[];
  styleBias: string[];
  notes: string;
}): string | undefined {
  if (rawSearchText.trim()) {
    return rawSearchText.trim();
  }

  const tokens = new Set<string>();

  for (const equipment of availableEquipment) {
    tokens.add(normalizeEquipmentSearchToken(equipment));
  }

  for (const tag of [...focusTags, ...styleBias]) {
    tokens.add(tag.replace(/_/g, ' '));
  }

  for (const tag of [...contraindicationTags, ...avoidTags]) {
    tokens.add(tag.replace(/_/g, ' '));
  }

  const normalizedNotes = notes.toLowerCase();
  if (normalizedNotes.includes('quiet')) {
    tokens.add('quiet');
  }
  if (normalizedNotes.includes('apartment')) {
    tokens.add('apartment');
  }
  if (normalizedNotes.includes('travel') || normalizedNotes.includes('hotel')) {
    tokens.add('travel');
    tokens.add('hotel');
  }
  if (
    normalizedNotes.includes('low impact') ||
    normalizedNotes.includes('low-impact')
  ) {
    tokens.add('low impact');
  }
  if (
    normalizedNotes.includes('conditioning') ||
    normalizedNotes.includes('cardio')
  ) {
    tokens.add('conditioning');
  }

  const searchText = [...tokens].join(' ').trim();
  return searchText || undefined;
}

function normalizeEquipmentSearchToken(value: string): string {
  return value.toLowerCase().replace(/pull-up/g, 'pull up');
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}
