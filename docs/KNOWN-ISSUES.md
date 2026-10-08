# Known issues (0.1.0-beta.1)

Things a new user can run into, with the workaround. Report anything else with **Help → Report an Issue**.

## Install and first run
- **Corral is not signed or notarised.** macOS asks you to confirm the first launch: System Settings → Privacy & Security → *Open Anyway*. The install script shows no prompt, so do not go looking for one; the downloaded zip does (DECISIONS D45).
- **Apple Silicon and macOS 13 or later only.** Intel Macs, Windows and Linux are not built.
- **Install commands for herdr and the agents come from each vendor's docs** and can go stale. If one fails in Setup, run the vendor's current command in a terminal; Setup picks the tool up on the next check.
- **herdr shows its own welcome screen on its first run** and waits for Enter once.
- **An Install button that fails** leaves its terminal open with `Failed (exit N)` and waits for Enter; Setup then re-checks. Each row's **Docs** link opens the vendor's instructions (for Gemini only when brew and npm are both missing), and **Re-check** is always there.
- **Agents sign in themselves.** The first `claude` (or other agent) launch asks for login or an API key inside its herdr tab. Corral does not handle credentials.
- **Updating:** re-run the install one-liner. There is no automatic update, only a notification.

## Using it
- **Closing Corral leaves herdr's server and its agents running** (by design, spec 04). Stop them with `herdr server stop`, or quit each agent.
- **Search can come back empty right after startup** (roughly 1 start in 3 under test). Run **Reload Window** from the command palette and search again.
- **The Projects tree shows dotfolders such as `.git`.** Theia does not hide them.
- **A file rewritten from outside once did not refresh in an open editor** (reported 2026-10-08, `today.md`, in-place rewrite, window up for hours). The cause was never found and it did not happen again in testing; `e2e/external-edit.spec.ts` guards the normal behaviour. If it happens, run **File: Revert File** from the command palette, or **Reload Window**, and tell us the time and file.
- **No Dock badge or system notifications from Corral.** herdr's own `[ui.toast]` and `[ui.sound]` settings cover that.
- **Corral never renames, stops or sends prompts to an agent.** The Agents view only focuses them.

## Security
- **`npm audit` lists two critical advisories** (`decompress`, `tar`) deep in Theia's dependency tree. Both need a malicious archive to be extracted; Corral extracts none by itself. Only install `.vsix` extensions from sources you trust (DECISIONS D55).

## Uninstall and reset
Quit Corral, then delete `/Applications/Corral.app` and `~/.corral` (settings and state). The herdr workspaces Corral made stay in herdr until you close them there.
