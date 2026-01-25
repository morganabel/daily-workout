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

// Mock expo-font globally
jest.mock('expo-font', () => ({
  useFonts: () => [true],
  isLoaded: jest.fn().mockReturnValue(true),
  loadAsync: jest.fn().mockResolvedValue(true),
}));

// Mock vector icons to avoid font loading issues
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// expo-secure-store is mocked via moduleNameMapper to a local stub

// Use LokiJS-based test database instead of native SQLite
// This provides a real in-memory database without requiring native bindings
jest.mock('./app/db/index', () => {
  const { getTestDatabase } = require('./app/db/test-database');
  return {
    database: getTestDatabase(),
  };
});

// Mock global fetch if not available
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}
