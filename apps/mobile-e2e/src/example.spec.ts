import { test, expect } from '@playwright/test';

test('boots the Workout Agent mobile web app', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    'Welcome @workout-agent-ce/server'
  );
});
