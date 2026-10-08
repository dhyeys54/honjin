import { expect, test, Page } from '@playwright/test';
import { existsSync, readlinkSync, rmSync, symlinkSync } from 'fs';
import { join } from 'path';
import { FAKE_CLAUDE, fakeAgent } from './fake-agents';
import { herdr, row } from './helpers';

const view = (page: Page) => page.locator('[data-testid="honjin-setup"]');
const setupRow = (page: Page, id: string) => view(page).locator(`[data-testid="honjin-setup-row"][data-id="${id}"]`);
const state = (page: Page) => view(page).locator('[data-testid="honjin-setup-state"]');

test('Setup opens when no agent is installed, Re-check finds one, and the command reopens it (spec 13 S5, S7)', async ({ page }) => {
    test.setTimeout(120_000);
    rmSync(join(process.env.HONJIN_TEST_PATH!, 'claude'));
    try {
        await page.goto('/');
        await expect(view(page)).toBeVisible({ timeout: 60_000 });
        await expect(state(page)).toHaveText('Install at least one agent.');
        await expect(setupRow(page, 'herdr')).toContainText(/herdr \d+\.\d+/);
        await expect(setupRow(page, 'claude').getByRole('button', { name: 'Install' })).toBeVisible();
        await expect(setupRow(page, 'claude')).toContainText('Agent');

        fakeAgent('claude', FAKE_CLAUDE);
        await view(page).getByRole('button', { name: 'Re-check' }).click();
        await expect(setupRow(page, 'claude')).toContainText('1.0.0 (fake claude)');
        await expect(setupRow(page, 'claude').getByRole('button', { name: 'Install' })).toHaveCount(0);
        await expect(state(page)).toHaveText('Ready. Click + on any folder to start an agent.');

        await page.locator('.lm-TabBar-tab', { hasText: 'Set Up Honjin' }).locator('.lm-TabBar-tabCloseIcon').click();
        await expect(view(page)).toHaveCount(0);
        await page.locator('[data-testid="honjin-projects"]').click({ position: { x: 5, y: 150 } }); // keys go to herdr while its terminal has focus
        await page.keyboard.press('F1');
        await page.keyboard.type('Honjin: Set Up Prerequisites');
        await page.keyboard.press('Enter');
        await expect(state(page)).toHaveText('Ready. Click + on any folder to start an agent.');
        await page.locator('.lm-TabBar-tab', { hasText: 'Set Up Honjin' }).locator('.lm-TabBar-tabCloseIcon').click();
    } finally {
        fakeAgent('claude', FAKE_CLAUDE);
    }
});

test('Setup stays closed at start when herdr and an agent are found', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lm-TabBar-tab', { hasText: /^herdr$/ })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000); // the check is async; give it time to (wrongly) open
    await expect(view(page)).toHaveCount(0);
});

test('herdr installed through Setup replaces the "herdr not found" notice without a reload (spec 02 step 5, spec 13 S7)', async ({ page }) => {
    test.setTimeout(120_000);
    const link = join(process.env.HONJIN_TEST_PATH!, 'herdr');
    const target = readlinkSync(link);
    rmSync(link);
    try {
        await page.goto('/');
        await expect(state(page)).toHaveText('Install herdr to continue.', { timeout: 60_000 });
        const notice = page.locator('.honjin-herdr-overlay');
        await expect(notice).toContainText('herdr not found');
        await expect(notice.getByRole('button', { name: 'Set Up Honjin' })).toBeVisible();

        symlinkSync(target, link);
        await view(page).getByRole('button', { name: 'Re-check' }).click();
        await expect(state(page)).toHaveText('Ready. Click + on any folder to start an agent.');
        await expect(notice).toHaveCount(0, { timeout: 30_000 });
        await expect(page.locator('.lm-TabBar-tab', { hasText: /^herdr$/ })).toHaveCount(1);
        await expect(page.locator(`#honjin-herdr-terminal .xterm`)).toBeVisible();
    } finally {
        if (!existsSync(link)) {
            symlinkSync(target, link);
        }
    }
});

test('+ with no agent installed opens Setup and starts nothing (spec 13 S9)', async ({ page }) => {
    rmSync(join(process.env.HONJIN_TEST_PATH!, 'claude'));
    try {
        await page.goto('/');
        await expect(state(page)).toHaveText('Install at least one agent.', { timeout: 60_000 });
        await page.locator('.lm-TabBar-tab', { hasText: 'Set Up Honjin' }).locator('.lm-TabBar-tabCloseIcon').click();
        await expect(view(page)).toHaveCount(0);
        const panes = () => JSON.parse(herdr('pane', 'list')).result.panes.map((p: { pane_id: string }) => p.pane_id);
        const before = panes();
        await row(page, 'beta').hover();
        await row(page, 'beta').getByTestId('honjin-new-tab').click();
        await expect(state(page)).toHaveText('Install at least one agent.');
        await expect(page.locator('.quick-input-widget')).toBeHidden();
        expect(panes()).toEqual(before);
    } finally {
        fakeAgent('claude', FAKE_CLAUDE);
    }
});
