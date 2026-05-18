/**
 * Structured error responses for API endpoints
 */

import type { ApiErrorCode } from '@workout-agent-ce/server-core';

export type { ApiErrorCode };

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  retryAfter?: number; // seconds
}

export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  status = 400,
  retryAfter?: number
): Response {
  const error: ApiError = { code, message };
  if (retryAfter !== undefined) {
    error.retryAfter = retryAfter;
  }
  return Response.json(error, { status });
}
