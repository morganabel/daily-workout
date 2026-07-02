/**
 * Health / liveness endpoint for Cloud Run and Docker.
 *
 * Reports that the server process is up and which deployment mode it is
 * running in. Kept dependency-free (no DB round-trip) so it can serve as a
 * fast liveness probe; readiness checks that touch the database can be added
 * separately if needed.
 */

import { NextResponse } from 'next/server';
import { getDeploymentMode, resolveEdition } from '@/lib/deployment';

export async function GET(): Promise<Response> {
  return NextResponse.json({
    status: 'healthy',
    mode: getDeploymentMode(),
    edition: resolveEdition(),
    timestamp: new Date().toISOString(),
  });
}
