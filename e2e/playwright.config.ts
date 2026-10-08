import { defineConfig } from '@playwright/test';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

// Workers re-evaluate this file, so compute once and let them inherit through env.
process.env.CORRAL_E2E_SESSION ??= 'corral-test-e2e-' + process.pid;
if (!process.env.CORRAL_E2E_CONFIG_DIR) {
    const dir = join(mkdtempSync(join(realpathSync(tmpdir()), 'corral-e2e-')), 'corral-config');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({
        'corral.scanRoots': [resolve(__dirname, 'fixtures/projects')],
        'corral.firstRunCompleted': true,
        'corral.startupCommand': 'echo corral-e2e'
    }, undefined, 2));
    process.env.CORRAL_E2E_CONFIG_DIR = dir;
}

// A second checkout (git worktree) running E2E at the same time sets CORRAL_E2E_PORT.
const port = process.env.CORRAL_E2E_PORT ?? '3100';

export default defineConfig({
    testDir: '.',
    testMatch: '*.spec.ts',
    globalSetup: './global-setup.ts',
    globalTeardown: './global-teardown.ts',
    workers: 1,
    use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium' },
    webServer: {
        command: `npm --prefix browser-app start -- --hostname 127.0.0.1 --port ${port}`,
        cwd: '..',
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
            THEIA_CONFIG_DIR: process.env.CORRAL_E2E_CONFIG_DIR,
            CORRAL_HERDR_SESSION: process.env.CORRAL_E2E_SESSION!
        }
    }
});
