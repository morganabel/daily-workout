module.exports = {
  displayName: '@workout-agent-ce/mobile',
  // Full-screen render tests (App/Home/Onboarding) exceed jest's default 5s
  // per-test timeout on slower CI runners; give them headroom.
  testTimeout: 30000,
  resolver: require.resolve('./jest.resolver.js'),
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '\\.svg$': '@nx/expo/plugins/jest/svg-mock',
    '^expo-secure-store$': '<rootDir>/jest-mocks/expo-secure-store.ts',
    '^uuid$': '<rootDir>/jest-mocks/uuid.ts',
  },
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$':
      require.resolve('jest-expo/src/preset/assetFileTransformer.js'),
  },
  coverageDirectory: '../../coverage/apps/mobile',
};
