import { expect, test, Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const settingsFile = () => join(process.env.CORRAL_E2E_CONFIG_DIR!, 'settings.json');
const writeSettings = (value: object) => {
    const tmp = settingsFile() + '.tmp';
    writeFileSync(tmp, JSON.stringify(value));
    renameSync(tmp, settingsFile());
};
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd });
const changes = (page: Page) => page.locator('[data-testid="corral-changes"]');
const changeRow = (page: Page, name: string) => changes(page).locator('.theia-TreeNode', { hasText: name });
const closeMenu = async (page: Page) => {
    // Theia's context menu ignores Escape here; a click outside it closes it, as Lumino menus do.
    await page.locator('#theia-statusBar').click({ position: { x: 1, y: 1 } });
    await expect(page.locator('.lm-Menu:visible')).toHaveCount(0);
};

test('Projects and Changes are stacked in one right-panel container', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('#theia-right-content-panel');
    const projects = panel.locator('[data-testid="corral-projects"]');
    const changesPart = panel.locator('[data-testid="corral-changes"]');
    await expect(projects).toBeVisible({ timeout: 30_000 });
    await expect(changesPart).toBeVisible();
    const top = async (l: typeof projects) => (await l.boundingBox())?.y ?? -1;
    expect(await top(projects)).toBeGreaterThan(-1);
    expect(await top(projects)).toBeLessThan(await top(changesPart));
});

test('Changes lists uncommitted files by project, marks live ones, opens diffs and clears on commit', async ({ page }) => {
    test.setTimeout(180_000);
    const original = readFileSync(settingsFile(), 'utf8');
    const repo = join(mkdtempSync(join(realpathSync(tmpdir()), 'corral-git-')), 'delta');
    mkdirSync(repo);
    git(repo, 'init', '-q');
    writeFileSync(join(repo, 'a.txt'), 'one\n');
    writeFileSync(join(repo, '.gitignore'), 'ignored.log\n');
    git(repo, 'add', '.');
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
    writeFileSync(join(repo, 'a.txt'), 'two\n');
    writeFileSync(join(repo, 'new.txt'), 'new\n');
    writeFileSync(join(repo, 'ignored.log'), 'noise\n');
    try {
        writeSettings({ ...JSON.parse(original), 'corral.extraProjects': [repo] });
        await page.goto('/');

        // (a) git refreshes asynchronously
        const project = changeRow(page, 'delta');
        await expect(project).toBeVisible({ timeout: 60_000 });
        await expect(project.locator('.corral-change-count')).toHaveText('2', { timeout: 30_000 });
        await expect(changeRow(page, 'a.txt').locator('.corral-change-letter')).toHaveText('M');
        await expect(changeRow(page, 'new.txt').locator('.corral-change-letter')).toHaveText('U');
        await expect(changeRow(page, 'ignored.log')).toHaveCount(0);

        // (b) a write in the last 30 s is live
        writeFileSync(join(repo, 'a.txt'), 'three\n');
        await expect(changeRow(page, 'a.txt')).toHaveClass(/corral-live/, { timeout: 15_000 });

        // (f) the Projects tree carries the same marks (C12)
        const projectRow = (name: string) => page.locator('[data-testid="corral-projects"] .theia-TreeNode', { hasText: name });
        await projectRow('delta').click();
        await page.keyboard.press('ArrowRight');
        await expect(projectRow('a.txt').locator('.corral-change-letter')).toHaveText('M');
        await expect(projectRow('delta').first().locator('.corral-change-count')).toHaveText('2');
        await expect(projectRow('delta').first()).toHaveClass(/corral-live/);

        // (c) click opens the diff against HEAD
        await changeRow(page, 'a.txt').click();
        await expect(page.locator('.monaco-diff-editor').first()).toBeVisible({ timeout: 15_000 });

        // (d) context menus
        const item = (label: string) => page.locator('.lm-Menu-itemLabel', { hasText: label });
        await changeRow(page, 'a.txt').click({ button: 'right' });
        await expect(item('Open File')).toBeVisible();
        await expect(item('Reveal in Projects')).toBeVisible();
        await expect(item('Copy Path')).toBeVisible();
        await item('Reveal in Projects').click();
        await expect(page.locator('[data-testid="corral-projects"] .theia-TreeNode.theia-mod-selected', { hasText: 'a.txt' })).toBeVisible();
        await project.click({ button: 'right' });
        await expect(item('Show Changes')).toBeVisible();
        await closeMenu(page);

        // (e) committing empties the view
        git(repo, 'add', '-A');
        git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'more');
        await expect(changeRow(page, 'delta')).toHaveCount(0, { timeout: 30_000 });
        await expect(page.locator('[data-testid="corral-changes-empty"]')).toBeVisible();
        await expect(projectRow('delta').first().locator('.corral-change-count')).toHaveCount(0);
        await expect(projectRow('a.txt').locator('.corral-change-letter')).toHaveCount(0);
    } finally {
        writeSettings(JSON.parse(original));
        rmSync(join(repo, '..'), { recursive: true, force: true });
    }
});
