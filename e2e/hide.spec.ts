import { expect, test } from '@playwright/test';
import { readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

const projects = (page: import('@playwright/test').Page) => page.locator('[data-testid="corral-projects"]');
const row = (page: import('@playwright/test').Page, name: string) => projects(page).locator('.theia-TreeNode', { hasText: new RegExp(`^${name}$`) });
const settingsFile = () => join(process.env.CORRAL_E2E_CONFIG_DIR!, 'settings.json');

test('hide removes a project, the eye shows it dimmed, unhide restores it', async ({ page }) => {
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        await page.goto('/');
        await expect(row(page, 'beta')).toBeVisible({ timeout: 30_000 });

        await row(page, 'beta').click({ button: 'right' });
        await page.locator('.lm-Menu-itemLabel', { hasText: 'Hide project' }).click();
        await expect(row(page, 'beta')).toHaveCount(0);

        await page.locator('.p-TabBar-toolbar [id="corral.projects.toggleShowHidden"], .theia-tabBar-toolbar [id="corral.projects.toggleShowHidden"], [id="corral.projects.toggleShowHidden"]').first().click();
        await expect(row(page, 'beta')).toBeVisible();
        await expect(row(page, 'beta')).toHaveClass(/corral-project-hidden/);
        await expect(row(page, 'beta').locator('.codicon-eye-closed')).toBeVisible(); // spec 03: eye-off glyph on hidden rows
        expect(await row(page, 'beta').evaluate(el => getComputedStyle(el).opacity)).toBe('0.5');
        await expect(page.locator('[id="corral.projects.toggleShowHidden.on"]').first()).toBeVisible(); // the eye is now eye-closed

        await row(page, 'beta').click({ button: 'right' });
        await page.locator('.lm-Menu-itemLabel', { hasText: 'Unhide project' }).click();
        await expect(row(page, 'beta')).not.toHaveClass(/corral-project-hidden/);
    } finally {
        const tmp = settingsFile() + '.tmp';
        writeFileSync(tmp, original);
        renameSync(tmp, settingsFile());
    }
});

test('with no roots the empty state offers Choose folders…', async ({ page }) => {
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        const tmp = settingsFile() + '.tmp';
        writeFileSync(tmp, JSON.stringify({ ...JSON.parse(original), 'corral.scanRoots': [] }));
        renameSync(tmp, settingsFile());
        await page.goto('/');
        const empty = page.locator('[data-testid="corral-projects-empty"]');
        await expect(empty).toContainText('Choose the folders that hold your projects', { timeout: 30_000 });
        await expect(empty.getByRole('button', { name: 'Choose folders…' })).toBeVisible();
    } finally {
        const tmp = settingsFile() + '.tmp';
        writeFileSync(tmp, original);
        renameSync(tmp, settingsFile());
    }
});

test('collapse all folds every expanded project', async ({ page }) => {
    await page.goto('/');
    await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });
    await row(page, 'alpha').dblclick();
    await expect(row(page, 'src')).toBeVisible();
    await page.locator('[id="corral.projects.collapseAll"]').first().click();
    await expect(row(page, 'src')).toHaveCount(0);
});
