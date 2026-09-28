import { expect, test } from '@playwright/test';

test('no AI or chat view is present in any panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#theia-app-shell')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2000); // let deferred layout contributions settle
    const titles = await page.locator('.p-TabBar-tab, .lm-TabBar-tab').evaluateAll(els => els.map(e => (e.getAttribute('title') || e.textContent || '').toLowerCase()));
    expect(titles.filter(t => /\b(ai|chat)\b/.test(t))).toEqual([]);
});
