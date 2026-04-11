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

export interface CandidateResult {
  exercises: ExerciseRecord[];
  totalEligibleCount: number;
  libraryVersion: string;
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
  getLibraryMetadata(): ExerciseLibraryMetadata;
  close(): void;
}
