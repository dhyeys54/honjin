import { expect, test, Page } from '@playwright/test';
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { row } from './helpers';

const src = resolve(__dirname, 'fixtures/projects/alpha/src');

async function menu(page: Page, name: string, item: string) {
    await row(page, name).click({ button: 'right' });
    await page.locator('.lm-Menu-itemLabel', { hasText: item }).click();
}

test('New File, Rename and Delete work from the tree', async ({ page }) => {
    test.setTimeout(90_000);
    try {
        await page.goto('/');
        await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });
        await row(page, 'alpha').click();
        await page.keyboard.press('ArrowRight');
        await expect(row(page, 'src')).toBeVisible();
        await row(page, 'src').click();
        await page.keyboard.press('ArrowRight');
        await expect(row(page, 'index.ts')).toBeVisible();

        await menu(page, 'src', 'New File…');
        await page.locator('.dialogBlock input').fill('made.ts');
        await page.keyboard.press('Enter');
        await expect.poll(() => existsSync(resolve(src, 'made.ts')), { timeout: 15_000 }).toBe(true);
        const tab = page.locator('.lm-TabBar-tab', { hasText: 'made.ts' }).first();
        await expect(tab).toBeVisible({ timeout: 15_000 });
        const bar = tab.locator('xpath=ancestor::div[contains(@class,"lm-TabBar")][1]');
        await expect(bar.locator('.lm-TabBar-tab', { hasText: 'herdr' })).toHaveCount(0);

        await expect(row(page, 'made.ts')).toBeVisible();
        await menu(page, 'made.ts', 'Rename…');
        await page.locator('.dialogBlock input').fill('renamed.ts');
        await page.keyboard.press('Enter');
        await expect.poll(() => existsSync(resolve(src, 'renamed.ts')), { timeout: 15_000 }).toBe(true);
        expect(existsSync(resolve(src, 'made.ts'))).toBe(false);

        await expect(row(page, 'renamed.ts')).toBeVisible();
        await menu(page, 'renamed.ts', 'Delete');
        await page.locator('.dialogBlock').getByRole('button', { name: /^(OK|Delete)$/ }).click();
        await expect.poll(() => existsSync(resolve(src, 'renamed.ts')), { timeout: 15_000 }).toBe(false);
    } finally {
        for (const f of ['made.ts', 'renamed.ts']) {
            rmSync(resolve(src, f), { force: true });
        }
    }
});
