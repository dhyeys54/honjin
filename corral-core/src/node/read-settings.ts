import { promises as fs } from 'fs';
import { join } from 'path';
import { parse } from 'jsonc-parser';

/** Theia's `settings.json` is JSONC: comments and trailing commas are normal there and must not drop the herdr settings. */
export async function readSettings(configDir: string): Promise<Record<string, unknown>> {
    let text: string;
    try {
        text = await fs.readFile(join(configDir, 'settings.json'), 'utf8');
    } catch {
        return {};
    }
    const parsed = parse(text, undefined, { allowTrailingComma: true });
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}
