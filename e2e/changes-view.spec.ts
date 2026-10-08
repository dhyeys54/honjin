import { expect, test, Page } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { closeMenu, git, settingsFile, tempDir, writeSettings } from './helpers';

const changes = (page: Page) => page.locator('[data-testid="honjin-changes"]');
const changeRow = (page: Page, name: string) => changes(page).locator('.theia-TreeNode', { hasText: name });

test('Projects and Changes are stacked in one right-panel container', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('#theia-right-content-panel');
    const projects = panel.locator('[data-testid="honjin-projects"]');
    const changesPart = panel.locator('[data-testid="honjin-changes"]');
    await expect(projects).toBeVisible({ timeout: 30_000 });
    await expect(changesPart).toBeVisible();
    const top = async (l: typeof projects) => (await l.boundingBox())?.y ?? -1;
    expect(await top(projects)).toBeGreaterThan(-1);
    expect(await top(projects)).toBeLessThan(await top(changesPart));
});

test('Changes lists uncommitted files by project, marks live ones, opens diffs and clears on commit', async ({ page }) => {
    test.setTimeout(180_000);
    const original = readFileSync(settingsFile(), 'utf8');
    const repo = join(tempDir('honjin-git-'), 'delta');
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
        writeSettings({ ...JSON.parse(original), 'honjin.extraProjects': [repo] });
        await page.goto('/');

        // (a) git refreshes asynchronously
        const project = changeRow(page, 'delta');
        await expect(project).toBeVisible({ timeout: 60_000 });
        await expect(project.locator('.honjin-change-count')).toHaveText('2', { timeout: 30_000 });
        await expect(changeRow(page, 'a.txt').locator('.honjin-change-letter')).toHaveText('M');
        await expect(changeRow(page, 'new.txt').locator('.honjin-change-letter')).toHaveText('U');
        await expect(changeRow(page, 'ignored.log')).toHaveCount(0);

        // (b) a write in the last 30 s is live
        writeFileSync(join(repo, 'a.txt'), 'three\n');
        await expect(changeRow(page, 'a.txt')).toHaveClass(/honjin-live/, { timeout: 15_000 });

        // (f) the Projects tree carries the same marks (C12)
        const projectRow = (name: string) => page.locator('[data-testid="honjin-projects"] .theia-TreeNode', { hasText: name });
        await projectRow('delta').click();
        await page.keyboard.press('ArrowRight');
        await expect(projectRow('a.txt').locator('.honjin-change-letter')).toHaveText('M');
        await expect(projectRow('delta').first().locator('.honjin-change-count')).toHaveText('2');
        await expect(projectRow('delta').first()).toHaveClass(/honjin-live/);

        // C13: the dot pulses, and stops under prefers-reduced-motion in both trees
        const dotAnimation = (row: ReturnType<typeof changeRow>) =>
            row.evaluate(el => getComputedStyle(el.querySelector('.theia-TreeNodeContent')!, '::after').animationName);
        await expect.poll(() => dotAnimation(changeRow(page, 'a.txt'))).toBe('honjin-live-pulse');
        await expect.poll(() => dotAnimation(projectRow('delta').first())).toBe('honjin-live-pulse');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect.poll(() => dotAnimation(changeRow(page, 'a.txt'))).toBe('none');
        await expect.poll(() => dotAnimation(projectRow('delta').first())).toBe('none');
        await page.emulateMedia({ reducedMotion: 'no-preference' });

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
        await expect(page.locator('[data-testid="honjin-projects"] .theia-TreeNode.theia-mod-selected', { hasText: 'a.txt' })).toBeVisible();
        await project.click({ button: 'right' });
        await expect(item('Show Changes')).toBeVisible();
        await closeMenu(page);

        // (e) committing empties the view
        git(repo, 'add', '-A');
        git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'more');
        await expect(changeRow(page, 'delta')).toHaveCount(0, { timeout: 30_000 });
        await expect(page.locator('[data-testid="honjin-changes-empty"]')).toBeVisible();
        await expect(projectRow('delta').first().locator('.honjin-change-count')).toHaveCount(0);
        await expect(projectRow('a.txt').locator('.honjin-change-letter')).toHaveCount(0);
    } finally {
        writeSettings(JSON.parse(original));
        rmSync(join(repo, '..'), { recursive: true, force: true });
    }
});

// A repo with one modified and one untracked file, listed through honjin.extraProjects.
function makeRepo(): string {
    const repo = join(tempDir('honjin-git-'), 'delta');
    mkdirSync(repo);
    git(repo, 'init', '-q');
    writeFileSync(join(repo, 'a.txt'), 'one\n');
    git(repo, 'add', '.');
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
    writeFileSync(join(repo, 'a.txt'), 'two\n');
    writeFileSync(join(repo, 'new.txt'), 'new\n');
    return repo;
}

test('C9, C10, C1: keyboard and toggles, Open File, Copy Path, hidden projects', async ({ page, context }) => {
    test.setTimeout(120_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const original = readFileSync(settingsFile(), 'utf8');
    const repo = makeRepo();
    try {
        writeSettings({ ...JSON.parse(original), 'honjin.extraProjects': [repo] });
        await page.goto('/');
        const project = changeRow(page, 'delta');
        await expect(project.locator('.honjin-change-count')).toHaveText('2', { timeout: 60_000 });

        // C9: a click on the project row toggles it, and the state survives a refresh
        await project.click();
        await expect(changeRow(page, 'a.txt')).toHaveCount(0);
        writeFileSync(join(repo, 'third.txt'), 'x\n');
        await expect(project.locator('.honjin-change-count')).toHaveText('3', { timeout: 30_000 });
        await expect(changeRow(page, 'a.txt')).toHaveCount(0);
        await project.click();
        await expect(changeRow(page, 'a.txt')).toBeVisible();

        // C9: Enter on a file row opens its diff
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(page.locator('.monaco-diff-editor').first()).toBeVisible({ timeout: 15_000 });

        // C10: Open File opens the plain editor; Copy Path copies the absolute path
        const item = (label: string) => page.locator('.lm-Menu-itemLabel', { hasText: label });
        await changeRow(page, 'new.txt').click({ button: 'right' });
        await item('Open File').click();
        await expect(page.locator('.lm-TabBar-tab', { hasText: 'new.txt', hasNotText: 'Working Tree' })).toBeVisible({ timeout: 15_000 });
        await changeRow(page, 'new.txt').click({ button: 'right' });
        await item('Copy Path').click();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(join(repo, 'new.txt'));

        // C1: a hidden project's changes are not listed
        writeSettings({ ...JSON.parse(original), 'honjin.extraProjects': [repo], 'honjin.hiddenProjects': [repo] });
        await expect(changeRow(page, 'delta')).toHaveCount(0, { timeout: 30_000 });
    } finally {
        writeSettings(JSON.parse(original));
        rmSync(join(repo, '..'), { recursive: true, force: true });
    }
});

test('C14: a saved layout with Projects outside the container is moved into it', async ({ page }) => {
    // Theia stores the layout on unload, but only listens for unload once the preload screen is gone; the first
    // load may still reload to open the workspace, hence the retry. The layout is edited from a same-origin page
    // that isn't Theia, so nothing overwrites it.
    await expect(async () => {
        await page.goto('/');
        await expect(page.locator('[data-testid="honjin-changes"]')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.theia-preload')).toHaveCount(0);
        await page.goto('/favicon.ico');
        // Rewrite it the way it looked before spec 09: Projects as its own right-panel tab.
        expect(await page.evaluate(() => {
            const key = Object.keys(localStorage).find(k => k.endsWith(':layout'));
            const layout = key && JSON.parse(JSON.parse(localStorage.getItem(key)!));
            const item = layout?.rightPanel.items.find((i: { widget?: { constructionOptions: { factoryId: string } } }) =>
                i.widget?.constructionOptions.factoryId === 'honjin-projects-container');
            if (!item) {
                return false;
            }
            item.widget = { constructionOptions: { factoryId: 'honjin-projects' }, innerWidgetState: '{}' };
            localStorage.setItem(key!, JSON.stringify(JSON.stringify(layout)));
            return true;
        })).toBe(true);
    }).toPass({ timeout: 60_000 });
    await page.goto('/');
    const panel = page.locator('#theia-right-content-panel');
    await expect(panel.locator('[data-testid="honjin-projects"]')).toBeVisible({ timeout: 30_000 });
    await expect(panel.locator('[data-testid="honjin-changes"]')).toBeVisible();
    await expect(page.locator('#shell-tab-honjin-projects-container')).toBeVisible();
    await expect(page.locator('#shell-tab-honjin-projects')).toHaveCount(0);
});
