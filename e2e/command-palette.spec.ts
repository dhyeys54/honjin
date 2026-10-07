import { expect, test } from '@playwright/test';

test('Quick Open finds a file by project name plus file name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lm-TabBar-tab', { hasText: /^herdr$/ })).toBeVisible({ timeout: 30_000 });
    await page.locator('.terminal-container .xterm-screen').first().click(); // the page needs focus for keys
    await page.keyboard.press('ControlOrMeta+p');
    await expect(page.locator('.quick-input-widget')).toBeVisible();
    await page.keyboard.type('beta readme');
    await expect(page.locator('.quick-input-widget .monaco-list-row', { hasText: 'README.md' })).toBeVisible({ timeout: 10_000 });
});

test('the command palette offers Markdown: Open Preview for a markdown file, and it opens', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lm-TabBar-tab', { hasText: /^herdr$/ })).toBeVisible({ timeout: 30_000 });
    await page.locator('.terminal-container .xterm-screen').first().click(); // the page needs focus for keys
    await page.keyboard.press('ControlOrMeta+p');
    await expect(page.locator('.quick-input-widget')).toBeVisible();
    await page.keyboard.type('README.md');
    await expect(page.locator('.quick-input-widget .monaco-list-row', { hasText: 'README.md' })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Enter');
    await expect(page.locator('.lm-TabBar-tab', { hasText: /^README\.md$/ })).toBeVisible();
    await page.locator('.monaco-editor:visible .view-lines').first().click();
    await page.keyboard.press('ControlOrMeta+Shift+p');
    // Typing re-filters the list after focus has left the editor; the command must survive that.
    await page.keyboard.type('Markdown: Open Preview');
    const item = page.locator('.quick-input-widget .monaco-list-row', { hasText: /^Markdown: Open Preview(?! to)/ });
    await expect(item).toBeVisible({ timeout: 10_000 });
    await item.click();
    await expect(page.locator('.lm-TabBar-tab', { hasText: /^Preview README\.md$/ })).toBeVisible({ timeout: 15_000 });
});
