const { readFileSync } = require('fs');
const path = require('path');

const swcConfigPath = path.join(__dirname, '.spec.swcrc');
const swcJestConfig = JSON.parse(readFileSync(swcConfigPath, 'utf-8'));

swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@workout-agent-ce/server-ai',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['node_modules/(?!uuid/)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
