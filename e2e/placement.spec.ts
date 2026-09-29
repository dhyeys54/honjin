import { expect, test, Page } from '@playwright/test';

const projects = (page: Page) => page.locator('[data-testid="corral-projects"]');
const tab = (page: Page, name: string | RegExp) => page.locator('#theia-main-content-panel .lm-TabBar-tab', { hasText: name });

test('a file opened by another opener while herdr is focused lands in the left half', async ({ page }) => {
    await page.goto('/');
    await expect(projects(page)).toBeVisible({ timeout: 30_000 });
    await expect(tab(page, /^herdr$/)).toBeVisible({ timeout: 30_000 });

    // Quick Open has nothing to list before roots sync (T1.14), so use another non-Projects opener:
    // File > New Text File is opened by Theia next to the focused widget, i.e. into herdr's group.
    await tab(page, /^herdr$/).click();
    await page.locator('.terminal-container .xterm-screen').first().click();
    await page.getByRole('menuitem', { name: 'File' }).first().click();
    await page.getByRole('menuitem', { name: /New Text File/ }).first().click();

    const editorTab = tab(page, /Untitled|Text/);
    await expect(editorTab).toBeVisible();
    const editorBox = await editorTab.boundingBox();
    const herdrBox = await tab(page, /^herdr$/).boundingBox();
    expect(editorBox!.x).toBeLessThan(herdrBox!.x);
    await expect(editorTab.locator('xpath=ancestor::div[contains(@class,"lm-TabBar")][1]').locator('.lm-TabBar-tab', { hasText: /^herdr$/ })).toHaveCount(0);
});
