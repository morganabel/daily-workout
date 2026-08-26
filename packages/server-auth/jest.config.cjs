const { readFileSync } = require('fs');
const path = require('path');

const swcConfigPath = path.join(__dirname, '.spec.swcrc');
const swcJestConfig = JSON.parse(readFileSync(swcConfigPath, 'utf-8'));

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'server-auth',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  transformIgnorePatterns: ['node_modules/(?!uuid/)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
};
