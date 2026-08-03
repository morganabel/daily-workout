import type { AiProviderName } from '@workout-agent/shared';
import type { ModelCredentialSource } from '@workout-agent-ce/metering';

export type ProviderCredentialSource = ModelCredentialSource | 'none';

export type ResolvedProviderCredential =
  | {
      provider: AiProviderName;
      source: 'byok' | 'managed';
      secret: string;
      useVertexAi: false;
    }
  | {
      provider: 'gemini';
      source: 'vertex';
      secret?: never;
      useVertexAi: true;
    }
  | {
      provider: AiProviderName;
      source: 'none';
      secret?: never;
      useVertexAi: false;
    };

export interface ResolveProviderCredentialParams {
  provider: AiProviderName;
  byok?: {
    openai?: string;
    gemini?: string;
    generic?: string;
  };
  managed?: Partial<Record<AiProviderName, string>>;
  vertexAi?: {
    enabled?: boolean;
    project?: string;
    location?: string;
  };
}

function nonempty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveProviderCredential({
  provider,
  byok,
  managed,
  vertexAi,
}: ResolveProviderCredentialParams): ResolvedProviderCredential {
  const matchingByok =
    provider === 'openai'
      ? nonempty(byok?.openai) ?? nonempty(byok?.generic)
      : provider === 'gemini'
      ? nonempty(byok?.gemini) ?? nonempty(byok?.generic)
      : nonempty(byok?.generic);

  if (matchingByok) {
    return {
      provider,
      source: 'byok',
      secret: matchingByok,
      useVertexAi: false,
    };
  }

  const managedSecret = nonempty(managed?.[provider]);
  if (managedSecret) {
    return {
      provider,
      source: 'managed',
      secret: managedSecret,
      useVertexAi: false,
    };
  }

  if (
    provider === 'gemini' &&
    vertexAi?.enabled &&
    nonempty(vertexAi.project) &&
    nonempty(vertexAi.location)
  ) {
    return {
      provider,
      source: 'vertex',
      useVertexAi: true,
    };
  }

  return {
    provider,
    source: 'none',
    useVertexAi: false,
  };
}
