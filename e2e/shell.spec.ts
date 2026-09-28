import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theia-app-shell')).toBeVisible({ timeout: 60_000 });
});

test('the document title contains Corral', async ({ page }) => {
    await expect(page).toHaveTitle(/Corral/);
});

test('the left activity bar has Search, Source Control and Debug', async ({ page }) => {
    // Theia titles the @theia/debug view container "Debug" (DECISIONS D10).
    for (const name of ['Search', 'Source Control', 'Debug']) {
        await expect(page.locator(`.theia-app-left .lm-TabBar-tab[title="${name}"], .lm-TabBar-tab[title="${name}"]`).first()).toBeAttached({ timeout: 30_000 });
    }
});
