import { expect, test } from '@playwright/test';

// The collapse slide (D31) must not lose the width the panel reopens at.
test('the Projects panel slides shut and reopens at the same width', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('#theia-right-content-panel'); // the tab strip plus the view
    const tab = page.locator('.theia-app-right #shell-tab-honjin-projects-container');
    const width = async () => Math.round((await panel.boundingBox())?.width ?? 0);
    await expect.poll(width, { timeout: 30_000 }).toBeGreaterThan(100);
    await expect(tab).toHaveClass(/lm-mod-current/);
    const before = await width();

    await tab.click();
    await expect(panel).toHaveClass(/theia-mod-collapsed/);
    await tab.click();
    await expect(panel).not.toHaveClass(/theia-mod-collapsed/);
    await expect.poll(width).toBe(before);
});

// Spec 02: Reset Layout restores the default sizes, whatever the user dragged them to.
test('Reset Layout sets the right panel to 300px and the left to open at 280px', async ({ page }) => {
    await page.goto('/');
    const right = page.locator('#theia-right-content-panel');
    const left = page.locator('#theia-left-content-panel');
    const width = async (l: typeof right) => Math.round((await l.boundingBox())?.width ?? 0);
    await expect.poll(() => width(right), { timeout: 30_000 }).toBeGreaterThan(100);

    const runCommand = async (label: string) => {
        await page.locator('[data-testid="honjin-projects"]').click(); // out of the terminal, which takes F1
        await page.keyboard.press('F1');
        await page.locator('.quick-input-widget input').pressSequentially(label);
        await expect(page.locator('.quick-input-list .monaco-list-row', { hasText: label }).first()).toBeVisible();
        await page.keyboard.press('Enter');
    };
    const handle = page.locator('#theia-left-right-split-panel > .lm-SplitPanel-handle:not(.lm-mod-hidden):not(.sash-hidden)');
    await expect(async () => {
        const box = (await handle.boundingBox())!;
        // The handle is 0px wide, so start the drag on it directly; Lumino then tracks the pointer on the document.
        await handle.dispatchEvent('pointerdown', { clientX: box.x, clientY: box.y + 200, button: 0, isPrimary: true });
        await page.mouse.move(box.x - 200, box.y + 200, { steps: 5 });
        await page.mouse.down();
        await page.mouse.up();
        expect(await width(right)).toBeGreaterThan(400);
    }).toPass({ timeout: 15_000 });

    await runCommand('Honjin: Reset Layout');
    const off = (l: typeof right, target: number) => async () => Math.abs(await width(l) - target);
    await expect.poll(off(right, 300)).toBeLessThanOrEqual(2);
    await page.locator('.theia-app-left .lm-TabBar-tab').first().click();
    await expect.poll(off(left, 280)).toBeLessThanOrEqual(2);
});
