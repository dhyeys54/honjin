import { expect, test, Page } from '@playwright/test';
import { ChildProcess, spawn } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join, resolve } from 'path';
import { row } from './helpers';
import { FAKE_CLAUDE, fakeAgent } from './fake-agents';

// Needs its own backend: the shared one is seeded with settings, first run needs an empty profile.
const PORT = Number(process.env.HONJIN_E2E_PORT ?? 3100) + 10; // next to the shared server, so a parallel worktree on another port does not collide
const url = `http://127.0.0.1:${PORT}`;
const root = resolve(__dirname, '..');
const projectsDir = resolve(__dirname, 'fixtures/projects');
const configDir = join(mkdtempSync(join(tmpdir(), 'honjin-first-run-')), 'honjin-config');
let server: ChildProcess | undefined;

async function startServer(config = configDir): Promise<void> {
    server = spawn('npm', ['--prefix', 'browser-app', 'start', '--', '--hostname', '127.0.0.1', '--port', String(PORT)], {
        cwd: root,
        env: { ...process.env, THEIA_CONFIG_DIR: config, HONJIN_HERDR_SESSION: process.env.HONJIN_E2E_SESSION! },
        stdio: 'ignore',
        detached: true
    });
    await expect.poll(async () => fetch(url).then(r => r.ok, () => false), { timeout: 90_000 }).toBe(true);
}

async function stopServer(): Promise<void> {
    if (server?.pid) {
        try {
            process.kill(-server.pid);
        } catch {
            // already gone (ESRCH): nothing to stop
        }
    }
    server = undefined;
    await expect.poll(async () => fetch(url).then(() => true, () => false), { timeout: 30_000 }).toBe(false);
}

const dialog = (page: Page) => page.locator('.theia-dialog-shell, .dialogBlock').first();
const pickerTitle = (page: Page) => page.locator('.dialogTitle', { hasText: 'Choose the folders that hold your projects' });

test.beforeAll(async () => {
    mkdirSync(configDir, { recursive: true });
    await startServer();
});
test.afterAll(stopServer);

test('first run asks for folders, fills the tree, and does not ask again', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(url);
    await expect(page.getByText('Choose the folders that hold your projects').first()).toBeVisible({ timeout: 60_000 });

    await page.locator('.theia-LocationInputToggle').click(); // switch the location list to a text field
    const location = page.locator('.theia-LocationListPanel input');
    await location.fill(projectsDir);
    await location.press('Enter');
    await expect(page.locator('.theia-FileTree, .dialogContent').getByText('alpha', { exact: true }).first()).toBeVisible({ timeout: 15_000 }); // navigation done; Choose earlier picks the previous folder
    await page.getByRole('button', { name: 'Choose', exact: true }).click();

    await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => readFileSync(join(configDir, 'settings.json'), 'utf8')).toContain('"honjin.firstRunCompleted": true');
    expect(JSON.parse(readFileSync(join(configDir, 'settings.json'), 'utf8'))['honjin.scanRoots']).toEqual([projectsDir.startsWith(homedir() + '/') ? '~' + projectsDir.slice(homedir().length) : projectsDir]); // spec 05: stored with ~

    await stopServer();
    await startServer();
    await page.goto(url);
    await expect(row(page, 'alpha')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Choose the folders that hold your projects')).toHaveCount(0);
    expect(await dialog(page).count()).toBeLessThanOrEqual(1);
});

test('with no agent, Setup holds the folder picker until Continue anyway, and no + hint follows (spec 13 S7)', async ({ page }) => {
    test.setTimeout(180_000);
    rmSync(join(process.env.HONJIN_TEST_PATH!, 'claude'));
    const fresh = join(mkdtempSync(join(tmpdir(), 'honjin-first-run-')), 'honjin-config');
    mkdirSync(fresh, { recursive: true });
    try {
        await stopServer();
        await startServer(fresh);
        await page.goto(url);
        await expect(page.locator('[data-testid="honjin-setup-state"]')).toHaveText('Install at least one agent.', { timeout: 60_000 });
        await page.waitForTimeout(2000); // the picker would open by now if Setup didn't hold it (the empty Projects view says the same words)
        await expect(pickerTitle(page)).toHaveCount(0);

        await page.getByRole('button', { name: 'Continue anyway' }).click();
        await expect(pickerTitle(page)).toBeVisible({ timeout: 15_000 });
        await page.keyboard.press('Escape');
        const settings = () => { try { return readFileSync(join(fresh, 'settings.json'), 'utf8'); } catch { return ''; } };
        await expect.poll(settings, { timeout: 15_000 }).toContain('"honjin.firstRunCompleted": true');
        await page.waitForTimeout(2000);
        await expect(page.getByText('Click + on any folder to start an agent there.')).toHaveCount(0);
    } finally {
        fakeAgent('claude', FAKE_CLAUDE);
    }
});
