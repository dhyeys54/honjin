import { expect, test } from '@playwright/test';
import { colors } from '../honjin-core/src/common/design-tokens';

test('Honjin Dark is the active theme', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theia-app-shell')).toBeVisible({ timeout: 60_000 });
    const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theia-editor-background').trim().toLowerCase());
    await expect.poll(bg).toBe(colors.bg);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theia-sideBar-background').trim().toLowerCase())).toBe(colors.surface);
});
