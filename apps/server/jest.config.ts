const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: __dirname,
});

module.exports = createJestConfig({
  displayName: '@workout-agent-ce/server',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@workout-agent/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^uuid$': '<rootDir>/jest-mocks/uuid.ts',
    '^uuid/(.*)$': '<rootDir>/jest-mocks/uuid.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@workout-agent)/)',
  ],
  coverageDirectory: '../../coverage/apps/server',
  testEnvironment: 'node',
  watchman: false,
});
