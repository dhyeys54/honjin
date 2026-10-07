import {
    ProcRow, Runaway, RUNAWAY_MS, entryLevel, formatBytes, formatEntry, formatNotice, formatRunawayLine, memLevel, notifyStep, percentSetting, resourceIntervalMs, parsePs, subtree, summarize, trackRunaways
} from './resource-usage';

const row = (pid: number, ppid: number, extra: Partial<ProcRow> = {}): ProcRow => ({ pid, ppid, rssKb: 1024, cpu: 0, command: 'x', ...extra });
const runaway = (pid: number): Runaway => ({ pid, command: 'x', cpu: 95, sinceMs: RUNAWAY_MS });
const GiB = 1024 ** 3;

describe('resource usage', () => {
    it('R3: parsePs reads numbers, keeps spaces in the command and skips bad lines', () => {
        const out = '  12    1  2048  3.5 /bin/zsh\n  13   12  1024 97.0 Corral Helper (Renderer)\n\ngarbage\n1 2 x 4 y\n';
        expect(parsePs(out)).toEqual([
            { pid: 12, ppid: 1, rssKb: 2048, cpu: 3.5, command: '/bin/zsh' },
            { pid: 13, ppid: 12, rssKb: 1024, cpu: 97, command: 'Corral Helper (Renderer)' }
        ]);
    });

    it('subtree: a root and all its descendants; an absent root gives nothing', () => {
        const rows = [row(1, 0), row(2, 1), row(3, 2), row(4, 1), row(9, 8)];
        expect([...subtree(rows, 1)].sort()).toEqual([1, 2, 3, 4]);
        expect(subtree(rows, 77).size).toBe(0);
    });

    it('R4: summarize sums rss in bytes, divides cpu by cores and ignores pids outside the set', () => {
        const rows = [row(1, 0, { rssKb: 1024, cpu: 50 }), row(2, 1, { rssKb: 2048, cpu: 30 }), row(3, 1, { rssKb: 999, cpu: 99 })];
        expect(summarize(rows, new Set([1, 2]), 10)).toEqual({ memBytes: 3_145_728, cpuPct: 8, count: 2 });
    });

    it('R5: memLevel switches at the limits, and danger never comes before warning', () => {
        expect(['499', '500', '749', '750'].map(n => memLevel(+n, 1000, 50, 75))).toEqual(['normal', 'warning', 'warning', 'danger']);
        expect([499, 500].map(n => memLevel(n, 1000, 50, 40))).toEqual(['normal', 'danger']);
    });

    describe('R6: trackRunaways', () => {
        const now = 1_000_000;
        const scope = new Set([1, 2]);
        const hot = (pid: number, cpu = 95) => row(pid, 0, { cpu, command: '/usr/bin/ruby-lsp' });

        it('a pid hot for exactly 300 000 ms is a runaway; one ms less is not, but stays tracked', () => {
            const a = trackRunaways(new Map([[1, 700_000]]), [hot(1)], scope, now);
            expect(a.runaways).toEqual([{ pid: 1, command: 'ruby-lsp', cpu: 95, sinceMs: 300_000 }]);
            const b = trackRunaways(new Map([[1, 700_001]]), [hot(1)], scope, now);
            expect(b.runaways).toEqual([]);
            expect(b.hotSince.get(1)).toBe(700_001);
        });

        it('a first-time hot pid is stored with now', () => {
            expect(trackRunaways(new Map(), [hot(1)], scope, now).hotSince.get(1)).toBe(now);
        });

        it('a pid that cooled down, left the scope, or vanished is dropped', () => {
            const before = new Map([[1, 0], [3, 0], [2, 0]]);
            const out = trackRunaways(before, [hot(1, 89.9), hot(3)], scope, now);
            expect([...out.hotSince.keys()]).toEqual([]);
            expect(out.runaways).toEqual([]);
        });
    });

    it('R7: entryLevel takes the worse of memory and runaways; cpu alone never counts', () => {
        expect(entryLevel('normal', [runaway(1)])).toBe('warning');
        expect(entryLevel('danger', [runaway(1)])).toBe('danger');
        expect(entryLevel('warning', [])).toBe('warning');
        expect(entryLevel('normal', [])).toBe('normal');
    });

    describe('R8: notifyStep', () => {
        it('armed + danger notifies once and disarms', () => {
            expect(notifyStep(true, 'danger', [], [])).toEqual({ notify: 'danger', armed: false });
            expect(notifyStep(false, 'danger', [], [])).toEqual({ notify: undefined, armed: false });
        });

        it('re-arms only at normal with no runaways, and does not notify on that tick', () => {
            expect(notifyStep(false, 'warning', [], [])).toEqual({ notify: undefined, armed: false });
            expect(notifyStep(false, 'normal', [runaway(1)], [1])).toEqual({ notify: undefined, armed: false });
            expect(notifyStep(false, 'normal', [], [])).toEqual({ notify: undefined, armed: true });
        });

        it('notifies a runaway that is new, not one already seen', () => {
            const r = runaway(7);
            expect(notifyStep(true, 'normal', [r], [])).toEqual({ notify: r, armed: false });
            expect(notifyStep(true, 'normal', [r], [7])).toEqual({ notify: undefined, armed: true });
        });

        it('danger wins over a new runaway', () => {
            expect(notifyStep(true, 'danger', [runaway(7)], [])).toEqual({ notify: 'danger', armed: false });
        });
    });

    it('R9: formatBytes and formatEntry', () => {
        expect(formatBytes(500 * 1024 ** 2)).toBe('500 MB');
        expect(formatBytes(GiB * 1.44)).toBe('1.4 GB');
        expect(formatBytes(GiB)).toBe('1.0 GB');
        expect(formatEntry({ memBytes: GiB * 1.44, cpuPct: 11.6, count: 38 })).toBe('$(pulse) 1.4 GB · 12% · 38');
    });
});

describe('R12 setting clamps', () => {
    it('resourceIntervalMs: at least 1 s, 5 s when not a number', () => {
        const cases: [unknown, number][] = [[5, 5000], [2.5, 2500], [1, 1000], [0, 1000], [-3, 1000],
            [undefined, 5000], ['abc', 5000], ['7', 5000], [NaN, 5000], [Infinity, 5000], [null, 5000]];
        for (const [value, ms] of cases) {
            expect(resourceIntervalMs(value)).toBe(ms);
        }
    });

    it('percentSetting: clamped to 1-100, the default when not a number', () => {
        const cases: [unknown, number][] = [[50, 50], [1, 1], [100, 100], [0, 1], [-5, 1], [250, 100], [33.5, 33.5],
            [undefined, 75], ['abc', 75], [NaN, 75], [Infinity, 75]];
        for (const [value, pct] of cases) {
            expect(percentSetting(value, 75)).toBe(pct);
        }
    });
});

describe('R8/R10 texts', () => {
    const r: Runaway = { pid: 42, command: 'node', cpu: 96.4, sinceMs: 5.6 * 60_000 };

    it('R8: the notification rounds the minutes, the percentage of RAM too', () => {
        expect(formatNotice(r, { memBytes: 0, totalMemBytes: 1 })).toBe('node (pid 42) has used a full CPU core for 6 min.');
        expect(formatNotice('danger', { memBytes: GiB * 1.44, totalMemBytes: GiB * 2 })).toBe('Corral is using 1.4 GB (72% of RAM).');
    });

    it('R10: the tooltip line floors the minutes', () => {
        expect(formatRunawayLine(r)).toBe('⚠ node — 96% of a core for 5 min');
    });
});
