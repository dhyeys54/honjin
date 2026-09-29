import { expect, test } from '@playwright/test';
import { readFileSync, renameSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const settingsFile = () => join(process.env.CORRAL_E2E_CONFIG_DIR!, 'settings.json');
// Replace the file (as editors do) so the watcher sees a change even when the inode would stay the same.
const writeSettings = (text: string) => {
    writeFileSync(settingsFile() + '.tmp', text);
    renameSync(settingsFile() + '.tmp', settingsFile());
};
const beta = resolve(__dirname, 'fixtures/projects/beta');

test('search covers visible projects only, in the managed workspace, without reloading', async ({ page }) => {
    test.setTimeout(90_000); // the managed-workspace reload and root sync happen before search can find anything
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        await page.goto('/');
        await expect(page.locator('[data-testid="corral-projects"]')).toBeVisible({ timeout: 30_000 });
        // The first start moves into the managed workspace (one reload); wait for that to settle.
        await expect.poll(() => page.url(), { timeout: 30_000 }).toContain('corral.code-workspace');
        await expect(page.locator('[data-testid="corral-projects"]')).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => { (window as unknown as Record<string, unknown>).__corralMarker = true; });

        const hit = page.locator('span.match', { hasText: 'zebrafinch-marker-7431' });
        const search = async () => {
            await page.locator('[data-testid="corral-projects"]').click({ position: { x: 5, y: 200 } }); // keys go to herdr while its terminal has focus
            await page.keyboard.press('ControlOrMeta+Shift+F');
            const input = page.locator('#search-input-field');
            await input.fill('zebrafinch-marker-7431');
            await input.press('Enter');
        };
        // Roots arrive asynchronously after startup, so the first searches may find nothing yet.
        await expect(async () => {
            await search();
            await expect(hit).toBeVisible({ timeout: 3_000 });
        }).toPass({ timeout: 30_000 });

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
