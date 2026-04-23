import { z } from 'zod';
import {
  planningLoadCeilingSchema,
  planningNoveltyTargetSchema,
  planningStageOneConfidenceSchema,
  type StageOnePlannerArtifact,
} from '@workout-agent/shared';

export const stageOnePlannerArtifactSchema = z.object({
  mode: z.literal('llm-assisted'),
  confidence: planningStageOneConfidenceSchema,
  planningIntent: z.string().min(1),
  // OpenAI structured outputs require fields to be required rather than optional.
  resolvedFocus: z.string().min(1).nullable(),
  protectStressors: z.array(z.string()),
  avoidStressors: z.array(z.string()),
  styleBiases: z.array(z.string()),
  loadBias: planningLoadCeilingSchema.nullable(),
  noveltyTarget: planningNoveltyTargetSchema.nullable(),
  rerankHints: z.array(z.string()),
  candidateInstructions: z.array(z.string()),
});

export function parseStageOnePlannerArtifact(
  input: unknown,
): StageOnePlannerArtifact {
  if (input && typeof input === 'object') {
    try {
      const parsed = stageOnePlannerArtifactSchema.parse(input);
      return {
        ...parsed,
        resolvedFocus: parsed.resolvedFocus ?? undefined,
        loadBias: parsed.loadBias ?? undefined,
        noveltyTarget: parsed.noveltyTarget ?? undefined,
      };
    } catch {
      // Fall back to tolerant normalization when providers omit fields like `mode`.
    }
  }

  const record = input as Record<string, unknown>;

  const parsed = stageOnePlannerArtifactSchema.parse({
    mode: 'llm-assisted',
    confidence: normalizeEnum(
      record.confidence,
      ['low', 'medium', 'high'],
      'medium',
    ),
    planningIntent:
      typeof record.planningIntent === 'string' && record.planningIntent.trim()
        ? record.planningIntent.trim()
        : 'Resolve the session intent while preserving hard constraints.',
    resolvedFocus:
      typeof record.resolvedFocus === 'string' && record.resolvedFocus.trim()
        ? record.resolvedFocus.trim()
        : null,
    protectStressors: normalizeStringArray(record.protectStressors),
    avoidStressors: normalizeStringArray(record.avoidStressors),
    styleBiases: normalizeStringArray(record.styleBiases),
    loadBias: normalizeEnum(
      record.loadBias,
      ['low', 'moderate', 'high', 'unknown'],
      'unknown',
    ),
    noveltyTarget: normalizeNullableEnum(record.noveltyTarget, [
      'low',
      'medium',
      'high',
    ]),
    rerankHints: normalizeStringArray(record.rerankHints),
    candidateInstructions: normalizeStringArray(record.candidateInstructions),
  });

  return {
    ...parsed,
    resolvedFocus: parsed.resolvedFocus ?? undefined,
    loadBias: parsed.loadBias ?? undefined,
    noveltyTarget: parsed.noveltyTarget ?? undefined,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return (allowed.find((item) => item === normalized) ?? fallback) as T[number];
}

function normalizeNullableEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return (allowed.find((item) => item === normalized) ?? null) as
    | T[number]
    | null;
}
