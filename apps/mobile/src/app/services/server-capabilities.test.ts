import * as SecureStore from 'expo-secure-store';
import type { MetaResponse } from '@workout-agent/shared';

import { backendDescriptor } from './backendDescriptor';
import {
  BUNDLED_SERVER_CAPABILITIES,
  fetchServerCapabilities,
  getCurrentServerCapabilities,
  resetServerCapabilitiesCacheForTests,
  resolveStartupServerCapabilities,
} from './server-capabilities';

const storageKey = `server_capabilities_v1_${backendDescriptor.backendId}`;

const liveCapabilities: MetaResponse = {
  protocolVersion: '1.0.0',
  edition: 'CE',
  auth: {
    enabled: false,
    methods: [],
    anonymousAvailable: false,
    emailAvailable: false,
    googleAvailable: false,
    accountTransitionAvailable: false,
  },
  billing: {
    enabled: false,
    showUpgradeUi: false,
    purchaseMethod: 'none',
    allowByok: true,
  },
};

describe('server capabilities', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetServerCapabilitiesCacheForTests();
    await SecureStore.deleteItemAsync(storageKey);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses bundled production defaults while startup refresh is pending', async () => {
    global.fetch = jest.fn(() => new Promise(() => undefined));

    const result = resolveStartupServerCapabilities(1_500);
    await Promise.resolve();
    jest.advanceTimersByTime(1_500);

    await expect(result).resolves.toEqual(BUNDLED_SERVER_CAPABILITIES);
  });

  it('returns bundled defaults without waiting for a remote refresh', async () => {
    global.fetch = jest.fn(() => new Promise(() => undefined));

    await expect(fetchServerCapabilities()).resolves.toEqual(
      BUNDLED_SERVER_CAPABILITIES
    );
    expect(getCurrentServerCapabilities()).toEqual(BUNDLED_SERVER_CAPABILITIES);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns the last stored value while refreshing it in the background', async () => {
    await SecureStore.setItemAsync(
      storageKey,
      JSON.stringify({
        version: 1,
        fetchedAt: 0,
        data: liveCapabilities,
      })
    );
    global.fetch = jest.fn(() => new Promise(() => undefined));

    await expect(fetchServerCapabilities()).resolves.toEqual(liveCapabilities);
    expect(getCurrentServerCapabilities()).toEqual(liveCapabilities);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('uses the last validated response while startup refresh is pending', async () => {
    await SecureStore.setItemAsync(
      storageKey,
      JSON.stringify({
        version: 1,
        fetchedAt: 0,
        data: liveCapabilities,
      })
    );
    global.fetch = jest.fn(() => new Promise(() => undefined));

    const result = resolveStartupServerCapabilities(1_500);
    await Promise.resolve();
    jest.advanceTimersByTime(1_500);

    await expect(result).resolves.toEqual(liveCapabilities);
  });

  it('validates and persists a live response in the background', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(liveCapabilities),
    });

    await expect(resolveStartupServerCapabilities()).resolves.toEqual(
      BUNDLED_SERVER_CAPABILITIES
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(getCurrentServerCapabilities()).toEqual(liveCapabilities);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      storageKey,
      expect.stringContaining('"version":1')
    );
  });
});
