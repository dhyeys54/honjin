import { injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
// lib/ has no assets; like herdr.css this is read from src/.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- esbuild's dataurl loader has no default export, so `import x from` would be undefined
import faviconUrl = require('../../src/browser/style/favicon.svg');

/** Theia's generated index.html has no icon link, so the Corral favicon is added at startup. */
@injectable()
export class FaviconContribution implements FrontendApplicationContribution {

    initialize(): void {
        const link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.head.appendChild(document.createElement('link'));
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = faviconUrl;
    }
}
