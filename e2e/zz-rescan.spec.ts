// Named zz- so it runs last: it churns workspace roots, which left the shared backend's search slow for the next spec (see FOR-REVIEW).
import { expect, test, Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const gamma = resolve(__dirname, 'fixtures/projects/gamma');
const projects = (page: Page) => page.locator('[data-testid="corral-projects"]');
const row = (page: Page, name: string) => projects(page).locator('.theia-TreeNode', { hasText: new RegExp(`^${name}$`) });
const settingsFile = () => join(process.env.CORRAL_E2E_CONFIG_DIR!, 'settings.json');
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
    await page.locator('[id="corral.projects.refresh"]').first().click();
    await expect(row(page, 'gamma')).toBeVisible({ timeout: 15_000 });
});

test('changing corral.scanRoots updates the tree without Refresh', async ({ page }) => {
    await page.goto('/');
    await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });
    // Only adds a root: removing roots here left the shared backend's search index stale for the next spec.
    extraRoot = mkdtempSync(join(realpathSync(tmpdir()), 'corral-scan-'));
    mkdirSync(join(extraRoot, 'delta', '.git'), { recursive: true });
    const settings = JSON.parse(original);
    settings['corral.scanRoots'] = [...(settings['corral.scanRoots'] ?? []), extraRoot];
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
    await expect.poll(() => page.title(), { timeout: 15_000 }).toContain('Corral — alpha');
});
