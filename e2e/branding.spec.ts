import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test('the favicon is the Honjin favicon', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theia-app-shell')).toBeVisible({ timeout: 60_000 });
    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    const svg = readFileSync(join(__dirname, '../branding/favicon.svg'), 'utf8').trim();
    const comma = href!.indexOf(',');
    const [head, body] = [href!.slice(0, comma), href!.slice(comma + 1)];
    const decoded = head.endsWith(';base64') ? Buffer.from(body, 'base64').toString('utf8') : decodeURIComponent(body);
    const flat = (t: string) => t.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
    expect(flat(decoded)).toBe(flat(svg));
});

test('Help → About names the application Honjin', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theia-app-shell')).toBeVisible({ timeout: 60_000 });
    await page.locator('.lm-MenuBar-itemLabel', { hasText: 'Help' }).click();
    await page.locator('.lm-Menu-itemLabel', { hasText: 'About' }).click();
    await expect(page.locator('.theia-aboutDialog, .dialogBlock').getByText('Honjin', { exact: false }).first()).toBeVisible();
});
