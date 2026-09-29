import { expect, test } from '@playwright/test';

test('Projects and Changes are stacked in one right-panel container', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('#theia-right-content-panel');
    const projects = panel.locator('[data-testid="corral-projects"]');
    const changes = panel.locator('[data-testid="corral-changes"]');
    await expect(projects).toBeVisible({ timeout: 30_000 });
    await expect(changes).toBeVisible();
    const top = async (l: typeof projects) => (await l.boundingBox())?.y ?? -1;
    expect(await top(projects)).toBeGreaterThan(-1);
    expect(await top(projects)).toBeLessThan(await top(changes));
});
