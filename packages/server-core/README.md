# @workout-agent-ce/server-core

Core dependency-injected handlers and interfaces for the Workout Agent server.

## Purpose

This package provides the framework-agnostic business logic for the Workout Agent API. It exports:

- **Handler Factories**: Create `Request → Response` handlers for API routes
- **Dependency Interfaces**: `AuthProvider`, `GenerationStore`, `ModelRouter`, `UsagePolicy`, `MeteringSink`
- **OSS Defaults**: Stub implementations for Community Edition deployments
- **Utilities**: Error handling, context loading, quick actions

## Usage in Community Edition

```typescript
import {
  StubAuthProvider,
  InMemoryGenerationStore,
  NoOpUsagePolicy,
  NoOpMeteringSink,
  createSnapshotHandler,
  createGenerateHandler,
  createLogWorkoutHandler,
} from '@workout-agent-ce/server-core';
import { DefaultModelRouter } from '@workout-agent-ce/server-ai';

// Instantiate OSS defaults
const auth = new StubAuthProvider();
const store = new InMemoryGenerationStore();
const router = new DefaultModelRouter();
const policy = new NoOpUsagePolicy();
const metering = new NoOpMeteringSink();

// Create handlers
const snapshotHandler = createSnapshotHandler({ auth, store });
const generateHandler = createGenerateHandler({
  auth,
  store,
  router,
  policy,
  metering,
  config: {
    edition: 'OSS',
    defaultApiKeys: {
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
    },
  },
});
const logWorkoutHandler = createLogWorkoutHandler({ auth, store });

// Use in Next.js routes
export async function GET(request: Request) {
  return snapshotHandler(request);
}
```

## Usage in Hosted Deployments

Replace the OSS defaults with production implementations:

```typescript
import {
  createSnapshotHandler,
  createGenerateHandler,
  createLogWorkoutHandler,
} from '@workout-agent-ce/server-core';
import { DefaultModelRouter } from '@workout-agent-ce/server-ai';

// Production implementations (defined in hosted repo)
import { BetterAuthProvider } from './auth';
import { RedisGenerationStore } from './storage';
import { StripeUsagePolicy } from './billing';
import { MixpanelMeteringSink } from './analytics';

const auth = new BetterAuthProvider();
const store = new RedisGenerationStore(redisClient);
const router = new DefaultModelRouter(); // Reuse shareable LLM behavior
const policy = new StripeUsagePolicy(stripeClient);
const metering = new MixpanelMeteringSink(mixpanelClient);

// Create handlers with hosted config
const generateHandler = createGenerateHandler({
  auth,
  store,
  router,
  policy,
  metering,
  config: {
    edition: 'HOSTED',
    // Keys managed server-side or provided via BYOK headers
  },
});
```

## BYOK Safety

The `createGenerateHandler` includes built-in BYOK safety:

- Keys from headers (`x-openai-key`, `x-gemini-key`, `x-ai-key`) are never logged
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
  canGenerate(userId: string, request: GenerationRequest): Promise<PolicyResult>;
  getEntitlements?(userId: string): Promise<Entitlements>; // Optional
}
```

### `MeteringSink`

```typescript
interface MeteringSink {
  recordUsage(event: UsageEvent): Promise<void>;
}
```

## Protocol Version

```typescript
import { PROTOCOL_VERSION } from '@workout-agent-ce/server-core';

// For future /meta endpoint
console.log(PROTOCOL_VERSION); // "1.0.0"
```

## License

See root LICENSE file.
