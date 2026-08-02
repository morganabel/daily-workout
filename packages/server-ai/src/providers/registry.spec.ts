import {
  getDefaultProviderName,
  isSupportedProvider,
} from './registry';

describe('provider registry', () => {
  const originalProvider = process.env.AI_PROVIDER;

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = originalProvider;
    }
  });

  it('supports OpenRouter', () => {
    expect(isSupportedProvider('openrouter')).toBe(true);
  });

  it('allows OpenRouter to be configured as the default provider', () => {
    process.env.AI_PROVIDER = 'OPENROUTER';
    expect(getDefaultProviderName()).toBe('openrouter');
  });
});
