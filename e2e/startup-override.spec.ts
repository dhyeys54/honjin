import { expect, test, Page } from '@playwright/test';
import { readFileSync, renameSync, writeFileSync } from 'fs';
import { herdr, row, settingsFile } from './helpers';

const json = (...args: string[]) => JSON.parse(herdr(...args));
type Pane = { pane_id: string; cwd: string };
const panes = (dir: string): Pane[] => json('pane', 'list').result.panes.filter((p: Pane) => p.cwd.endsWith(dir));
const workspaces = (label: string) => json('workspace', 'list').result.workspaces.filter((w: { label: string }) => w.label === label);

async function plus(page: Page, name: string) {
    await row(page, name).hover();
    await row(page, name).getByTestId('corral-new-tab').click();
}

async function setCommand(page: Page, name: string, value: string) {
    await row(page, name).click({ button: 'right' });
    await page.locator('.lm-Menu-itemLabel', { hasText: 'Set startup command…' }).click();
    const input = page.locator('.quick-input-widget input');
    await input.fill(value);
    await input.press('Enter');
}

test('a per-project startup command overrides the global one; empty means a plain shell; forgetting the mapping makes a new workspace', async ({ page }) => {
    test.setTimeout(120_000);
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        await page.goto('/');
        await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });

        await setCommand(page, 'alpha', 'echo alpha-override');
        const before = panes('alpha').map(p => p.pane_id);
        await plus(page, 'alpha');
        await expect.poll(() => panes('alpha').filter(p => !before.includes(p.pane_id)).length, { timeout: 20_000 }).toBe(1);
        const overridden = panes('alpha').find(p => !before.includes(p.pane_id))!;
        await expect.poll(() => herdr('pane', 'read', overridden.pane_id), { timeout: 20_000 }).toContain('alpha-override');

        await plus(page, 'beta');
        await expect.poll(() => panes('beta').length, { timeout: 20_000 }).toBeGreaterThan(0);
        const beta = panes('beta').pop()!;
        await expect.poll(() => herdr('pane', 'read', beta.pane_id), { timeout: 20_000 }).toContain('corral-e2e');

        await setCommand(page, 'alpha', '');
        const beforePlain = panes('alpha').map(p => p.pane_id);
        await plus(page, 'alpha');
        await expect.poll(() => panes('alpha').filter(p => !beforePlain.includes(p.pane_id)).length, { timeout: 20_000 }).toBe(1);
        const plain = panes('alpha').find(p => !beforePlain.includes(p.pane_id))!;
        await page.waitForTimeout(2000);
        const text = herdr('pane', 'read', plain.pane_id);
        expect(text).not.toContain('alpha-override');
        expect(text).not.toContain('corral-e2e');

        const oldBeta = workspaces('beta');
        expect(oldBeta).toHaveLength(1);
        await row(page, 'beta').click({ button: 'right' });
        await page.locator('.lm-Menu-itemLabel', { hasText: 'Remove from herdr mapping' }).click();
        await plus(page, 'beta');
        await expect.poll(() => workspaces('beta').length, { timeout: 20_000 }).toBe(2);
        expect(workspaces('beta').map((w: { workspace_id: string }) => w.workspace_id)).toContain(oldBeta[0].workspace_id);
    } finally {
        const tmp = settingsFile() + '.tmp';
        writeFileSync(tmp, original);
        renameSync(tmp, settingsFile());
    }
});
