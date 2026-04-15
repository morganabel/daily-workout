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
