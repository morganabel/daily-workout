import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './apps/server',
});

const config: Config = {
  displayName: '@workout-agent-ce/server',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@workout-agent/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  coverageDirectory: '../../coverage/apps/server',
  testEnvironment: 'node',
  watchman: false,
};

export default createJestConfig(config);
