import { z } from 'zod';

export const stageOnePlannerArtifactSchema = z.object({
  mode: z.literal('llm-assisted'),
  confidence: z.enum(['low', 'medium', 'high']),
  planningIntent: z.string().min(1),
  resolvedFocus: z.string().min(1),
  protectStressors: z.array(z.string()),
  avoidStressors: z.array(z.string()),
  styleBiases: z.array(z.string()),
  loadBias: z.enum(['low', 'moderate', 'high', 'unknown']),
  noveltyTarget: z.enum(['low', 'medium', 'high']),
  rerankHints: z.array(z.string()),
  candidateInstructions: z.array(z.string()),
});

export function parseStageOnePlannerArtifact(input: unknown) {
  if (!input || typeof input !== 'object') {
    return stageOnePlannerArtifactSchema.parse(input);
  }

  const record = input as Record<string, unknown>;

  return stageOnePlannerArtifactSchema.parse({
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
        : 'Full Body',
    protectStressors: normalizeStringArray(record.protectStressors),
    avoidStressors: normalizeStringArray(record.avoidStressors),
    styleBiases: normalizeStringArray(record.styleBiases),
    loadBias: normalizeEnum(
      record.loadBias,
      ['low', 'moderate', 'high', 'unknown'],
      'unknown',
    ),
    noveltyTarget: normalizeEnum(
      record.noveltyTarget,
      ['low', 'medium', 'high'],
      'medium',
    ),
    rerankHints: normalizeStringArray(record.rerankHints),
    candidateInstructions: normalizeStringArray(record.candidateInstructions),
  });
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
