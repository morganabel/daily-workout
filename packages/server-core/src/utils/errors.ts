/**
 * Structured error responses for API endpoints
 */

import { redactSensitiveStrings } from './logging';
import type {
  ApiError,
  ApiErrorCode,
  UpgradeMetadata,
} from '@workout-agent/shared';

export type { ApiError, ApiErrorCode } from '@workout-agent/shared';

/**
 * Redact any secrets in error messages before returning to clients.
 */
function sanitizeErrorMessage(message: string): string {
  return redactSensitiveStrings(message);
}

export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  status = 400,
  retryAfter?: number,
  upgrade?: UpgradeMetadata
): Response {
  const error: ApiError = { code, message: sanitizeErrorMessage(message) };
  if (retryAfter !== undefined) {
    error.retryAfter = retryAfter;
  }
  if (upgrade) {
    error.upgrade = upgrade;
  }
  return Response.json(error, { status });
}
