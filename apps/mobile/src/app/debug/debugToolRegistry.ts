import {
  type MobileDebugToolName,
  type MobileDebugToolResponse,
  mobileDebugToolRequestSchema,
  redactDebugValue,
} from '@workout-agent/shared';

type DebugToolHandler = (input: unknown) => Promise<unknown> | unknown;
type DebugToolError = Extract<
  MobileDebugToolResponse,
  { ok: false }
>['error'];

const handlers = new Map<MobileDebugToolName, DebugToolHandler>();

const toDebugError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      code: 'TOOL_ERROR',
      message: error.message,
    };
  }

  return {
    code: 'TOOL_ERROR',
    message: String(error),
  };
};

export function registerDebugTool(
  name: MobileDebugToolName,
  handler: DebugToolHandler,
): () => void {
  handlers.set(name, handler);
  return () => {
    handlers.delete(name);
  };
}

export function clearDebugTools(): void {
  handlers.clear();
}

export async function dispatchDebugTool(
  rawRequest: unknown,
): Promise<MobileDebugToolResponse> {
  const parsed = mobileDebugToolRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return {
      id: 'invalid-request',
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid mobile debug tool request',
        details: parsed.error.issues,
      },
    };
  }

  const request = parsed.data;
  const handler = handlers.get(request.tool);
  if (!handler) {
    return {
      id: request.id,
      ok: false,
      error: {
        code: 'TOOL_NOT_FOUND',
        message: `No mobile debug handler registered for '${request.tool}'`,
      },
    };
  }

  try {
    const result = await handler(request.input);
    return {
      id: request.id,
      ok: true,
      result: redactDebugValue(result),
    };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: redactDebugValue(toDebugError(error)) as DebugToolError,
    };
  }
}
