import { expect, test, Page } from '@playwright/test';
import { realpathSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { closeMenu, herdr, tempDir } from './helpers';

const FIXTURES = resolve(__dirname, 'fixtures/projects');

const agentsView = (page: Page) => page.locator('[data-testid="corral-agents"]');
const agentRow = (page: Page, text: string) => agentsView(page).locator('[data-testid="corral-agent-row"]', { hasText: text });
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

function workspace(cwd: string, label: string): { ws: string; pane: string } {
    const r = JSON.parse(herdr('workspace', 'create', '--cwd', cwd, '--label', label, '--no-focus')).result;
    return { ws: r.workspace.workspace_id, pane: r.root_pane.pane_id };
}
const report = (pane: string, state: string, kind = 'claude') =>
    herdr('pane', 'report-agent', '--source', 'corral-e2e', '--agent', kind, '--state', state, pane);
const herdrStatus = (pane: string) =>
    JSON.parse(herdr('agent', 'list')).result.agents.find((a: { pane_id: string }) => a.pane_id === pane)?.agent_status;

test('A3, A5, A8, A10: rows are ordered, coloured, aged, and a click focuses the agent', async ({ page }) => {
    test.setTimeout(120_000);
    const created: string[] = [];
    try {
        const beta = workspace(join(FIXTURES, 'beta'), 'agents-beta');
        created.push(beta.ws);
        const src = workspace(join(FIXTURES, 'alpha', 'src'), 'agents-src');
        created.push(src.ws);
        const dir = tempDir('corral-agents-');
        const out = workspace(dir, 'agents-out');
        created.push(out.ws);
        herdr('workspace', 'focus', beta.ws); // so src and out aren't the focused pane

        report(beta.pane, 'blocked');
        herdr('pane', 'run', beta.pane, "printf '\\033]0;Fix the login bug\\007'"); // sets the terminal title (A5)
        report(out.pane, 'working', 'codex');
        report(src.pane, 'working');
        report(src.pane, 'idle');
        await expect.poll(() => herdrStatus(src.pane)).toBe('done');

        await page.goto('/');
        const rows = agentsView(page).locator('[data-testid="corral-agent-row"]');
        await expect(rows).toHaveCount(3, { timeout: 15_000 });
        const texts = await rows.allInnerTexts();
        expect(texts[0]).toContain('beta');
        expect(texts[0]).toContain('blocked');
        expect(texts[1]).toContain('alpha/src');
        expect(texts[1]).toContain('done');
        expect(texts[2]).toContain('codex');
        expect(texts[2]).toContain(`${basename(dirname(dir))}/${basename(dir)}`);
        expect(texts[2]).toContain('working');

        // A5 (amended): the title gets a line of its own; a pane without a title stays one line
        await expect(agentRow(page, 'beta').locator('.corral-agent-title')).toHaveText('Fix the login bug', { timeout: 15_000 });
        await expect(agentRow(page, 'codex').locator('.corral-agent-title')).toHaveCount(0);
        const height = async (text: string) => (await agentRow(page, text).boundingBox())!.height;
        expect(await height('beta')).toBeGreaterThan(await height('codex') + 8); // two lines, not clipped to one
        // A5: the tooltip is the pane title, then the cwd; with no title, the cwd alone
        await expect(agentRow(page, 'beta')).toHaveAttribute('title', `Fix the login bug\n${realpathSync(join(FIXTURES, 'beta'))}`);
        await expect(agentRow(page, 'codex')).toHaveAttribute('title', realpathSync(dir));
        const blockedDot = agentRow(page, 'beta').locator('.corral-agent-dot.corral-agent-blocked');
        await expect(blockedDot).toHaveCount(1);
        expect(await blockedDot.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(229, 115, 107)');
        const workingDot = agentRow(page, 'codex').locator('.corral-agent-dot.corral-agent-working');
        expect(await workingDot.evaluate(e => getComputedStyle(e).animationName)).toBe('corral-live-pulse');
        for (const text of await rows.locator('.corral-agent-main').allInnerTexts()) {
            expect(text.replace(/\s+/g, ' ').trim()).toMatch(/(blocked|done|working|idle|unknown) \d+[smh]$/);
        }

        await agentRow(page, 'alpha/src').click();
        await expect(agentRow(page, 'alpha/src')).toContainText('idle', { timeout: 10_000 });
        await expect.poll(() => herdrStatus(src.pane), { timeout: 10_000 }).toBe('idle');
        await expect(page.locator('.lm-TabBar-tab.lm-mod-current', { hasText: /^herdr$/ })).toBeVisible();

        report(out.pane, 'working', 'claude');
        await expect(agentRow(page, 'working')).toContainText('claude', { timeout: 10_000 });
        await expect(agentRow(page, 'working')).not.toContainText('codex');
    } finally {
        for (const ws of created) {
            try { herdr('workspace', 'close', ws); } catch { /* already gone */ }
        }
    }
    await page.goto('/');
    await expect(empty(page)).toHaveText('No agents running', { timeout: 15_000 });
});

test('A9: the context menu focuses, reveals in Projects (when owned) and copies the path', async ({ page, context }) => {
    test.setTimeout(120_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const created: string[] = [];
    try {
        const srcDir = realpathSync(join(FIXTURES, 'alpha', 'src'));
        const src = workspace(srcDir, 'agents-src');
        created.push(src.ws);
        const out = workspace(tempDir('corral-agents-'), 'agents-out');
        created.push(out.ws);
        report(src.pane, 'blocked');
        report(out.pane, 'blocked');

        await page.goto('/');
        await expect(agentsView(page).locator('[data-testid="corral-agent-row"]')).toHaveCount(2, { timeout: 15_000 });
        const item = (label: string) => page.locator('.lm-Menu-itemLabel', { hasText: label });

        await agentRow(page, 'alpha/src').click({ button: 'right' });
        await expect(item('Focus Agent')).toBeVisible();
        await expect(item('Reveal in Projects')).toBeVisible();
        await item('Copy Path').click();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(srcDir);

        await agentRow(page, 'alpha/src').click({ button: 'right' });
        await item('Reveal in Projects').click();
        await expect(page.locator('[data-testid="corral-projects"] .theia-TreeNode.theia-mod-selected', { hasText: 'src' })).toBeVisible({ timeout: 10_000 });

        await agentRow(page, 'blocked').last().click({ button: 'right' });
        await expect(item('Copy Path')).toBeVisible();
        await expect(item('Reveal in Projects')).toHaveCount(0);
        await closeMenu(page);
    } finally {
        for (const ws of created) {
            try { herdr('workspace', 'close', ws); } catch { /* already gone */ }
        }
    }
});

test('A7: the part header and the right-panel tab count agents that need you', async ({ page }) => {
    test.setTimeout(120_000);
    const created: string[] = [];
    try {
        const beta = workspace(join(FIXTURES, 'beta'), 'agents-beta');
        created.push(beta.ws);
        const src = workspace(join(FIXTURES, 'alpha', 'src'), 'agents-src');
        created.push(src.ws);
        herdr('workspace', 'focus', beta.ws);
        report(beta.pane, 'working');

        await page.goto('/');
        await expect(agentRow(page, 'beta')).toContainText('working', { timeout: 15_000 });
        const partBadge = part(page, 'corral-agents').locator('.notification-count');
        const tabBadge = page.locator('#shell-tab-corral-projects-container .theia-badge-decorator-sidebar');
        await expect(partBadge).not.toBeVisible();
        await expect(tabBadge).toHaveCount(0);

        report(beta.pane, 'blocked');
        await expect(partBadge).toHaveText('1', { timeout: 10_000 });
        await expect(partBadge).toHaveAttribute('title', '1 agent needs you');
        await expect(tabBadge).toHaveText('1');

        report(src.pane, 'working');
        report(src.pane, 'idle');
        await expect(partBadge).toHaveText('2', { timeout: 10_000 });
        await expect(partBadge).toHaveAttribute('title', '2 agents need you');
        await expect(tabBadge).toHaveText('2');

        await agentRow(page, 'alpha/src').click();
        await expect(partBadge).toHaveText('1', { timeout: 10_000 });
        await expect(tabBadge).toHaveText('1');

        herdr('pane', 'release-agent', beta.pane, '--source', 'corral-e2e', '--agent', 'claude');
        await expect(partBadge).not.toBeVisible({ timeout: 10_000 });
        await expect(tabBadge).toHaveCount(0);
    } finally {
        for (const ws of created) {
            try { herdr('workspace', 'close', ws); } catch { /* already gone */ }
        }
    }
});

test('A14, A15: the Agent Timeline tab draws one lane per agent, coloured by status, and a label click focuses', async ({ page }) => {
    test.setTimeout(120_000);
    const created: string[] = [];
    try {
        const beta = workspace(join(FIXTURES, 'beta'), 'agents-beta');
        created.push(beta.ws);
        const src = workspace(join(FIXTURES, 'alpha', 'src'), 'agents-src');
        created.push(src.ws);
        herdr('workspace', 'focus', src.ws); // so clicking beta's lane has something to reveal
        report(beta.pane, 'working');

        await page.goto('/');
        await expect(agentRow(page, 'beta')).toContainText('working', { timeout: 15_000 });
        await page.locator('[data-testid="corral-projects"]').click({ position: { x: 5, y: 150 } }); // keys go to herdr while its terminal has focus
        await page.keyboard.press('F1');
        await page.keyboard.type('Toggle Agent Timeline');
        await page.keyboard.press('Enter');
        const timeline = page.locator('[data-testid="corral-agent-timeline"]');
        await expect(page.locator('.lm-TabBar-tab', { hasText: 'Agent Timeline' })).toBeVisible({ timeout: 10_000 });
        const lanes = timeline.locator('[data-testid="corral-timeline-lane"]');
        await expect(lanes).toHaveCount(1);
        await expect(lanes.first().locator('.corral-timeline-seg.corral-agent-working')).toHaveCount(1);

        report(beta.pane, 'blocked');
        await expect(lanes.first().locator('.corral-timeline-seg.corral-agent-blocked')).toHaveCount(1, { timeout: 10_000 });
        await expect(lanes.first().locator('.corral-timeline-seg.corral-agent-working')).toHaveCount(1);

        report(src.pane, 'working');
        await expect(lanes).toHaveCount(2, { timeout: 10_000 });
        await expect(lanes.first()).toContainText('beta'); // blocked sorts before working (A3)
        for (const title of await timeline.locator('.corral-timeline-seg').evaluateAll(els => els.map(e => e.getAttribute('title')))) {
            expect(title).toMatch(/^(working|blocked) \d+[smh]$/);
        }

        await expect(timeline.locator('.corral-timeline-axis span')).toHaveText(['-15m', '-10m', '-5m', 'now']);
        // A15: a label click focuses the agent. Prove it for real: herdr is not the current tab, and the pane is `done`
        // (herdr turns that into `idle` only when the pane is focused).
        herdr('workspace', 'focus', beta.ws);
        report(src.pane, 'idle');
        await expect.poll(() => herdrStatus(src.pane)).toBe('done');
        await page.keyboard.press('ControlOrMeta+p');
        await page.keyboard.type('beta readme');
        await page.locator('.quick-input-widget .monaco-list-row', { hasText: 'README.md' }).first().click();
        await expect(page.locator('.lm-TabBar-tab.lm-mod-current', { hasText: /^README\.md$/ })).toBeVisible({ timeout: 10_000 });
        const lane = timeline.locator('.corral-timeline-lane', { hasText: 'alpha/src' });
        // A15: the lane says it is clickable (pointer cursor, tooltip), and the whole row is the target, not just the text
        await expect(lane).toHaveClass(/corral-timeline-lane-focusable/);
        expect(await lane.evaluate(e => getComputedStyle(e).cursor)).toBe('pointer');
        await expect(lane.locator('.corral-timeline-label')).toHaveAttribute('title', new RegExp(`^Focus claude in herdr\\n${realpathSync(join(FIXTURES, 'alpha', 'src'))}$`));
        await lane.locator('.corral-timeline-track').click({ position: { x: 200, y: 5 } });
        await expect.poll(() => herdrStatus(src.pane), { timeout: 10_000 }).toBe('idle');
        await expect(page.locator('.lm-TabBar-tab.lm-mod-current', { hasText: /^herdr$/ })).toBeVisible({ timeout: 10_000 });

        herdr('pane', 'release-agent', src.pane, '--source', 'corral-e2e', '--agent', 'claude');
        await expect(agentRow(page, 'alpha/src')).toHaveCount(0, { timeout: 10_000 });
        await expect(lanes).toHaveCount(2); // the lane of a pane that went away stays
        await expect(lanes.filter({ hasText: 'alpha/src' })).not.toHaveClass(/corral-timeline-lane-focusable/);
        await expect(lanes.filter({ hasText: 'alpha/src' }).locator('.corral-timeline-label')).toHaveAttribute('title', /^No longer running\n/);
        await expect(lanes.first()).toContainText('beta');
    } finally {
        for (const ws of created) {
            try { herdr('workspace', 'close', ws); } catch { /* already gone */ }
        }
    }
});
