import { redactSecrets } from './logging';
import { resolveProviderCredential } from './provider-credential';

describe('resolveProviderCredential', () => {
  it.each([
    {
      name: 'OpenAI-specific BYOK',
      provider: 'openai' as const,
      byok: { openai: 'openai-byok', gemini: 'stale-gemini' },
      source: 'byok',
      secret: 'openai-byok',
    },
    {
      name: 'Gemini-specific BYOK',
      provider: 'gemini' as const,
      byok: { gemini: 'gemini-byok', openai: 'stale-openai' },
      source: 'byok',
      secret: 'gemini-byok',
    },
    {
      name: 'generic Gemini BYOK',
      provider: 'gemini' as const,
      byok: { generic: 'generic-byok' },
      source: 'byok',
      secret: 'generic-byok',
    },
    {
      name: 'generic OpenRouter BYOK',
      provider: 'openrouter' as const,
      byok: { generic: 'openrouter-byok' },
      source: 'byok',
      secret: 'openrouter-byok',
    },
  ])('selects $name for the selected provider', ({ provider, byok, source, secret }) => {
    expect(resolveProviderCredential({ provider, byok })).toMatchObject({
      provider,
      source,
      secret,
      useVertexAi: false,
    });
  });

  it.each([
    ['openai', { gemini: 'stale-gemini' }, 'managed-openai'],
    ['gemini', { openai: 'stale-openai' }, 'managed-gemini'],
    ['openrouter', { openai: 'stale-openai', gemini: 'stale-gemini' }, 'managed-openrouter'],
  ] as const)(
    'ignores mismatched headers for %s',
    (provider, byok, managedSecret) => {
      expect(
        resolveProviderCredential({
          provider,
          byok,
          managed: { [provider]: managedSecret },
        })
      ).toEqual({
        provider,
        source: 'managed',
        secret: managedSecret,
        useVertexAi: false,
      });
    }
  );

  it('selects a managed Gemini key ahead of Vertex', () => {
    expect(
      resolveProviderCredential({
        provider: 'gemini',
        managed: { gemini: 'managed-gemini' },
        vertexAi: { enabled: true, project: 'project', location: 'location' },
      })
    ).toEqual({
      provider: 'gemini',
      source: 'managed',
      secret: 'managed-gemini',
      useVertexAi: false,
    });
  });

  it('selects matching Gemini BYOK ahead of Vertex', () => {
    expect(
      resolveProviderCredential({
        provider: 'gemini',
        byok: { gemini: 'gemini-byok' },
        vertexAi: { enabled: true, project: 'project', location: 'location' },
      })
    ).toEqual({
      provider: 'gemini',
      source: 'byok',
      secret: 'gemini-byok',
      useVertexAi: false,
    });
  });

  it('selects configured Vertex only when no API key is available', () => {
    expect(
      resolveProviderCredential({
        provider: 'gemini',
        vertexAi: { enabled: true, project: 'project', location: 'location' },
      })
    ).toEqual({
      provider: 'gemini',
      source: 'vertex',
      useVertexAi: true,
    });
  });

  it('returns none when the selected provider has no usable credential', () => {
    expect(
      resolveProviderCredential({
        provider: 'openai',
        byok: { gemini: 'stale-gemini' },
      })
    ).toEqual({
      provider: 'openai',
      source: 'none',
      useVertexAi: false,
    });
  });

  it('uses a secret field that is removed by the standard log redactor', () => {
    const credential = resolveProviderCredential({
      provider: 'openai',
      byok: { openai: 'sk-sensitive-credential' },
    });

    expect(redactSecrets(credential)).toEqual({
      provider: 'openai',
      source: 'byok',
      secret: '[REDACTED]',
      useVertexAi: false,
    });
  });
});
