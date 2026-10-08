import { expect, test, Page } from '@playwright/test';
import { readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { fakeAgent } from './fake-agents';
import { herdr, projects, row, settingsFile, writeSettings } from './helpers';

// The E2E settings map claude → `echo corral-e2e` and codex → `echo corral-e2e-codex` (playwright.config.ts).
const json = (...args: string[]) => JSON.parse(herdr(...args));
const picker = (page: Page) => page.locator('.quick-input-widget');
type Pane = { pane_id: string; cwd: string };
const paneIds = (): string[] => json('pane', 'list').result.panes.filter((p: Pane) => p.cwd.endsWith('/beta')).map((p: Pane) => p.pane_id);
const newPanes = (before: string[]) => paneIds().filter(id => !before.includes(id));

async function plus(page: Page, name: string): Promise<void> {
    await row(page, name).hover();
    await row(page, name).getByTestId('corral-new-tab').click();
}

test.describe('with claude and codex installed', () => {
    test.beforeAll(() => { fakeAgent('codex'); });
    test.afterAll(() => rmSync(join(process.env.CORRAL_TEST_PATH!, 'codex'), { force: true }));

    test('+ asks which agent, runs the choice, and preselects it next time (spec 13 S9)', async ({ page }) => {
        await page.goto('/');
        await expect(projects(page)).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => localStorage.removeItem('corral.lastAgent'));
        const before = paneIds();

        await plus(page, 'beta');
        await expect(picker(page)).toBeVisible();
        const items = picker(page).locator('.monaco-list-row');
        await expect(items).toHaveText([/Claude Code/, /Codex/, /Shell/]);
        await items.filter({ hasText: 'Codex' }).click();
        await expect.poll(() => newPanes(before).length, { timeout: 20_000 }).toBe(1);
        await expect.poll(() => herdr('pane', 'read', newPanes(before)[0]), { timeout: 20_000 }).toContain('corral-e2e-codex');
        const afterCodex = paneIds();

        await plus(page, 'beta');
        await expect(picker(page)).toBeVisible();
        await expect(picker(page).locator('.monaco-list-row.focused')).toContainText('Codex');
        await page.keyboard.press('Escape');
        await expect(picker(page)).toBeHidden();
        await page.waitForTimeout(1000);
        expect(newPanes(afterCodex)).toEqual([]); // Escape opens nothing
    });

    test('a project override skips the picker', async ({ page }) => {
        const original = readFileSync(settingsFile(), 'utf8');
        const beta = join(__dirname, 'fixtures/projects/beta');
        try {
            writeSettings({ ...JSON.parse(original), 'corral.projectOverrides': { [beta]: { startupCommand: 'echo corral-e2e-override' } } });
            await page.goto('/');
            await expect(projects(page)).toBeVisible({ timeout: 30_000 });
            const before = paneIds();
            await plus(page, 'beta');
            await expect.poll(() => newPanes(before).length, { timeout: 20_000 }).toBe(1);
            await expect(picker(page)).toBeHidden();
            await expect.poll(() => herdr('pane', 'read', newPanes(before)[0]), { timeout: 20_000 }).toContain('corral-e2e-override');
        } finally {
            writeSettings(original);
        }
    });
});

test('with only claude installed, + opens a tab with no picker', async ({ page }) => {
    await page.goto('/');
    await expect(projects(page)).toBeVisible({ timeout: 30_000 });
    const before = paneIds();
    await plus(page, 'beta');
    await expect.poll(() => newPanes(before).length, { timeout: 20_000 }).toBe(1);
    await expect(picker(page)).toBeHidden();
    await expect.poll(() => herdr('pane', 'read', newPanes(before)[0]), { timeout: 20_000 }).toContain('corral-e2e');
});
