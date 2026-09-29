import { expect, test, Page } from '@playwright/test';
import { herdr } from './helpers';

// Across all workspaces: the client may focus a different workspace than the CLI created.
const tabCount = () => (JSON.parse(herdr('workspace', 'list')).result?.workspaces ?? []).reduce((n: number, w: { tab_count: number }) => n + w.tab_count, 0);

async function focusHerdr(page: Page) {
    herdr('workspace', 'create', '--cwd', '/tmp', '--label', 'keys-check'); // prefix+c needs a workspace to add a tab to
    await page.goto('/');
    await expect(page.locator('.lm-TabBar-tab', { hasText: /^herdr$/ })).toBeVisible({ timeout: 30_000 });
    await page.locator('.terminal-container .xterm-screen').first().click();
    await page.waitForTimeout(1500); // let herdr paint its welcome dialog before keys arrive
    await page.keyboard.press('Enter'); // dismiss herdr's first-run welcome dialog
    await page.waitForTimeout(800);
}

test('the herdr prefix reaches herdr: ctrl+b c creates a tab', async ({ page }) => {
    await focusHerdr(page);
    const before = tabCount();
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(300);
    await page.keyboard.press('c');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter'); // herdr asks for the new tab's name first; Enter accepts the default
    await expect.poll(tabCount, { timeout: 10_000 }).toBe(before + 1);
});

test('⌘P / Ctrl+P still opens Quick Open from the terminal', async ({ page }) => {
    await focusHerdr(page);
    await page.keyboard.press('ControlOrMeta+p');
    await expect(page.locator('.quick-input-widget')).toBeVisible({ timeout: 5_000 });
});
