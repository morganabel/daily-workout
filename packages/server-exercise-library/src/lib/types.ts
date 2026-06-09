export const metadataCompletenessValues = [
  'raw',
  'derived',
  'curated',
  'planner-ready',
] as const;

export type MetadataCompleteness = (typeof metadataCompletenessValues)[number];

export const experienceLevelValues = [
  'beginner',
  'intermediate',
  'advanced',
] as const;
export type ExperienceLevel = (typeof experienceLevelValues)[number];

export const impactLevelValues = ['none', 'low', 'moderate', 'high'] as const;
export type ImpactLevel = (typeof impactLevelValues)[number];

export const noiseLevelValues = ['quiet', 'moderate', 'loud'] as const;
export type NoiseLevel = (typeof noiseLevelValues)[number];

export const spaceFootprintValues = ['small', 'medium', 'large'] as const;
export type SpaceFootprint = (typeof spaceFootprintValues)[number];

export const loadLevelValues = ['light', 'moderate', 'heavy'] as const;
export type LoadLevel = (typeof loadLevelValues)[number];

export const exerciseRoleValues = [
  'warmup',
  'main',
  'accessory',
  'finisher',
  'recovery',
] as const;
export type ExerciseRole = (typeof exerciseRoleValues)[number];

export interface SourceRef {
  source: string;
  sourceId: string;
  sourceVersion: string;
  sourceUrl?: string;
}

export interface ExerciseRecord {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  description: string;
  instructionSteps: string[];
  requiredEquipment: string[];
  optionalEquipment: string[];
  focusTags: string[];
  movementTags: string[];
  styleTags: string[];
  stressorTags: string[];
  contraindicationTags: string[];
  avoidTags: string[];
  impactLevel: ImpactLevel;
  noiseLevel: NoiseLevel;
  spaceFootprint: SpaceFootprint;
  travelFriendly: boolean;
  floorRequired: boolean;
  experienceLevelMin: ExperienceLevel;
  loadLevel: LoadLevel;
  allowedRoles: ExerciseRole[];
  metadataCompleteness: MetadataCompleteness;
  sortKey: number;
  sourceRefs: SourceRef[];
}

export interface CanonicalExerciseRecord extends ExerciseRecord {
  sourceId: string;
}

export interface EnvironmentConstraints {
  quietRequired?: boolean;
  maxImpact?: ImpactLevel | 'any';
  maxNoise?: NoiseLevel | 'any';
  maxSpaceFootprint?: SpaceFootprint;
  travelFriendlyRequired?: boolean;
  floorAvailable?: boolean;
}

export interface CandidateQuery {
  availableEquipment?: string[];
  experienceLevel?: ExperienceLevel;
  contraindicationTags?: string[];
  avoidTags?: string[];
  searchText?: string;
  environment?: EnvironmentConstraints;
  focusTags?: string[];
  blockRole?: ExerciseRole;
  disallowedStressors?: string[];
  loadCeiling?: LoadLevel;
  styleBias?: string[];
  excludeExerciseIds?: string[];
  baselineExerciseIds?: string[];
  minimumMetadataCompleteness?: MetadataCompleteness;
  limit?: number;
}

export interface CandidateDiagnostics {
  blockerCodes: Array<
    | 'unsupported_equipment'
    | 'focus_gap'
    | 'role_gap'
    | 'planner_ready_gap'
    | 'stressor_conflict'
    | 'constraint_conflict'
  >;
  counts: Partial<{
    relaxedEquipment: number;
    relaxedFocus: number;
    relaxedRole: number;
    relaxedStressors: number;
    lowerCompleteness: number;
  }>;
}

export interface CandidateResult {
  exercises: ExerciseRecord[];
  totalEligibleCount: number;
  libraryVersion: string;
  diagnostics?: CandidateDiagnostics;
}

export type WorkoutCatalogDecision = 'direct' | 'adapt' | 'none';

export type WorkoutCatalogEnergy = 'easy' | 'moderate' | 'intense';

export interface WorkoutCatalogQuery {
  timeMinutes?: number;
  focus?: string;
  focusTags?: string[];
  availableEquipment?: string[];
  experienceLevel?: ExperienceLevel;
  energy?: WorkoutCatalogEnergy;
  contraindicationTags?: string[];
  avoidTags?: string[];
  disallowedStressors?: string[];
  recentExerciseIds?: string[];
  adaptivePlanIntent?: {
    role?: string;
    category?: string;
    label?: string;
    stressTags?: string[];
  };
  limit?: number;
}

export interface WorkoutCatalogDiagnostics {
  blockerCodes: Array<
    | 'unsupported_equipment'
    | 'duration_gap'
    | 'experience_gap'
    | 'focus_gap'
    | 'energy_gap'
    | 'stressor_conflict'
    | 'constraint_conflict'
    | 'weak_match'
  >;
  candidateCount: number;
  bestScore?: number;
  selectedRecipeId?: string;
  reasons: string[];
}

export interface WorkoutCatalogSlot {
  id: string;
  order: number;
  exercise: ExerciseRecord;
  role: ExerciseRole;
  prescription: string;
  detail: string | null;
  intensity: WorkoutCatalogEnergy;
  substitutionExerciseIds: string[];
}

export interface WorkoutCatalogBlock {
  id: string;
  order: number;
  title: string;
  durationMinutes: number;
  focus: string;
  slots: WorkoutCatalogSlot[];
}

export interface WorkoutCatalogRecipe {
  id: string;
  slug: string;
  ownership: 'system';
  version: number;
  status: 'active';
  title: string;
  summary: string;
  focus: string;
  targetDurationMinutes: number;
  durationRange: {
    min: number;
    max: number;
  };
  minExperienceLevel: ExperienceLevel;
  qualityScore: number;
  catalogVersion: string;
  source: string;
  equipment: string[];
  focusTags: string[];
  styleTags: string[];
  environmentTags: string[];
  energyLevels: WorkoutCatalogEnergy[];
  constraints: Record<string, string[]>;
  blocks: WorkoutCatalogBlock[];
}

export interface WorkoutCatalogMaterializedPlan {
  id: string;
  focus: string;
  durationMinutes: number;
  equipment: string[];
  source: 'library';
  energy: WorkoutCatalogEnergy;
  summary: string;
  blocks: Array<{
    id: string;
    title: string;
    durationMinutes: number;
    focus: string;
    exercises: Array<{
      id: string;
      name: string;
      prescription: string;
      detail: string | null;
    }>;
  }>;
}

export interface WorkoutCatalogMatch {
  decision: WorkoutCatalogDecision;
  recipe?: WorkoutCatalogRecipe;
  plan?: WorkoutCatalogMaterializedPlan;
  score?: number;
  diagnostics: WorkoutCatalogDiagnostics;
}

export interface ExerciseLibraryMetadata {
  libraryVersion: string;
  sourceVersion: string;
  builtAt: string;
  exerciseCount: number;
  plannerReadyCount: number;
}

export interface ExerciseLibrary {
  getExerciseById(id: string): ExerciseRecord | null;
  getExerciseByAlias(nameOrAlias: string): ExerciseRecord | null;
  countEligibleExercises(query: CandidateQuery): number;
  listEligibleExercises(query: CandidateQuery): CandidateResult;
  listVariationCandidates(query: CandidateQuery): CandidateResult;
  matchWorkoutCatalog(query: WorkoutCatalogQuery): WorkoutCatalogMatch;
  getLibraryMetadata(): ExerciseLibraryMetadata;
  close(): void;
}
