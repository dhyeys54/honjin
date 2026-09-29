import { expect, test } from '@playwright/test';
import { projects, row } from './helpers';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(projects(page)).toBeVisible({ timeout: 30_000 });
});

test('the right panel lists the visible projects, sorted', async ({ page }) => {
    await expect(row(page, 'alpha')).toBeVisible();
    await expect(row(page, 'beta')).toBeVisible();
    await expect(projects(page).locator('.theia-TreeNode', { hasText: '.hidden' })).toHaveCount(0);
    const text = await projects(page).innerText();
    expect(text.indexOf('alpha')).toBeLessThan(text.indexOf('beta'));
});

test('expanding a project shows its folders and a file opens in the left half', async ({ page }) => {
    await row(page, 'alpha').click();
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'src')).toBeVisible();
    await row(page, 'src').click();
    await page.keyboard.press('ArrowRight');
    await row(page, 'index.ts').dblclick();
    const editorTab = page.locator('.lm-TabBar-tab', { hasText: 'index.ts' }).first();
    await expect(editorTab).toBeVisible();
    const bar = editorTab.locator('xpath=ancestor::div[contains(@class,"lm-TabBar")][1]');
    await expect(bar.locator('.lm-TabBar-tab', { hasText: 'herdr' })).toHaveCount(0);
});

test('a single click previews a file and a double click pins it (spec 03)', async ({ page }) => {
    await row(page, 'alpha').click();
    await page.keyboard.press('ArrowRight');
    await row(page, 'src').click();
    await page.keyboard.press('ArrowRight');
    await row(page, 'index.ts').click();
    const tab = page.locator('.lm-TabBar-tab', { hasText: 'index.ts' }).first();
    await expect(tab).toHaveClass(/theia-editor-preview-title-unpinned/, { timeout: 15_000 });
    await row(page, 'index.ts').dblclick();
    await expect(tab).not.toHaveClass(/theia-editor-preview-title-unpinned/);
});

test('expanded folders and show-hidden survive a reload (spec 03)', async ({ page }) => {
    await row(page, 'alpha').click();
    await page.keyboard.press('ArrowRight');
    await row(page, 'src').click();
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'index.ts')).toBeVisible();
    await page.locator('[id="corral.projects.toggleShowHidden"]').first().click();
    await expect(page.locator('[id="corral.projects.toggleShowHidden.on"]').first()).toBeVisible();

    await page.reload();
    await expect(row(page, 'index.ts')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[id="corral.projects.toggleShowHidden.on"]').first()).toBeVisible();
});
