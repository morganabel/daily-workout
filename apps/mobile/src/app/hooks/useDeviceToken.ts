/**
 * Hook to manage DeviceToken for testing
 * In production, this would be set via device bootstrap flow
 */

import { useEffect, useState } from 'react';
import { getDeviceToken, setDeviceToken } from '../storage/deviceToken';

/**
 * Hook to get and set DeviceToken
 * For testing: you can manually set a token
 */
export function useDeviceToken() {
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const stored = await getDeviceToken();
        setTokenState(stored);
      } catch (error) {
        console.warn('Failed to load device token:', error);
      } finally {
        setLoading(false);
      }
    };
    loadToken();
  }, []);

  const updateToken = async (newToken: string) => {
    try {
      await setDeviceToken(newToken);
      setTokenState(newToken);
    } catch (error) {
      console.error('Failed to set device token:', error);
      throw error;
    }
  };

  return { token, loading, setToken: updateToken };
}

