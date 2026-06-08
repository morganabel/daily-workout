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

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn().mockResolvedValue(undefined),
    logIn: jest.fn().mockResolvedValue({}),
    logOut: jest.fn().mockResolvedValue(undefined),
    getOfferings: jest.fn().mockResolvedValue({ current: null }),
    restorePurchases: jest.fn().mockResolvedValue(null),
    getCustomerInfo: jest.fn().mockResolvedValue(null),
    LOG_LEVEL: { WARN: 'WARN' },
    PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: '1' },
  },
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  PAYWALL_RESULT: {
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
  },
  default: {
    presentPaywallIfNeeded: jest.fn().mockResolvedValue('NOT_PRESENTED'),
    presentCustomerCenter: jest.fn().mockResolvedValue(undefined),
  },
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
