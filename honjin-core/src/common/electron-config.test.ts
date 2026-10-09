import { readFileSync } from 'fs';
import { join } from 'path';

describe('electron-app config (D62)', () => {
    it('keeps a window\'s backend across a dropped socket, so sleep does not kill the plugin host', () => {
        const pkg = JSON.parse(readFileSync(join(__dirname, '../../../electron-app/package.json'), 'utf8'));
        expect(pkg.theia.backend.config.frontendConnectionTimeout).toBe(-1);
    });
});
