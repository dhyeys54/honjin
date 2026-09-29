import { expect, test, Page } from '@playwright/test';
import { ChildProcess, spawn } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join, resolve } from 'path';
import { row } from './helpers';

// Needs its own backend: the shared one is seeded with settings, first run needs an empty profile.
const PORT = 3110;
const url = `http://127.0.0.1:${PORT}`;
const root = resolve(__dirname, '..');
const projectsDir = resolve(__dirname, 'fixtures/projects');
const configDir = join(mkdtempSync(join(tmpdir(), 'corral-first-run-')), 'corral-config');
let server: ChildProcess | undefined;

async function startServer(): Promise<void> {
    server = spawn('npm', ['--prefix', 'browser-app', 'start', '--', '--hostname', '127.0.0.1', '--port', String(PORT)], {
        cwd: root,
        env: { ...process.env, THEIA_CONFIG_DIR: configDir, CORRAL_HERDR_SESSION: process.env.CORRAL_E2E_SESSION! },
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
    await expect.poll(() => readFileSync(join(configDir, 'settings.json'), 'utf8')).toContain('"corral.firstRunCompleted": true');
    expect(JSON.parse(readFileSync(join(configDir, 'settings.json'), 'utf8'))['corral.scanRoots']).toEqual([projectsDir.startsWith(homedir() + '/') ? '~' + projectsDir.slice(homedir().length) : projectsDir]); // spec 05: stored with ~

    await stopServer();
    await startServer();
    await page.goto(url);
    await expect(row(page, 'alpha')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Choose the folders that hold your projects')).toHaveCount(0);
    expect(await dialog(page).count()).toBeLessThanOrEqual(1);
});
