import { expect, Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdtempSync, realpathSync, renameSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export const settingsFile = () => join(process.env.HONJIN_E2E_CONFIG_DIR!, 'settings.json');

/** Replaces the file (as editors do) so the watcher sees a change even when the inode would stay the same. */
export function writeSettings(value: object | string): void {
    const tmp = settingsFile() + '.tmp';
    writeFileSync(tmp, typeof value === 'string' ? value : JSON.stringify(value));
    renameSync(tmp, settingsFile());
}

export const projects = (page: Page) => page.locator('[data-testid="honjin-projects"]');
/** The Projects row whose whole label is `name`. */
export const row = (page: Page, name: string) => projects(page).locator('.theia-TreeNode', { hasText: new RegExp(`^${name}$`) });

/** Theia's context menu ignores Escape here; a click outside it closes it, as Lumino menus do. */
export async function closeMenu(page: Page): Promise<void> {
    await page.locator('#theia-statusBar').click({ position: { x: 1, y: 1 } });
    await expect(page.locator('.lm-Menu:visible')).toHaveCount(0);
}

export const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd });

/** The E2E herdr session, never the user's own. */
export const session = () => process.env.HONJIN_E2E_SESSION!;
export const herdr = (...args: string[]) => execFileSync('herdr', ['--session', session(), ...args], { encoding: 'utf8' });

/** A new directory under the resolved temp dir: macOS tmpdir is a symlink, and git and herdr report real paths. */
export const tempDir = (prefix: string) => mkdtempSync(join(realpathSync(tmpdir()), prefix));
