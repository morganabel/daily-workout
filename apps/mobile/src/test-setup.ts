/**
 * Jest test setup for mobile app
 */

// Mock React Native modules
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(),
  },
}));

// Note: expo-secure-store is mocked in jest.config.ts moduleNameMapper
// Don't mock it here to avoid conflicts

// Mock global fetch if not available
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}
