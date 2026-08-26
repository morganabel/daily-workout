const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  displayName: 'server-auth-integration',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['<rootDir>/src/**/*.integration.spec.ts'],
  testPathIgnorePatterns: [],
  testTimeout: 120_000,
};
