import { expect, test, Page } from '@playwright/test';

const agentsView = (page: Page) => page.locator('[data-testid="corral-agents"]');
const part = (page: Page, id: string) => page.locator(`#corral-projects-container--${id}`);
const empty = (page: Page) => page.locator('[data-testid="corral-agents-empty"]');

test('A12: Agents is the third part, under Changes, titled Agents', async ({ page }) => {
    await page.goto('/');
    const top = async (id: string) => {
        await expect(part(page, id)).toBeVisible({ timeout: 30_000 });
        return (await part(page, id).boundingBox())?.y ?? -1;
    };
    const ys = [await top('corral-projects'), await top('corral-changes'), await top('corral-agents')];
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    await expect(part(page, 'corral-agents').locator('.theia-view-container-part-header .label')).toHaveText('Agents');
});

test('A11: with no agents the view says so', async ({ page }) => {
    // The E2E startup command is `echo corral-e2e`, so nothing here starts an agent.
    await page.goto('/');
    await expect(empty(page)).toHaveText('No agents running', { timeout: 15_000 });
});

/** Edits the saved layout the way the C14 test does: Theia only saves on unload, hence the retry. */
async function editSavedLayout(page: Page, edit: 'remove' | 'hide'): Promise<void> {
    await expect(async () => {
        await page.goto('/');
        await expect(page.locator('[data-testid="corral-changes"]')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.theia-preload')).toHaveCount(0);
        await page.goto('/favicon.ico');
        expect(await page.evaluate(mode => {
            const key = Object.keys(localStorage).find(k => k.endsWith(':layout'));
            const layout = key && JSON.parse(JSON.parse(localStorage.getItem(key)!));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const item = layout?.rightPanel.items.find((i: any) => i.widget?.constructionOptions.factoryId === 'corral-projects-container');
            if (!item) {
                return false;
            }
            const inner = typeof item.widget.innerWidgetState === 'string' ? JSON.parse(item.widget.innerWidgetState) : item.widget.innerWidgetState;
            if (mode === 'remove') {
                const before = inner.parts.length;
                inner.parts = inner.parts.filter((p: { partId: string }) => p.partId !== 'corral-agents');
                if (inner.parts.length === before) {
                    return false;
                }
            } else {
                const agents = inner.parts.find((p: { partId: string }) => p.partId === 'corral-agents');
                if (!agents) {
                    return false;
                }
                agents.hidden = true;
            }
            item.widget.innerWidgetState = typeof item.widget.innerWidgetState === 'string' ? JSON.stringify(inner) : inner;
            localStorage.setItem(key!, JSON.stringify(JSON.stringify(layout)));
            return true;
        }, edit)).toBe(true);
    }).toPass({ timeout: 60_000 });
}

test('A12: a layout saved before Agents existed gets the part, visible and not squashed', async ({ page }) => {
    await editSavedLayout(page, 'remove');
    await page.goto('/');
    await expect(empty(page)).toBeVisible({ timeout: 30_000 });
    expect((await part(page, 'corral-agents').boundingBox())?.height).toBeGreaterThan(40);
});

test('A12: a part the user hid stays hidden', async ({ page }) => {
    await editSavedLayout(page, 'hide');
    await page.goto('/');
    await expect(page.locator('[data-testid="corral-projects"]')).toBeVisible({ timeout: 30_000 });
    await expect(agentsView(page)).not.toBeVisible();
});
