import { expect, test, Page } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { closeMenu, git, projects, settingsFile, tempDir, writeSettings } from './helpers';

const row = (page: Page, name: string) => projects(page).locator('.theia-TreeNode', { has: page.getByText(name, { exact: true }) });

test('Open Changes diffs a changed file; Show Changes opens that project\'s Source Control on the right', async ({ page }) => {
    test.setTimeout(120_000);
    const original = readFileSync(settingsFile(), 'utf8');
    const repo = join(tempDir('corral-git-'), 'delta');
    mkdirSync(repo);
    git(repo, 'init', '-q');
    writeFileSync(join(repo, 'a.txt'), 'one\n');
    writeFileSync(join(repo, 'b.txt'), 'same\n');
    git(repo, 'add', '.');
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
    writeFileSync(join(repo, 'a.txt'), 'two\n');
    try {
        writeSettings({ ...JSON.parse(original), 'corral.extraProjects': [repo] });
        await page.goto('/');
        await expect(row(page, 'delta')).toBeVisible({ timeout: 30_000 });
        await row(page, 'delta').click();
        await page.keyboard.press('ArrowRight');
        await expect(row(page, 'a.txt')).toBeVisible();

        // The item only shows once git has scanned the repo, and never for an unchanged file.
        await expect.poll(async () => {
            await row(page, 'a.txt').click({ button: 'right' });
            await expect(page.locator('.lm-Menu-itemLabel', { hasText: 'Copy Path' })).toBeVisible();
            const shown = await page.locator('.lm-Menu-itemLabel', { hasText: 'Open Changes' }).count();
            await closeMenu(page);
            return shown;
        }, { timeout: 30_000 }).toBe(1);
        await row(page, 'b.txt').click({ button: 'right' });
        await expect(page.locator('.lm-Menu-itemLabel', { hasText: 'Copy Path' })).toBeVisible();
        await expect(page.locator('.lm-Menu-itemLabel', { hasText: 'Open Changes' })).toHaveCount(0);
        await closeMenu(page);

        await row(page, 'a.txt').click({ button: 'right' });
        await page.locator('.lm-Menu-itemLabel', { hasText: 'Open Changes' }).click();
        await expect(page.locator('.monaco-diff-editor').first()).toBeVisible({ timeout: 15_000 });

        await row(page, 'delta').click({ button: 'right' });
        await page.locator('.lm-Menu-itemLabel', { hasText: 'Show Changes' }).click();
        const scm = page.locator('#theia-right-content-panel').getByRole('tabpanel', { name: /Source Control/ });
        await expect(scm.getByText('a.txt').first()).toBeVisible({ timeout: 15_000 });
    } finally {
        writeSettings(JSON.parse(original));
        rmSync(join(repo, '..'), { recursive: true, force: true });
    }
});
