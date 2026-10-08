import { expect, test, Page } from '@playwright/test';
import { rmSync } from 'fs';
import { join } from 'path';
import { FAKE_CLAUDE, fakeAgent } from './fake-agents';

const view = (page: Page) => page.locator('[data-testid="corral-setup"]');
const setupRow = (page: Page, id: string) => view(page).locator(`[data-testid="corral-setup-row"][data-id="${id}"]`);
const state = (page: Page) => view(page).locator('[data-testid="corral-setup-state"]');

test('Setup opens when no agent is installed, Re-check finds one, and the command reopens it (spec 13 S5, S7)', async ({ page }) => {
    test.setTimeout(120_000);
    rmSync(join(process.env.CORRAL_TEST_PATH!, 'claude'));
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

        await page.locator('.lm-TabBar-tab', { hasText: 'Set Up Corral' }).locator('.lm-TabBar-tabCloseIcon').click();
        await expect(view(page)).toHaveCount(0);
        await page.locator('[data-testid="corral-projects"]').click({ position: { x: 5, y: 150 } }); // keys go to herdr while its terminal has focus
        await page.keyboard.press('F1');
        await page.keyboard.type('Corral: Set Up Prerequisites');
        await page.keyboard.press('Enter');
        await expect(state(page)).toHaveText('Ready. Click + on any folder to start an agent.');
        await page.locator('.lm-TabBar-tab', { hasText: 'Set Up Corral' }).locator('.lm-TabBar-tabCloseIcon').click();
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
