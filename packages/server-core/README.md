# @leveza/server-core

Core dependency-injected handlers and interfaces for the Leveza server.

## Purpose

This package provides the framework-agnostic business logic for the Leveza API. It exports:

- **Handler Factories**: Create `Request → Response` handlers for API routes
- **Dependency Interfaces**: `AuthProvider`, `GenerationStore`, and `ModelRouter`, plus the canonical `UsagePolicy` and `MeteringSink` contracts from the `quotas` and `metering` packages
- **CE Defaults**: Stub implementations for Community Edition deployments
- **Utilities**: Error handling, context loading, generation planning

## Usage in Community Edition

```typescript
import { StubAuthProvider, InMemoryGenerationStore, NoOpUsagePolicy, NoOpMeteringSink, createGenerateHandler } from '@leveza/server-core';
import { DefaultModelRouter } from '@leveza/server-ai';

// Instantiate CE defaults
const auth = new StubAuthProvider();
const store = new InMemoryGenerationStore();
const router = new DefaultModelRouter();
const policy = new NoOpUsagePolicy();
const metering = new NoOpMeteringSink();

// Create handlers
const generateHandler = createGenerateHandler({
  auth,
  store,
  router,
  policy,
  metering,
  config: {
    edition: 'CE',
    defaultApiKeys: {
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
    },
  },
});

// Use in Next.js routes
export async function POST(request: Request) {
  return generateHandler(request);
}
```

## Usage in Hosted Deployments

The consolidated server owns hosted composition in `apps/server/src/lib/wiring.ts`. Its adapters implement the canonical contracts from `@leveza/quotas` and `@leveza/metering`; hosted deployments do not fork `server-core` or define app-local quota and metering interfaces.

## BYOK Safety

The `createGenerateHandler` includes built-in BYOK safety:

- Keys from headers (`x-openai-key`, `x-gemini-key`, `x-ai-key`) are never logged; OpenRouter BYOK uses the generic `x-ai-key` header
- Keys are not persisted to storage
- Error messages are sanitized to redact key patterns
- Keys are used only for upstream provider calls, then discarded

## Interfaces

### `AuthProvider`

```typescript
interface AuthProvider {
  authenticate(request: Request): Promise<AuthResult | null>;
}
```

### `GenerationStore`

```typescript
interface GenerationStore {
  getState(deviceToken: string): Promise<GenerationState>;
  markPending(deviceToken: string, etaSeconds: number): Promise<void>;
  persistPlan(deviceToken: string, plan: TodayPlan, metadata?: { schemaVersion?: string }): Promise<void>;
  setError(deviceToken: string, message: string): Promise<void>;
  clearPlan(deviceToken: string): Promise<void>;
}
```

### `ModelRouter`

```typescript
interface ModelRouter {
  generate(request: GenerationRequest, context: GenerationContext, options: ModelGenerationOptions): Promise<GenerationResult>;
  isSupportedProvider(provider: string): boolean;
  getDefaultProvider(): string;
}
```

### `UsagePolicy`

```typescript
interface UsagePolicy {
  reserveGenerate(request: { accountId: string; operationId: string; operation: 'generate' | 'regenerate' }): Promise<IncludedGenerationReserveResult>;
  commitGenerateReservation(reservation: IncludedGenerationReservation): Promise<void>;
  rollbackGenerateReservation(reservation: IncludedGenerationReservation): Promise<void>;
}
```

`UsagePolicy` is defined by `@leveza/quotas`; `MeteringSink` is defined by `@leveza/metering`. `server-core` consumes and re-exports those contracts rather than defining competing shapes.

### `MeteringSink`

```typescript
interface MeteringSink {
  recordUsage(event: UsageEvent): Promise<void>;
}
```

## Protocol Version

```typescript
import { PROTOCOL_VERSION } from '@leveza/server-core';

// For future /meta endpoint
console.log(PROTOCOL_VERSION); // "1.0.0"
```

## License

See root LICENSE file.
