// Restore the React Native Jest environment after Expo's runtime is initialized.
const devStateKey = Symbol.for('@workout-agent-ce/jest-expo-dev-state');
globalThis.__DEV__ = globalThis[devStateKey];
delete globalThis[devStateKey];
