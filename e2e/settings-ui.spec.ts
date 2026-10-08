import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { settingsFile, writeSettings } from './helpers';

test('a resource-monitor threshold changed in the Settings UI is saved to settings.json', async ({ page }) => {
    test.setTimeout(90_000);
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        await page.goto('/');
        await expect(page.locator('#status-bar-corral-resources')).toBeVisible({ timeout: 30_000 });
        await page.locator('[data-testid="corral-projects"]').click({ position: { x: 5, y: 150 } }); // keys go to herdr while its terminal has focus
        await page.keyboard.press('ControlOrMeta+,');
        const search = page.locator('.theia-settings-container .theia-input, .theia-settings-container input[type="text"]').first();
        await search.fill('corral.resourceMonitor.warningPercent');
        const field = page.locator('[data-pref-id="corral.resourceMonitor.warningPercent"] input[type="number"]');
        await expect(field).toBeVisible({ timeout: 15_000 });
        await field.fill('61');
        await field.press('Tab');
        const saved = (key: string) => JSON.parse(readFileSync(settingsFile(), 'utf8'))[key];
        await expect.poll(() => saved('corral.resourceMonitor.warningPercent'), { timeout: 10_000 }).toBe(61);

        // Real keystrokes: each one is a separate change, and the field loses focus by a click, not Tab.
        await search.fill('corral.resourceMonitor.dangerPercent');
        const danger = page.locator('[data-pref-id="corral.resourceMonitor.dangerPercent"] input[type="number"]');
        await expect(danger).toBeVisible({ timeout: 15_000 });
        await danger.click({ clickCount: 3 });
        await page.keyboard.type('88');
        await search.click();
        await expect.poll(() => saved('corral.resourceMonitor.dangerPercent'), { timeout: 10_000 }).toBe(88);
        await expect(danger).toHaveValue('88');
    } finally {
        writeSettings(original);
    }
});
