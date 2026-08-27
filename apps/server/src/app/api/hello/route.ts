import {
  attachRequestId,
  createRequestContext,
} from '@leveza/server-core';

export async function GET(request: Request) {
  const { requestId, startedAt, log } = createRequestContext(request, 'api.hello');

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
