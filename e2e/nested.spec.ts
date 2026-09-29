import { expect, test, Page } from '@playwright/test';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const scanRoot = resolve(__dirname, 'fixtures/projects');
const projects = (page: Page) => page.locator('[data-testid="corral-projects"]');
const row = (page: Page, name: string) => projects(page).locator('.theia-TreeNode', { hasText: new RegExp(`^${name}$`) });
const settingsFile = () => join(process.env.CORRAL_E2E_CONFIG_DIR!, 'settings.json');
const workspaceFile = () => join(process.env.CORRAL_E2E_CONFIG_DIR!, 'corral.code-workspace');
const writeSettings = (text: string) => {
    writeFileSync(settingsFile() + '.tmp', text);
    renameSync(settingsFile() + '.tmp', settingsFile());
};
const roots = () => existsSync(workspaceFile())
    ? (JSON.parse(readFileSync(workspaceFile(), 'utf8')).folders as { path: string }[]).map(f => decodeURIComponent(f.path.replace('file://', '')))
    : [];

test('Add project refuses a folder that holds other projects', async ({ page }) => {
    test.setTimeout(90_000);
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        await page.goto('/');
        await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });
        await page.locator('[id="corral.projects.add"]').first().click();
        await page.locator('.theia-LocationInputToggle').click();
        const location = page.locator('.theia-LocationListPanel input');
        await location.fill(scanRoot); // with nothing selected, Choose takes the folder the dialog is in
        await location.press('Enter');
        await page.getByRole('button', { name: 'Choose', exact: true }).click();
        await expect(page.getByText(/projects holds 2 listed projects/).first()).toBeVisible({ timeout: 15_000 });
        expect(JSON.parse(readFileSync(settingsFile(), 'utf8'))['corral.extraProjects'] ?? []).toEqual([]);
    } finally {
        writeSettings(original);
    }
});

// A scan root that is already saved as a project (from before the check) must not become a workspace root.
test('a listed folder that holds other projects stays out of the workspace roots', async ({ page }) => {
    test.setTimeout(90_000);
    const original = readFileSync(settingsFile(), 'utf8');
    try {
        await page.goto('/');
        await expect(row(page, 'alpha')).toBeVisible({ timeout: 30_000 });
        writeSettings(JSON.stringify({ ...JSON.parse(original), 'corral.extraProjects': [scanRoot] }));
        await expect(row(page, 'projects')).toBeVisible({ timeout: 20_000 });
        await expect.poll(roots, { timeout: 20_000 }).toContain(join(scanRoot, 'alpha'));
        await page.waitForTimeout(2_000); // give a wrong sync time to happen
        expect(roots()).not.toContain(scanRoot);
    } finally {
        writeSettings(original);
    }
});
