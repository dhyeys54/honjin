import { expect, test, Page } from '@playwright/test';
import { execFileSync } from 'child_process';

const session = () => process.env.CORRAL_E2E_SESSION!;
const herdr = (...args: string[]) => execFileSync('herdr', ['--session', session(), ...args], { encoding: 'utf8' });
const json = (...args: string[]) => JSON.parse(herdr(...args));

const projects = (page: Page) => page.locator('[data-testid="corral-projects"]');
const row = (page: Page, name: string) => projects(page).locator('.theia-TreeNode', { hasText: new RegExp(`^${name}$`) });

test('the + on a folder opens a herdr tab in the project workspace', async ({ page }) => {
    await page.goto('/');
    await expect(projects(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.lm-TabBar-tab', { hasText: /^herdr$/ })).toBeVisible({ timeout: 30_000 });

    await row(page, 'alpha').click();
    await page.keyboard.press('ArrowRight');
    await row(page, 'src').hover();
    const plus = row(page, 'src').getByTestId('corral-new-tab');
    await expect(plus).toBeVisible();
    await expect(plus).toHaveAttribute('aria-label', 'New herdr tab in src');
    await plus.click();

    await expect.poll(() => json('workspace', 'list').result.workspaces.filter((w: { label: string }) => w.label === 'alpha').length, { timeout: 20_000 }).toBe(1);
    await expect.poll(() => herdr('pane', 'list'), { timeout: 20_000 }).toContain('alpha/src');
    const pane = json('pane', 'list').result.panes.find((p: { cwd: string }) => p.cwd.endsWith('alpha/src'));
    await expect.poll(() => herdr('pane', 'read', pane.pane_id), { timeout: 20_000 }).toContain('corral-e2e');

    // a second + on the project root adds a tab to the same workspace
    await row(page, 'alpha').hover();
    await row(page, 'alpha').getByTestId('corral-new-tab').click();
    const alpha = json('workspace', 'list').result.workspaces.find((w: { label: string }) => w.label === 'alpha').workspace_id;
    await expect.poll(() => json('tab', 'list', '--workspace', alpha).result.tabs.length, { timeout: 20_000 }).toBe(2);
    expect(json('workspace', 'list').result.workspaces.filter((w: { label: string }) => w.label === 'alpha')).toHaveLength(1);
    await expect(page.locator('.lm-TabBar-tab.theia-mod-active', { hasText: /^herdr$/ })).toBeVisible();
});

test('⌥⌘T on a focused folder does the same', async ({ page }) => {
    await page.goto('/');
    await expect(projects(page)).toBeVisible({ timeout: 30_000 });
    const before = json('tab', 'list').result.tabs.length;
    await row(page, 'beta').click();
    await page.keyboard.press('Meta+Alt+t');
    await page.keyboard.press('Control+Alt+t');
    await expect.poll(() => json('tab', 'list').result.tabs.length, { timeout: 20_000 }).toBeGreaterThan(before);
    await expect.poll(() => json('workspace', 'list').result.workspaces.some((w: { label: string }) => w.label === 'beta')).toBe(true);
});
