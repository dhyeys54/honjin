---
name: herdr-integration
description: The contract between Honjin and the herdr CLI. Covers commands, JSON shapes, errors, sessions, workspace mapping and safety rules. Use whenever code calls herdr, parses its output, or a test depends on herdr behaviour.
---

# herdr integration

The spec is `docs/specs/04-herdr-integration.md` (facts verified against herdr 0.9.1, protocol 22). Read it before
changing `HerdrCli`, `HonjinHerdrService` or the terminal widget.

## Discover syntax safely

- `herdr <group>` with no subcommand prints usage for `workspace | tab | pane | agent | session | server`.
- Never probe a **mutating** command by leaving out its arguments. `herdr workspace create` with no args
  *creates a workspace*.
- Never run bare `herdr` to discover commands; it attaches the TUI.
- `herdr --skill` prints herdr's own guide for agents (IDs, `--current`, agent commands).
- Check the installed version with `herdr status server --json` (`version`, `protocol`). If it isn't 0.9.x /
  protocol 22, run `npm run test:int` before trusting the spec.

## Always

- Use `execFile(binary, [...sessionArgs, ...args])`. **Never use a shell string.** Paths are single argv entries.
- Put `--session <name>` first when a session is set (`herdr --session s workspace list`).
- Read IDs from the JSON response; never predict them. IDs are opaque and never reused.
- Stdout JSON means success. Stderr JSON with exit 1 means a server error, so use `error.code`. Exit 2 means a CLI
  usage error.

## Never

- Never stop, restart or delete the **default** session, or any session not named `honjin-test-*`.
- Never close workspaces, tabs or panes Honjin didn't create. "Remove from herdr mapping" only forgets the link.
- Never adopt a workspace by matching its label (DECISIONS D3).
- Never send keystrokes to panes Honjin didn't create.

## Common recipes (test session `S`)

```bash
herdr --session S server &                                   # headless server (the harness does this)
herdr --session S status server --json                       # {"running":true,...}
herdr --session S workspace create --cwd "$P" --label alpha --no-focus
herdr --session S tab create --workspace w1 --cwd "$P/src" --label src --focus
herdr --session S workspace focus w1
herdr --session S pane run w1:p2 'claude'
herdr --session S pane read w1:p2 --source recent-unwrapped --lines 40
herdr --session S pane list                                  # includes cwd per pane
herdr --session S server stop && herdr session delete S
```

## Terminal widget facts

- The widget runs the herdr binary with `['--session', S]` or no args. herdr starts its server if needed and
  attaches the TUI.
- Detaching (prefix `ctrl+b`, then the detach key) exits the client process. The server and agents keep running.
  The widget shows its Reattach overlay.
- Agents inside panes get `HERDR_ENV=1` and `HERDR_PANE_ID`/`HERDR_WORKSPACE_ID`. Honjin's backend runs outside
  herdr and must not rely on these.
