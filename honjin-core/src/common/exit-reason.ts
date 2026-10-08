// eslint-disable-next-line no-control-regex -- terminal output is full of control sequences by nature
const ESCAPES = /\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[@-_]/g;

/** The last readable line a process printed before exiting, e.g. herdr's own error message. */
export function exitReason(output: string): string | undefined {
    const lines = output.replace(ESCAPES, '').split(/\r?\n|\r/).map(l => l.trim()).filter(Boolean);
    return lines.pop()?.slice(0, 200);
}
