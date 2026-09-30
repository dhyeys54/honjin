import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { settingsFile, writeSettings } from './helpers';

const entry = (page: import('@playwright/test').Page) => page.locator('#status-bar-corral-resources');

test('the status bar shows Corral resource usage, with a breakdown on hover (spec 10 R9, R10)', async ({ page }) => {
    await page.goto('/');
    await expect(entry(page)).toBeVisible({ timeout: 30_000 });
    await expect(entry(page)).toHaveText(/\d+(\.\d)? (MB|GB) · \d+% · \d+/);

    await entry(page).hover();
    const hover = page.locator('.theia-hover');
    await expect(hover).toContainText('Corral', { timeout: 15_000 });
    await expect(hover).toContainText('Memory');
});

test('corral.resourceMonitor.enabled removes and restores the entry (spec 10 R12)', async ({ page }) => {
    test.setTimeout(90_000);
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        await page.goto('/');
        await expect(entry(page)).toBeVisible({ timeout: 30_000 });
        writeSettings({ ...JSON.parse(original), 'corral.resourceMonitor.enabled': false });
        await expect(entry(page)).toHaveCount(0, { timeout: 15_000 });
    } finally {
        writeSettings(original);
    }
    await expect(entry(page)).toBeVisible({ timeout: 30_000 });
});
