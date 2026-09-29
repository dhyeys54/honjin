import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { settingsFile, writeSettings } from './helpers';

const beta = resolve(__dirname, 'fixtures/projects/beta');

test('search covers visible projects only, in the managed workspace, without reloading', async ({ page }) => {
    test.setTimeout(150_000); // the managed-workspace reload and root sync happen before search can find anything
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        await page.goto('/');
        await expect(page.locator('[data-testid="corral-projects"]')).toBeVisible({ timeout: 30_000 });
        // The first start moves into the managed workspace (one reload); wait for that to settle.
        await expect.poll(() => page.url(), { timeout: 30_000 }).toContain('corral.code-workspace');
        await expect(page.locator('[data-testid="corral-projects"]')).toBeVisible({ timeout: 30_000 });

        const hit = page.locator('span.match', { hasText: 'zebrafinch-marker-7431' });
        const search = async () => {
            await page.locator('[data-testid="corral-projects"]').click({ position: { x: 5, y: 200 } }); // keys go to herdr while its terminal has focus
            await page.keyboard.press('ControlOrMeta+Shift+F');
            const input = page.locator('#search-input-field');
            await input.fill('zebrafinch-marker-7431');
            await input.press('Enter');
        };
        // Roots arrive asynchronously after startup, so the first searches may find nothing yet.
        // Occasionally (mostly late in a full run) the Search view of a freshly loaded page never returns anything and its
        // input keeps clearing; a reload gives it a fresh widget. Not a Corral reload: the no-reload check starts after this.
        let attempts = 0;
        await expect(async () => {
            if (attempts++ % 4 === 3) {
                await page.reload();
                await expect(page.locator('[data-testid="corral-projects"]')).toBeVisible({ timeout: 30_000 });
            }
            await search();
            await expect(hit).toBeVisible({ timeout: 3_000 });
        }).toPass({ timeout: 90_000 });
        await page.evaluate(() => { (window as unknown as Record<string, unknown>).__corralMarker = true; });

        const settings = JSON.parse(original);
        settings['corral.hiddenProjects'] = [beta];
        writeSettings(JSON.stringify(settings, undefined, 2));
        await expect(page.locator('[data-testid="corral-projects"] .theia-TreeNode', { hasText: /^beta$/ })).toHaveCount(0, { timeout: 20_000 });
        await search();
        await expect(hit).toHaveCount(0, { timeout: 20_000 });
        expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__corralMarker)).toBe(true);
    } finally {
        writeSettings(original);
    }
});
