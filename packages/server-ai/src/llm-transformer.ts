import type { TodayPlan } from '@workout-agent/shared';
import {
  llmTodayPlanSchema,
  llmTodayPlanFlatSchema,
  todayPlanSchema,
  type LlmTodayPlanFlat,
} from '@workout-agent/shared';
import { attachGeneratedIds } from './providers/utils';

/**
 * Schema versions supported by the LLM transformation layer.
 *
 * - 'v1-current': The current LlmTodayPlan schema (without IDs)
 * - 'v2-flat': Flattened schema with separate blocks and exercises arrays (max depth 3)
 */
export type LlmSchemaVersion = 'v1-current' | 'v2-flat';

/**
 * Result of a transformation operation.
 */
export interface TransformationResult {
  /**
   * The transformed plan in canonical TodayPlan format
   */
  plan: TodayPlan;

  /**
   * The schema version that was used to parse the LLM response
   */
  schemaVersion: LlmSchemaVersion;

  /**
   * Whether the transformation was successful
   */
  success: true;
}

/**
 * Error result when transformation fails.
 */
export interface TransformationError {
  /**
   * Error that occurred during transformation
   */
  error: Error;

  /**
   * Whether the transformation was successful
   */
  success: false;

  /**
   * The schema version that was attempted
   */
  schemaVersion: LlmSchemaVersion;
}

/**
 * Configuration for the transformer.
 */
export interface TransformerConfig {
  /**
   * The schema version to use for parsing LLM responses.
   * If not specified, defaults to 'v1-current'.
   */
  schemaVersion?: LlmSchemaVersion;
}

/**
 * A transformer function that converts an LLM response to canonical TodayPlan.
 */
type TransformerFn = (rawResponse: unknown) => TodayPlan;

/**
 * Enum expansion mapping rules.
 * Maps compact enum values from LLM payload to canonical complex structures.
 */
type EnumExpansionMap = Record<string, unknown>;

/**
 * Registry of enum expansion mappings.
 * Currently empty but extensible for future enum expansion features.
 */
const enumExpansionMaps: Record<string, EnumExpansionMap> = {};

/**
 * Expands enum values in the payload according to mapping rules.
 */
function expandEnums(
  payload: LlmTodayPlanFlat,
  _expansionMap: EnumExpansionMap,
): LlmTodayPlanFlat {
  // Future: implement enum expansion logic here
  // For now, return payload unchanged
  return payload;
}

/**
 * Transforms a flattened LLM payload to canonical TodayPlan.
 * Rebuilds blocks with nested exercises based on blockIndex and order.
 */
function transformFlatToCanonical(flat: LlmTodayPlanFlat): TodayPlan {
  // Validate invariants
  if (flat.blocks.length === 0) {
    throw new Error('blocks array must not be empty');
  }
  if (flat.exercises.length === 0) {
    throw new Error('exercises array must not be empty');
  }

  // Group exercises by blockIndex and validate blockIndex range
  const exercisesByBlock = new Map<number, typeof flat.exercises>();
  const orderSetsByBlock = new Map<number, Set<number>>();

  for (const exercise of flat.exercises) {
    // Validate blockIndex is within bounds
    if (exercise.blockIndex < 0 || exercise.blockIndex >= flat.blocks.length) {
      throw new Error(
        `Invalid blockIndex ${exercise.blockIndex}: must be in range [0, ${flat.blocks.length})`,
      );
    }

    // Track orders per block to detect duplicates
    if (!orderSetsByBlock.has(exercise.blockIndex)) {
      orderSetsByBlock.set(exercise.blockIndex, new Set());
    }
    const orderSet = orderSetsByBlock.get(exercise.blockIndex)!;

    if (orderSet.has(exercise.order)) {
      throw new Error(
        `Duplicate order ${exercise.order} for blockIndex ${exercise.blockIndex}`,
      );
    }
    orderSet.add(exercise.order);

    // Group exercises by blockIndex
    if (!exercisesByBlock.has(exercise.blockIndex)) {
      exercisesByBlock.set(exercise.blockIndex, []);
    }
    exercisesByBlock.get(exercise.blockIndex)!.push(exercise);
  }

  // Rebuild blocks with nested exercises, sorted by order
  const blocks = flat.blocks.map((block, blockIndex) => {
    const blockExercises = exercisesByBlock.get(blockIndex) ?? [];

    // Sort exercises by order to ensure deterministic ordering
    const sortedExercises = [...blockExercises].sort(
      (a, b) => a.order - b.order,
    );

    return {
      ...block,
      exercises: sortedExercises.map((ex) => ({
        name: ex.name,
        prescription: ex.prescription,
        detail: ex.detail,
      })),
    };
  });

  // Validate that all blocks have at least one exercise
  for (let i = 0; i < blocks.length; i++) {
    const blockExercises = exercisesByBlock.get(i) ?? [];
    if (blockExercises.length === 0) {
      throw new Error(`Block at index ${i} has no exercises`);
    }
  }

  // Build canonical plan structure
  const canonicalPlan = {
    focus: flat.focus,
    durationMinutes: flat.durationMinutes,
    equipment: flat.equipment,
    source: flat.source,
    energy: flat.energy,
    summary: flat.summary,
    blocks,
  };

  // Attach generated IDs
  const withIds = attachGeneratedIds(canonicalPlan);

  // Validate the final result matches TodayPlan schema
  return todayPlanSchema.parse(withIds);
}

/**
 * Registry of transformers for each schema version.
 */
const transformerRegistry: Record<LlmSchemaVersion, TransformerFn> = {
  /**
   * V1 (current): Identity transformation with ID attachment.
   *
   * This transformer handles the current LlmTodayPlan schema:
   * - Validates the response against llmTodayPlanSchema
   * - Adds generated UUIDs to plan, blocks, and exercises
   * - Returns the result as TodayPlan
   *
   * This is an "identity" transformation in the sense that it preserves
   * all fields from the LLM response and only adds the missing IDs.
   */
  'v1-current': (rawResponse: unknown): TodayPlan => {
    // Validate against current LlmTodayPlan schema
    const parsed = llmTodayPlanSchema.parse(rawResponse);

    // Attach generated IDs (plan.id, block.id, exercise.id)
    const withIds = attachGeneratedIds(parsed);

    // Validate the final result matches TodayPlan schema
    // This ensures we're returning the canonical format
    return todayPlanSchema.parse(withIds);
  },

  /**
   * V2-flat: Flattened schema transformation with enum expansion support.
   *
   * This transformer handles the flattened LlmTodayPlanFlat schema:
   * - Validates the response against llmTodayPlanFlatSchema
   * - Applies enum expansion rules (if any)
   * - Rebuilds canonical structure by grouping exercises by blockIndex
   * - Validates blockIndex range and order uniqueness
   * - Sorts exercises by order within each block
   * - Adds generated UUIDs to plan, blocks, and exercises
   * - Returns the result as TodayPlan
   */
  'v2-flat': (rawResponse: unknown): TodayPlan => {
    // Validate against flattened schema
    const parsed = llmTodayPlanFlatSchema.parse(rawResponse);

    // Apply enum expansion (currently a no-op, but structured for future use)
    const expanded = expandEnums(parsed, enumExpansionMaps['v2-flat'] ?? {});

    // Transform to canonical structure
    return transformFlatToCanonical(expanded);
  },
};

/**
 * Transforms an LLM response into the canonical TodayPlan schema.
 *
 * This is the main entry point for the transformation layer. It:
 * 1. Selects the appropriate transformer based on schemaVersion
 * 2. Applies the transformation to normalize the LLM response
 * 3. Returns the canonical TodayPlan format
 * 4. Handles transformation errors gracefully
 *
 * @param rawResponse - The raw response from the LLM provider
 * @param config - Configuration for the transformer
 * @returns TransformationResult on success, TransformationError on failure
 *
 * @example
 * ```typescript
 * const result = transformLlmResponse(llmOutput, { schemaVersion: 'v1-current' });
 * if (result.success) {
 *   console.log('Transformed plan:', result.plan);
 *   console.log('Used schema version:', result.schemaVersion);
 * } else {
 *   console.error('Transformation failed:', result.error);
 * }
 * ```
 */
export function transformLlmResponse(
  rawResponse: unknown,
  config: TransformerConfig = {}
): TransformationResult | TransformationError {
  const schemaVersion = config.schemaVersion ?? 'v1-current';

  try {
    // Select the transformer for this schema version
    const transformer = transformerRegistry[schemaVersion];

    if (!transformer) {
      throw new Error(`No transformer registered for schema version: ${schemaVersion}`);
    }

    // Apply the transformation
    const plan = transformer(rawResponse);

    return {
      plan,
      schemaVersion,
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      schemaVersion,
      success: false,
    };
  }
}

/**
 * Configuration for schema selection.
 */
export interface SchemaSelectionConfig {
  /**
   * Explicit override for schema version.
   * If set, this takes precedence over all other selection logic.
   */
  override?: LlmSchemaVersion;

  /**
   * List of schema versions supported by the provider.
   * If only one is provided, that schema is used.
   */
  supportedSchemas?: LlmSchemaVersion[];
}

/**
 * Estimates the JSON size (in characters) of a schema version.
 * This is a static estimate based on the schema structure, not actual data.
 * Used for token-efficient schema selection.
 */
const SCHEMA_SIZE_ESTIMATES: Record<LlmSchemaVersion, number> = {
  // Rough, schema-shape-based estimates; update if schemas change materially.
  // v1-current: nested structure (plan -> blocks[] -> exercises[])
  'v1-current': 2000,
  // v2-flat: flat structure (plan -> blocks[], exercises[])
  'v2-flat': 1500,
};

function estimateSchemaSize(schemaVersion: LlmSchemaVersion): number {
  return SCHEMA_SIZE_ESTIMATES[schemaVersion] ?? SCHEMA_SIZE_ESTIMATES['v1-current'];
}

/**
 * Selects the appropriate schema version based on configuration and provider capabilities.
 *
 * Selection algorithm:
 * 1. If an explicit override is set, use that schema version.
 * 2. Else, if the provider declares only a single supported schema, use it.
 * 3. Else, choose the schema with the smallest estimated JSON size; ties break to `v2-flat`.
 *
 * @param config - Configuration for schema selection
 * @returns The selected schema version
 */
export function selectSchemaVersion(
  config: SchemaSelectionConfig = {},
): LlmSchemaVersion {
  // Step 1: Explicit override takes precedence
  if (config.override) {
    return config.override;
  }

  // Step 2: If only one schema is supported, use it
  const supported = config.supportedSchemas ?? ['v1-current', 'v2-flat'];
  if (supported.length === 1) {
    return supported[0];
  }

  // Step 3: Choose smallest estimated size, tie-break to v2-flat
  const schemaSizes = supported.map((schema) => ({
    schema,
    size: estimateSchemaSize(schema),
  }));

  schemaSizes.sort((a, b) => {
    if (a.size !== b.size) {
      return a.size - b.size; // Smaller size first
    }
    // Tie-break: prefer v2-flat
    if (a.schema === 'v2-flat') return -1;
    if (b.schema === 'v2-flat') return 1;
    return 0;
  });

  return schemaSizes[0].schema;
}

/**
 * Gets the default schema version for LLM transformations.
 * Uses the schema selection algorithm with environment variable override support.
 *
 * @param config - Optional configuration for schema selection
 * @returns The default LlmSchemaVersion to use
 */
export function getDefaultSchemaVersion(
  config: SchemaSelectionConfig = {},
): LlmSchemaVersion {
  // Check for environment variable override
  const rawEnvOverride = process.env.LLM_SCHEMA_VERSION;
  if (rawEnvOverride !== undefined) {
    if (rawEnvOverride === 'v1-current' || rawEnvOverride === 'v2-flat') {
      return selectSchemaVersion({ ...config, override: rawEnvOverride });
    }
    console.warn(
      `[llm-transformer] Ignoring invalid LLM_SCHEMA_VERSION value: "${rawEnvOverride}". ` +
        'Expected "v1-current" or "v2-flat". Falling back to automatic selection.',
    );
  }

  // Use schema selection algorithm
  return selectSchemaVersion(config);
}

/**
 * Gets the Zod schema for a given schema version.
 * Used by providers to generate structured output schemas.
 *
 * @param schemaVersion - The schema version to get the Zod schema for
 * @returns The Zod schema for the specified version
 */
export function getSchemaForVersion(
  schemaVersion: LlmSchemaVersion,
): typeof llmTodayPlanSchema | typeof llmTodayPlanFlatSchema {
  switch (schemaVersion) {
    case 'v1-current':
      return llmTodayPlanSchema;
    case 'v2-flat':
      return llmTodayPlanFlatSchema;
    default:
      return llmTodayPlanSchema;
  }
}
