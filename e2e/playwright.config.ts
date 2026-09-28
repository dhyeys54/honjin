import { defineConfig } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

// Workers re-evaluate this file, so compute once and let them inherit through env.
process.env.CORRAL_E2E_SESSION ??= 'corral-test-e2e-' + process.pid;
if (!process.env.CORRAL_E2E_CONFIG_DIR) {
    const dir = join(mkdtempSync(join(tmpdir(), 'corral-e2e-')), 'corral-config');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({
        'corral.scanRoots': [resolve(__dirname, 'fixtures/projects')],
        'corral.firstRunCompleted': true
    }, undefined, 2));
    process.env.CORRAL_E2E_CONFIG_DIR = dir;
}

export default defineConfig({
    testDir: '.',
    testMatch: '*.spec.ts',
    globalSetup: './global-setup.ts',
    globalTeardown: './global-teardown.ts',
    workers: 1,
    use: { baseURL: 'http://127.0.0.1:3100', browserName: 'chromium' },
    webServer: {
        command: 'npm --prefix browser-app start -- --hostname 127.0.0.1 --port 3100',
        cwd: '..',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
            THEIA_CONFIG_DIR: process.env.CORRAL_E2E_CONFIG_DIR,
            CORRAL_HERDR_SESSION: process.env.CORRAL_E2E_SESSION!
        }
    }
});
