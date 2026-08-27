// Expo 57's preset loads its runtime after React Native aliases `window` to the
// Node global. Keep that bootstrap out of the development-only HMR path.
const devStateKey = Symbol.for('@leveza/jest-expo-dev-state');
globalThis[devStateKey] = globalThis.__DEV__;
globalThis.__DEV__ = false;
