export const ISSUES_NEW_URL = 'https://github.com/dhyeys54/honjin/issues/new';

function parse(version: string): { core: number[]; pre: string[] } {
    const v = version.trim().replace(/^v/, '').split('+')[0];
    const dash = v.indexOf('-');
    const core = (dash < 0 ? v : v.slice(0, dash)).split('.').map(n => parseInt(n, 10) || 0);
    return { core, pre: dash < 0 ? [] : v.slice(dash + 1).split('.') };
}

function compareIdentifiers(a: string, b: string): number {
    const an = /^\d+$/.test(a);
    const bn = /^\d+$/.test(b);
    if (an && bn) {
        return Number(a) - Number(b);
    }
    return an ? -1 : bn ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

/** Semver precedence (spec 13 S12), including pre-release identifiers; a leading `v` is ignored. */
export function compareVersions(a: string, b: string): number {
    const x = parse(a);
    const y = parse(b);
    for (let i = 0; i < 3; i++) {
        const d = (x.core[i] ?? 0) - (y.core[i] ?? 0);
        if (d) {
            return d;
        }
    }
    if (!x.pre.length || !y.pre.length) {
        return y.pre.length - x.pre.length;
    }
    for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i++) {
        const d = compareIdentifiers(x.pre[i], y.pre[i]);
        if (d) {
            return d;
        }
    }
    return x.pre.length - y.pre.length;
}

/** S12: the update notice is for a tag newer than the running version, once per tag per window. */
export function isNewRelease(tag: string | undefined, current: string, announced: ReadonlySet<string>): tag is string {
    return tag !== undefined && !announced.has(tag) && compareVersions(tag, current) > 0;
}

export interface IssueEnv {
    honjin: string;
    macos: string;
    arch: string;
    tools: { id: string; found: boolean; version: string }[];
}

/** S11: versions only. Paths and project names stay out, so a report never leaks the user's folder layout. */
export function issueBody(env: IssueEnv): string {
    const tools = env.tools.filter(t => t.found).map(t => `- ${t.id}: ${t.version || 'unknown version'}`);
    return [
        '**What happened**', '', '', '**Steps to reproduce**', '', '',
        '**Environment**',
        `- Honjin: ${env.honjin}`,
        `- macOS: ${env.macos} (${env.arch})`,
        ...tools
    ].join('\n');
}

export function issueUrl(body: string): string {
    return `${ISSUES_NEW_URL}?${new URLSearchParams({ template: 'bug.yml', body })}`;
}
