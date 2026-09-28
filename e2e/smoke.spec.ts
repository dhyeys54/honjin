import { expect, test } from '@playwright/test';

test('the app shell becomes visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theia-app-shell')).toBeVisible({ timeout: 60_000 });
});
