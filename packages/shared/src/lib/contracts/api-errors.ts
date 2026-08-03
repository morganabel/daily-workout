import { z } from 'zod';
import { upgradeMetadataSchema } from './billing';

export const apiErrorCodeSchema = z.enum([
  'BYOK_REQUIRED',
  'AI_PROVIDER_NOT_CONFIGURED',
  'QUOTA_EXCEEDED',
  'ACCOUNT_RATE_LIMITED',
  'CONCURRENCY_LIMITED',
  'SPEND_LIMIT_EXCEEDED',
  'CONFLICT',
  'UNAUTHORIZED',
  'SERVICE_UNAVAILABLE',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'NOT_IMPLEMENTED',
  'INVALID_PROVIDER',
  'AI_GENERATION_ERROR',
  'WORKOUT_CATALOG_NO_MATCH',
  'WORKOUT_CATALOG_UNAVAILABLE',
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z
  .object({
    code: apiErrorCodeSchema,
    message: z.string(),
    retryAfter: z.number().int().positive().optional(),
    upgrade: upgradeMetadataSchema.optional(),
  })
  .strict();

export type ApiError = z.infer<typeof apiErrorSchema>;
