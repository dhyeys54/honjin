import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theia-app-shell')).toBeVisible({ timeout: 60_000 });
});

// In the managed workspace Theia titles the window after the workspace file ("honjin"); T2.5 owns the real title.
test('the document title contains Honjin', async ({ page }) => {
    await expect(page).toHaveTitle(/honjin/i);
});

test('the left activity bar has Search and Debug, and no Source Control (D31)', async ({ page }) => {
    // Side-bar tabs carry no title attribute; their ids are `shell-tab-<view container id>`.
    for (const id of ['search-view-container', 'debug']) {
        await expect(page.locator(`.theia-app-left #shell-tab-${id}`)).toBeAttached({ timeout: 30_000 });
    }
    await expect(page.locator('.theia-app-left #shell-tab-scm-view-container')).toHaveCount(0);
});
