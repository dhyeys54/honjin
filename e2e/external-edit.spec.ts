import { expect, test } from '@playwright/test';
import { rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { row, settingsFile, writeSettings } from './helpers';

const file = resolve(__dirname, 'fixtures/projects/beta/external-edit.md');

test('an open editor reloads when an agent rewrites the file in place on disk', async ({ page }) => {
    test.setTimeout(90_000);
    try {
        writeFileSync(file, 'old bids\n');
        await page.goto('/');
        await expect(row(page, 'beta')).toBeVisible({ timeout: 30_000 });
        await row(page, 'beta').click();
        await page.keyboard.press('ArrowRight');
        await row(page, 'external-edit.md').dblclick();
        const editor = page.locator('.monaco-editor.focused .view-lines');
        await expect(editor).toContainText('old bids', { timeout: 15_000 });

        // Hiding and showing the project removes and re-adds its workspace root (and its recursive watcher).
        const original = readFileSync(settingsFile(), 'utf8');
        const hidden = JSON.parse(original);
        hidden['corral.hiddenProjects'] = [resolve(__dirname, 'fixtures/projects/beta')];
        try {
            writeSettings(JSON.stringify(hidden));
            await expect(row(page, 'beta')).toHaveCount(0, { timeout: 20_000 });
        } finally {
            writeSettings(original);
        }
        await expect(row(page, 'beta')).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(2_000);

        writeFileSync(file, 'new bids\n'); // truncate + write, like Python's open(p, "w")
        await expect(editor).toContainText('new bids', { timeout: 15_000 });
    } finally {
        rmSync(file, { force: true });
    }
});
