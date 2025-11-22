/**
 * Jest test setup for mobile app
 */

// Mock React Native modules
const mockNetInfo = {
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  addEventListener: jest.fn(() => () => {
    // Cleanup
  }),
};

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: mockNetInfo,
}));

// expo-secure-store is mocked via moduleNameMapper to a local stub

// Mock global fetch if not available
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}
