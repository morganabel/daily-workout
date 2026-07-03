/**
 * Readiness endpoint.
 *
 * Unlike /api/health (a dependency-free liveness check), this warms the auth
 * context and verifies database connectivity, so a deployment that cannot reach
 * its database reports "not ready" (503) instead of appearing healthy. Point a
 * deployment's readiness / startup probe at this route.
 */

import { NextResponse } from 'next/server';
import { ping } from '@workout-agent-ce/server-db';
import { getAuthContext } from '@/lib/auth-context';
import { getDeploymentMode, resolveEdition } from '@/lib/deployment';

function readinessErrorMessage(error: unknown): string {
  if (process.env.NODE_ENV === 'production') {
    return 'Readiness check failed';
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET(): Promise<Response> {
  const mode = getDeploymentMode();
  const edition = resolveEdition();

  try {
    const ctx = await getAuthContext();
    if (ctx.db) {
      await ping(ctx.db);
    }
    return NextResponse.json({
      status: 'ready',
      mode,
      edition,
      database: ctx.db ? 'connected' : 'not-configured',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ready] not ready:', error);
    return NextResponse.json(
      {
        status: 'not-ready',
        mode,
        edition,
        error: readinessErrorMessage(error),
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
