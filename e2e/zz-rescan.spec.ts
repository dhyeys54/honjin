// Named zz- so it runs last: it churns workspace roots, which left the shared backend's search slow for the next spec (see FOR-REVIEW).
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { row, settingsFile, tempDir } from './helpers';

const gamma = resolve(__dirname, 'fixtures/projects/gamma');
let original = '';
let extraRoot = '';

test.beforeEach(() => { original = readFileSync(settingsFile(), 'utf8'); });
test.afterEach(() => {
    rmSync(gamma, { recursive: true, force: true });
    if (extraRoot) {
        rmSync(extraRoot, { recursive: true, force: true });
        extraRoot = '';
    }
    const tmp = settingsFile() + '.tmp';
    writeFileSync(tmp, original);
    renameSync(tmp, settingsFile());
});

test('a new folder appears after Refresh', async ({ page }) => {
    await page.goto('/');
    await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });
    mkdirSync(join(gamma, '.git'), { recursive: true });
    await page.locator('[id="honjin.projects.refresh"]').first().click();
    await expect(row(page, 'gamma')).toBeVisible({ timeout: 15_000 });
});

test('changing honjin.scanRoots updates the tree without Refresh', async ({ page }) => {
    await page.goto('/');
    await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });
    // Only adds a root: removing roots here left the shared backend's search index stale for the next spec.
    extraRoot = tempDir('honjin-scan-');
    mkdirSync(join(extraRoot, 'delta', '.git'), { recursive: true });
    const settings = JSON.parse(original);
    settings['honjin.scanRoots'] = [...(settings['honjin.scanRoots'] ?? []), extraRoot];
    writeFileSync(settingsFile() + '.tmp', JSON.stringify(settings, undefined, 2));
    renameSync(settingsFile() + '.tmp', settingsFile());
    await expect(row(page, 'delta')).toBeVisible({ timeout: 20_000 });
    await expect(row(page, 'alpha')).toBeVisible();
});

test('the title names the project of the active editor', async ({ page }) => {
    await page.goto('/');
    await row(page, 'alpha').click();
    await row(page, 'alpha').dblclick();
    await row(page, 'src').click();
    await row(page, 'src').dblclick();
    await row(page, 'index.ts').dblclick();
    await expect.poll(() => page.title(), { timeout: 15_000 }).toContain('Honjin Beta — alpha');
});
