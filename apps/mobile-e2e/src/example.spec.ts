import { test, expect } from '@playwright/test';

test('boots the Leveza mobile web app', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    'Welcome @leveza/server'
  );
});
