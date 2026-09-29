import { expect, test, Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { projects, settingsFile, tempDir, writeSettings } from './helpers';

const row = (page: Page, name: string) => projects(page).locator('.theia-TreeNode', { hasText: new RegExp(`^${name}(missing)?$`) });
const alpha = resolve(__dirname, 'fixtures/projects/alpha');
const toolbar = (page: Page, id: string) => page.locator(`[id="${id}"]`).first();

test('add a folder outside the scan root, remove it, then see a deleted one as missing', async ({ page }) => {
    test.setTimeout(120_000);
    const original = readFileSync(settingsFile(), 'utf8');
    const outside = join(tempDir('corral-add-'), 'gamma');
    mkdirSync(outside);
    try {
        await page.goto('/');
        await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });

        await toolbar(page, 'corral.projects.add').click();
        await page.locator('.theia-LocationInputToggle').click();
        const location = page.locator('.theia-LocationListPanel input');
        await location.fill(join(outside, '..'));
        await location.press('Enter');
        await page.locator('.theia-dialog-shell, .dialogBlock').getByText('gamma').first().click();
        await page.getByRole('button', { name: 'Choose', exact: true }).click();
        await expect(row(page, 'gamma')).toBeVisible({ timeout: 20_000 });

        await row(page, 'gamma').click({ button: 'right' });
        await page.locator('.lm-Menu-itemLabel', { hasText: 'Remove from list' }).click();
        await expect(row(page, 'gamma')).toHaveCount(0);
        expect(existsSync(outside)).toBe(true);

        // Put it back through settings, delete it on disk, and refresh.
        writeSettings({ ...JSON.parse(original), 'corral.extraProjects': [outside] });
        await expect(row(page, 'gamma')).toBeVisible({ timeout: 20_000 });
        rmSync(outside, { recursive: true });
        await toolbar(page, 'corral.projects.refresh').click();
        await expect(row(page, 'gamma')).toHaveClass(/corral-project-missing/, { timeout: 20_000 });
        await expect(row(page, 'gamma').locator('[data-testid="corral-project-flag"]')).toHaveText('missing');
        await expect(row(page, 'gamma').locator('[data-testid="corral-new-tab"]')).toBeDisabled();

        // Spec 03 rule 4: a missing project stays listed even when hidden, so it can be removed or unhidden.
        writeSettings({ ...JSON.parse(original), 'corral.extraProjects': [outside], 'corral.hiddenProjects': [outside, alpha] });
        await expect(row(page, 'alpha')).toHaveCount(0, { timeout: 20_000 }); // the hidden list has been applied
        await expect(row(page, 'gamma')).toHaveClass(/corral-project-missing/);
    } finally {
        writeSettings(original);
    }
});
