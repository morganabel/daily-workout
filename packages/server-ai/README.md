# @leveza/server-ai

Shareable AI provider implementation for workout generation.

## Purpose

This package contains the LLM providers, prompts, and transformation logic shared between Community Edition and hosted deployments. Both can use identical AI behavior without code duplication.

## Contents

- **Providers**: OpenAI, Gemini, and OpenRouter implementations
- **Prompts**: Workout generation prompts
- **Transformer**: LLM response normalization (v1-current, v2-flat schemas)
- **DefaultModelRouter**: Implements `ModelRouter` interface from `server-core`

## Usage

```typescript
import { DefaultModelRouter } from '@leveza/server-ai';

const router = new DefaultModelRouter();

// Use with server-core handler factories
const generateHandler = createGenerateHandler({
  // ... other deps
  router,
  config: {
    defaultApiKeys: {
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
    },
  },
});
```

## Supported Providers

- **OpenAI**: `gpt-5.6-luna` for planning and generation by default
- **Gemini**: `gemini-3.1-flash-lite` planning and `gemini-3.5-flash` generation; supports Vertex AI ADC
- **OpenRouter**: `deepseek/deepseek-v4-flash-0731` for planning and generation by default, using strict structured outputs

## Schema Versions

The transformer supports multiple LLM response schemas:

### v1-current (default)

Nested structure: `plan → blocks[] → exercises[]`

```typescript
{
  focus: "Full Body",
  durationMinutes: 30,
  equipment: ["Bodyweight"],
  blocks: [
    {
      type: "warmup",
      exercises: [{ name: "...", prescription: "...", detail: "..." }]
    }
  ]
}
```

### v2-flat

Flattened structure with separate arrays (max depth 3):

```typescript
{
  focus: "Full Body",
  durationMinutes: 30,
  equipment: ["Bodyweight"],
  blocks: [{ type: "warmup" }],
  exercises: [
    { blockIndex: 0, order: 0, name: "...", prescription: "...", detail: "..." }
  ]
}
```

The transformer automatically validates, rebuilds nested structure, and attaches UUIDs.

## Environment Variables

```bash
# Schema version override (optional)
LLM_SCHEMA_VERSION=v2-flat

# Provider selection (optional, defaults to openai)
AI_PROVIDER=openrouter
OPENAI_TIMEOUT_MS=60000
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=deepseek/deepseek-v4-flash-0731
OPENROUTER_PLANNER_MODEL=deepseek/deepseek-v4-flash-0731
# Optional request timeout; defaults to 60 seconds
OPENROUTER_TIMEOUT_MS=60000

# Vertex AI for Gemini (optional)
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=my-project
GOOGLE_CLOUD_LOCATION=us-central1
#
# When GOOGLE_GENAI_USE_VERTEXAI=true, both GOOGLE_CLOUD_PROJECT and
# GOOGLE_CLOUD_LOCATION are required.
```

## Custom Router

For advanced use cases (caching, proxy routing, custom models), implement `ModelRouter`:

```typescript
import type { ModelRouter } from '@leveza/server-core';
import { DefaultModelRouter } from '@leveza/server-ai';

class CachedModelRouter implements ModelRouter {
  private upstream = new DefaultModelRouter();
  private cache = new Map();

  async generate(request, context, options) {
    const cacheKey = this.getCacheKey(request);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = await this.upstream.generate(request, context, options);
    this.cache.set(cacheKey, result);
    return result;
  }

  isSupportedProvider(provider: string) {
    return this.upstream.isSupportedProvider(provider);
  }

  getDefaultProvider() {
    return this.upstream.getDefaultProvider();
  }
}
```

## BYOK Support

The router accepts API keys via the `options.apiKey` parameter. Keys are:

- Passed directly to upstream provider SDKs
- Never logged or stored by the router
- Used only for the generation call

Hosted deployments can accept keys from request headers and pass them through.

## Testing

```bash
npx nx test server-ai
```

## License

See root LICENSE file.
