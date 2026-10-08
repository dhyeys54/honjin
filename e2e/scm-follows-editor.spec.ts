import { expect, test } from '@playwright/test';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { git, row, settingsFile, tempDir, writeSettings } from './helpers';

function repo(branch: string): string {
    const dir = tempDir('corral-scm-');
    git(dir, 'init', '-q', '-b', branch);
    writeFileSync(join(dir, 'notes.md'), branch);
    git(dir, 'add', '.');
    git(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
    return dir;
}

test('the git status item follows the repository of the active editor', async ({ page }) => {
    test.setTimeout(120_000);
    const original = readFileSync(settingsFile(), 'utf8');
    const one = repo('zz-branch-one');
    const two = repo('zz-branch-two');
    try {
        writeSettings({ ...JSON.parse(original), 'corral.extraProjects': [one, two] });
        await page.goto('/');
        await expect.poll(() => page.url(), { timeout: 30_000 }).toContain('corral.code-workspace');
        const status = page.locator('#theia-statusBar');
        const open = async (dir: string) => {
            const name = dir.split('/').pop()!;
            await row(page, name).click();
            await page.keyboard.press('ArrowRight');
            await row(page, 'notes.md').dblclick();
            await row(page, name).click();
            await page.keyboard.press('ArrowLeft'); // both repos hold a notes.md; keep one visible at a time
        };
        await open(one);
        await expect(status).toContainText('zz-branch-one', { timeout: 30_000 });
        await open(two);
        await expect(status).toContainText('zz-branch-two', { timeout: 15_000 });
        await page.locator('.lm-TabBar-tab', { hasText: 'notes.md' }).first().click();
        await expect(status).toContainText('zz-branch-one', { timeout: 15_000 });
    } finally {
        writeSettings(original);
        rmSync(one, { recursive: true, force: true });
        rmSync(two, { recursive: true, force: true });
    }
});
