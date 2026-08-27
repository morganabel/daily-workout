/**
 * Structured error responses for API endpoints
 */

import type {
  ApiError,
  ApiErrorCode,
  UpgradeMetadata,
} from '@leveza/shared';

export type { ApiError, ApiErrorCode } from '@leveza/shared';

export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  status = 400,
  retryAfter?: number,
  upgrade?: UpgradeMetadata
): Response {
  const error: ApiError = { code, message };
  if (retryAfter !== undefined) {
    error.retryAfter = retryAfter;
  }
  if (upgrade) {
    error.upgrade = upgrade;
  }
  return Response.json(error, { status });
}
