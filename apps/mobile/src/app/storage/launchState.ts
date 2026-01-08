import * as SecureStore from 'expo-secure-store';

const LAUNCH_COMPLETED_KEY = 'launch_completed_v1';

export async function getLaunchCompleted(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(LAUNCH_COMPLETED_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setLaunchCompleted(completed: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAUNCH_COMPLETED_KEY, completed ? 'true' : 'false');
  } catch {
    // Best-effort; onboarding state shouldn't block the app.
  }
}

