import { defineConfig } from '@playwright/test';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { FAKE_CLAUDE } from './fake-agents';

// Workers re-evaluate this file, so compute once and let them inherit through env.
process.env.HONJIN_E2E_SESSION ??= 'honjin-test-e2e-' + process.pid;
if (!process.env.HONJIN_E2E_CONFIG_DIR) {
    const dir = join(mkdtempSync(join(realpathSync(tmpdir()), 'honjin-e2e-')), 'honjin-config');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({
        'honjin.scanRoots': [resolve(__dirname, 'fixtures/projects')],
        'honjin.firstRunCompleted': true,
        'honjin.agentCommands': { claude: 'echo honjin-e2e', codex: 'echo honjin-e2e-codex' }
    }, undefined, 2));
    process.env.HONJIN_E2E_CONFIG_DIR = dir;
}

// Spec 13 S2: the backend searches only this dir for agents. A fake claude makes every suite "ready"; setup.spec removes it.
if (!process.env.HONJIN_TEST_PATH) {
    const bin = mkdtempSync(join(realpathSync(tmpdir()), 'honjin-e2e-bin-'));
    writeFileSync(join(bin, 'claude'), FAKE_CLAUDE, { mode: 0o755 });
    process.env.HONJIN_TEST_PATH = bin;
}

// A second checkout (git worktree) running E2E at the same time sets HONJIN_E2E_PORT.
const port = process.env.HONJIN_E2E_PORT ?? '3100';

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
            THEIA_CONFIG_DIR: process.env.HONJIN_E2E_CONFIG_DIR,
            HONJIN_HERDR_SESSION: process.env.HONJIN_E2E_SESSION!,
            HONJIN_TEST_PATH: process.env.HONJIN_TEST_PATH
        }
    }
});
