import { expect, test } from '@playwright/test';

// The collapse slide (D31) must not lose the width the panel reopens at.
test('the Projects panel slides shut and reopens at the same width', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('#theia-right-content-panel'); // the tab strip plus the view
    const tab = page.locator('.theia-app-right #shell-tab-corral-projects-container');
    const width = async () => Math.round((await panel.boundingBox())?.width ?? 0);
    await expect.poll(width, { timeout: 30_000 }).toBeGreaterThan(100);
    await expect(tab).toHaveClass(/lm-mod-current/);
    const before = await width();

    await tab.click();
    await expect(panel).toHaveClass(/theia-mod-collapsed/);
    await tab.click();
    await expect(panel).not.toHaveClass(/theia-mod-collapsed/);
    await expect.poll(width).toBe(before);
});
