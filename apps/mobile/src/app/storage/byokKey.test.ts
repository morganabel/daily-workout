import * as SecureStore from 'expo-secure-store';
import { getByokConfig, removeByokApiKey, setByokConfig } from './byokKey';

describe('BYOK provider storage', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await removeByokApiKey();
  });

  it('preserves OpenRouter as the selected provider', async () => {
    await setByokConfig({
      provider: 'openrouter',
      apiKey: 'sk-or-v1-test-key',
    });

    await expect(getByokConfig()).resolves.toEqual({
      provider: 'openrouter',
      apiKey: 'sk-or-v1-test-key',
    });
  });

  it('defaults legacy and unsupported provider values to OpenAI', async () => {
    await SecureStore.setItemAsync('byokApiKey', 'legacy-key');
    await SecureStore.setItemAsync('byokProvider', 'unsupported');

    await expect(getByokConfig()).resolves.toEqual({
      provider: 'openai',
      apiKey: 'legacy-key',
    });
  });
});
