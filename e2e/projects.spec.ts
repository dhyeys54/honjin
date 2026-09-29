import { expect, test } from '@playwright/test';

const projects = (page: import('@playwright/test').Page) => page.locator('[data-testid="corral-projects"]');
const row = (page: import('@playwright/test').Page, name: string) => projects(page).locator('.theia-TreeNode', { hasText: new RegExp(`^${name}$`) });

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
