import type { TodayPlan } from '@workout-agent/shared';
import { llmTodayPlanSchema, todayPlanSchema } from '@workout-agent/shared';
import { attachGeneratedIds } from './ai-providers/utils';

/**
 * Schema versions supported by the LLM transformation layer.
 *
 * - 'v1-current': The current LlmTodayPlan schema (without IDs)
 * - Future versions can be added here as simplified schemas evolve
 */
export type LlmSchemaVersion = 'v1-current';

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
 * Gets the default schema version for LLM transformations.
 * This can be overridden by environment variables or feature flags in the future.
 *
 * @returns The default LlmSchemaVersion to use
 */
export function getDefaultSchemaVersion(): LlmSchemaVersion {
  // In the future, this could read from:
  // - Environment variable: process.env.LLM_SCHEMA_VERSION
  // - Feature flag service
  // - Configuration file
  return 'v1-current';
}
