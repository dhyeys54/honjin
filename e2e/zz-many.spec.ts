import { expect, test } from '@playwright/test';
import { writeFileSync } from 'fs';
import { row } from './helpers';
const file = '/private/tmp/claude-501/scratch/many/projects/p21/today.md';
test('many roots, gitignored file', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await expect(row(page, 'p21')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(8_000);
    await row(page, 'p21').click();
    await page.keyboard.press('ArrowRight');
    await row(page, 'today.md').dblclick();
    const editor = page.locator('.monaco-editor.focused .view-lines');
    await expect(editor).toContainText('old bids', { timeout: 15_000 });
    writeFileSync(file, 'new bids\n');
    await expect(editor).toContainText('new bids', { timeout: 15_000 });
});
