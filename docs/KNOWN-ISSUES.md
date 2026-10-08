# Known issues (0.1.0-beta.1)

Things a new user can run into, with the workaround. Report anything else with **Help → Report an Issue**.

## Install and first run
- **Corral is not signed or notarised.** macOS asks you to confirm the first launch: System Settings → Privacy & Security → *Open Anyway*. The install script avoids the prompt; the zip does not (DECISIONS D45).
- **Apple Silicon and macOS 13 or later only.** Intel Macs, Windows and Linux are not built.
- **Install commands for herdr and the agents come from each vendor's docs** and can go stale. If one fails in Setup, run the vendor's current command in a terminal; Setup picks the tool up on the next check.
- **herdr shows its own welcome screen on its first run** and waits for Enter once.

## Using it
- **Search can come back empty right after startup** (roughly 1 start in 3 under test). Reload the window (Cmd+R) and search again.
- **The Projects tree shows dotfolders such as `.git`.** Theia does not hide them.
- **A file rewritten from outside once did not refresh in an open editor** (reported 2026-10-08, `today.md`, in-place rewrite, window up for hours). The cause was never found and it did not happen again in testing; `e2e/external-edit.spec.ts` guards the normal behaviour. If it happens, File → Revert File, or reload the window, and tell us the time and file.
- **No Dock badge or system notifications from Corral.** herdr's own `[ui.toast]` and `[ui.sound]` settings cover that.
- **Corral never renames, stops or sends prompts to an agent.** The Agents view only focuses them.

## Security
- **`npm audit` lists two critical advisories** (`decompress`, `tar`) deep in Theia's dependency tree. Both need a malicious archive to be extracted; Corral extracts none by itself. Only install `.vsix` extensions from sources you trust (DECISIONS D55).
