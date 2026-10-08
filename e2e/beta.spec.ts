import { expect, test } from '@playwright/test';
import { closeMenu, projects } from './helpers';

test('the window title says Corral Beta and Help has Report an Issue (spec 13 S11)', async ({ page }) => {
    await page.goto('/');
    await expect(projects(page)).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.title(), { timeout: 15_000 }).toContain('Corral Beta');
    await page.locator('.lm-MenuBar-itemLabel', { hasText: /^Help$/ }).click();
    await expect(page.locator('.lm-Menu-itemLabel', { hasText: /^Report an Issue$/ })).toBeVisible();
    await closeMenu(page);
});
