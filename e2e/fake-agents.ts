import { writeFileSync } from 'fs';
import { join } from 'path';

export const FAKE_CLAUDE = '#!/bin/sh\necho "1.0.0 (fake claude)"\n';

/** Puts a fake agent CLI on the backend's test PATH (spec 13 S2); it only answers `--version`. */
export function fakeAgent(name: string, script = `#!/bin/sh\necho "1.0.0 (fake ${name})"\n`): string {
    const path = join(process.env.CORRAL_TEST_PATH!, name);
    writeFileSync(path, script, { mode: 0o755 });
    return path;
}
