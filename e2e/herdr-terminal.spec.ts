import { expect, test, Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { herdr, session } from './helpers';

const serverRunning = () => JSON.parse(herdr('status', 'server', '--json')).running === true;

const herdrTab = (page: Page) => page.locator('.lm-TabBar-tab', { hasText: /^herdr$/ });

async function open(page: Page) {
    await page.goto('/');
    await expect(page.locator('#theia-app-shell')).toBeVisible({ timeout: 60_000 });
    await expect(herdrTab(page)).toBeVisible({ timeout: 30_000 });
}

test('a herdr tab exists in the main area with no close button', async ({ page }) => {
    await open(page);
    await expect(herdrTab(page)).toHaveCount(1);
    await expect(herdrTab(page)).not.toHaveClass(/lm-mod-closable/);
    expect(serverRunning()).toBe(true);
});

const clientRunning = () => {
    try {
        execFileSync('pgrep', ['-f', `herdr --session ${session()}$`]);
        return true;
    } catch {
        return false;
    }
};

test('the terminal runs a herdr client against the test session', async ({ page }) => {
    await open(page);
    // xterm paints to a canvas, so there is no text to read; the client process is the observable signal.
    await expect.poll(clientRunning, { timeout: 30_000 }).toBe(true);
    await expect(page.locator('.corral-herdr-overlay')).toHaveCount(0);
});

test('detaching shows the exited overlay and Reattach attaches again', async ({ page }) => {
    await open(page);
    await herdrTab(page).click();
    await page.locator('.terminal-container .xterm-screen').first().click();
    await page.waitForTimeout(1500); // let herdr paint its welcome dialog before keys arrive
    await page.keyboard.press('Enter'); // dismiss herdr's first-run welcome dialog
    await page.waitForTimeout(800);
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(300);
    await page.keyboard.press('q');
    const overlay = page.locator('.corral-herdr-overlay');
    await expect(overlay).toContainText('herdr exited', { timeout: 15_000 });
    await overlay.locator('button.theia-button').click();
    await expect(overlay).toBeHidden({ timeout: 15_000 });
    await expect(herdrTab(page)).toHaveCount(1);
});

test('right-click in herdr leaves the menu to herdr: no Theia terminal menu on top', async ({ page }) => {
    await open(page);
    await herdrTab(page).click();
    await page.locator('.terminal-container .xterm-screen').first().click({ button: 'right' });
    await page.waitForTimeout(600); // Theia's menu renders at once; the wait proves it stays away
    await expect(page.locator('.lm-Menu:visible')).toHaveCount(0);
});

test('herdr survives the IDE (R15)', async ({ page }) => {
    await open(page);
    herdr('workspace', 'create', '--cwd', '/tmp', '--label', 'persist-check', '--no-focus');
    await page.close();
    expect(serverRunning()).toBe(true);
    const page2 = await page.context().newPage();
    await open(page2);
    expect(herdr('workspace', 'list')).toContain('persist-check');
});
