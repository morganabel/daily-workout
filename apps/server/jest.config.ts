const swcJestConfig = {
  jsc: {
    target: 'es2017',
    parser: {
      syntax: 'typescript',
      tsx: true,
      decorators: true,
      dynamicImport: true,
    },
    transform: {
      decoratorMetadata: true,
      legacyDecorator: true,
      react: {
        runtime: 'automatic',
      },
    },
    keepClassNames: true,
    externalHelpers: true,
    loose: true,
  },
  module: {
    type: 'es6',
  },
  sourceMaps: true,
  swcrc: false,
};

module.exports = {
  displayName: '@workout-agent-ce/server',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]sx?$': ['@swc/jest', swcJestConfig],
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@workout-agent/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^uuid$': '<rootDir>/jest-mocks/uuid.ts',
    '^uuid/(.*)$': '<rootDir>/jest-mocks/uuid.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid|@workout-agent)/)'],
  coverageDirectory: '../../coverage/apps/server',
  testEnvironment: 'node',
  watchman: false,
};
