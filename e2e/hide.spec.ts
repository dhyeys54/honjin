import { expect, test } from '@playwright/test';
import { readFileSync, renameSync, writeFileSync } from 'fs';
import { row, settingsFile } from './helpers';

test('hide removes a project, the eye shows it dimmed, unhide restores it', async ({ page }) => {
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        await page.goto('/');
        await expect(row(page, 'beta')).toBeVisible({ timeout: 30_000 });

        await row(page, 'beta').click({ button: 'right' });
        await page.locator('.lm-Menu-itemLabel', { hasText: 'Hide project' }).click();
        await expect(row(page, 'beta')).toHaveCount(0);

        await page.locator('.p-TabBar-toolbar [id="honjin.projects.toggleShowHidden"], .theia-tabBar-toolbar [id="honjin.projects.toggleShowHidden"], [id="honjin.projects.toggleShowHidden"]').first().click();
        await expect(row(page, 'beta')).toBeVisible();
        await expect(row(page, 'beta')).toHaveClass(/honjin-project-hidden/);
        await expect(row(page, 'beta').locator('.codicon-eye-closed')).toBeVisible(); // spec 03: eye-off glyph on hidden rows
        expect(await row(page, 'beta').evaluate(el => getComputedStyle(el).opacity)).toBe('0.5');
        await expect(page.locator('[id="honjin.projects.toggleShowHidden.on"]').first()).toBeVisible(); // the eye is now eye-closed

        await row(page, 'beta').click({ button: 'right' });
        await page.locator('.lm-Menu-itemLabel', { hasText: 'Unhide project' }).click();
        await expect(row(page, 'beta')).not.toHaveClass(/honjin-project-hidden/);
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
        writeFileSync(tmp, JSON.stringify({ ...JSON.parse(original), 'honjin.scanRoots': [] }));
        renameSync(tmp, settingsFile());
        await page.goto('/');
        const empty = page.locator('[data-testid="honjin-projects-empty"]');
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
    await page.locator('[id="honjin.projects.collapseAll"]').first().click();
    await expect(row(page, 'src')).toHaveCount(0);
});
