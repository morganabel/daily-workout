import {
  attachRequestId,
  createLogger,
  getOrCreateRequestId,
} from '@workout-agent-ce/server-core';

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const startedAt = Date.now();
  const log = createLogger({ route: 'api.hello', requestId });

  const res = new Response('Hello, from API!');
  attachRequestId(res, requestId);
  log.info('request completed', {
    method: request.method,
    path: '/api/hello',
    status: res.status,
    durationMs: Date.now() - startedAt,
  });
  return res;
}
