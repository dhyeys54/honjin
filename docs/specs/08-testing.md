# 08 — Testing strategy (TDD)

Every task in `PLAN.md` names its tests. Write them **first** and watch them fail, then implement.

## Layers

| Layer | Runner | Location / pattern | Scope | Command |
|---|---|---|---|---|
| Unit | Jest + ts-jest (node env; jsdom for widget render tests) | `honjin-core/src/**/*.test.ts` | `common/` logic, `HerdrCli` argv/parsing with a fake `execFileFn`, stores with a temp dir, React render of small widget parts | `npm test` |
| Integration | Jest (node), serial | `honjin-core/{src,test}/**/*.int.test.ts` | `HerdrCli` + `HonjinHerdrService` + `HonjinResourceServiceImpl` against a **real headless herdr session**; `ProjectScanner` against real temp dirs | `npm run test:int` |
| E2E | Playwright + `@theia/playwright` (same version as Theia) | `e2e/*.spec.ts` | Browser-app flows: layout, projects tree, changes view (`changes-view.spec.ts`), resource monitor (`resource-monitor.spec.ts`), + → herdr tab, settings, AI disabled | `npm run test:e2e` |
| Plugin | Node built-in runner (`node --test`), no dependencies | `herdr-plugin/test/*.test.js` | The herdr plugin (spec 11) against `fake-herdr.js` and `fake-ps.js`; never a real session | `npm run test:plugin` |

The layout on disk: the Jest config lives at `honjin-core/test/jest.config.ts` (modelled on the generator's widget
template: `ts-jest`, `setupFiles` defines `global.DragEvent`, plus `moduleNameMapper` for `vscode-languageserver-types`
and `msgpackr`). Unit tests use `testPathIgnorePatterns` for `.int.test.ts`; integration uses a second project or
config with `testMatch: ['**/*.int.test.ts']` and `maxWorkers: 1`.

## The herdr test harness: `honjin-core/test/herdr-harness.ts`

```ts
export async function startHerdr(opts?: { session?: string }): Promise<{ session: string; cli: HerdrCli; stop(): Promise<void> }>;
```
- Session name: `opts.session`, or `honjin-test-<pid>-<random4>`. **It must match `/^honjin-test-/`.** The harness throws on any
  other name, so the user's live session can never be targeted.
- Start with `spawn(herdrBinary, ['--session', s, 'server'], { detached: false, stdio: 'ignore' })`. Poll
  `herdr --session s status server --json` every 100ms until `running: true` (10s timeout). If that session's server is already running (for example the
  E2E app's herdr widget started it first), reuse it instead of spawning; `stop()` still stops and deletes it.
- `stop()` runs `herdr --session s server stop`, then `herdr session delete s`, and kills the child if it is still
  alive. Call it in `afterAll`, and also register it for `process.on('exit')`.
- If herdr isn't installed, integration tests are **skipped with a loud message**, not failed. CI is out of scope.

## E2E setup: `e2e/playwright.config.ts`

- `webServer`: `npm --prefix browser-app start -- --hostname 127.0.0.1 --port 3100`, with env: (3100, not 3000, so E2E never collides with a dev server; DECISIONS D8)
  - `THEIA_CONFIG_DIR=<tmp>/honjin-config`, a fresh config folder per run (check the env var name that
    `@theia/core` backend reads in 1.76; `BackendApplicationConfigProvider` / `environment`).
  - `HONJIN_HERDR_SESSION`: the config computes the name **once** with
    `process.env.HONJIN_E2E_SESSION ??= 'honjin-test-e2e-' + process.pid` (workers re-evaluate the config, so they
    must inherit it from env). `globalSetup` runs `startHerdr({ session })` and `globalTeardown` stops it. Playwright
    may start `webServer` before `globalSetup`; the harness's reuse rule makes the order irrelevant.
- The fixture scan root is `e2e/fixtures/projects/` containing `alpha/` (with `src/index.ts`), `beta/` and `.hidden/`.
  Seed `<configDir>/settings.json` with `honjin.scanRoots` and `honjin.firstRunCompleted: true`.
- Use the `@theia/playwright` page objects (`TheiaApp`, `TheiaWorkspace`, `TheiaTerminal`) where they fit, and
  plain Playwright locators for Honjin's own DOM. Give Honjin elements stable `data-testid`s (`honjin-projects`,
  `honjin-project-root`, `honjin-new-tab`).
- Assert herdr side effects through the herdr CLI in the test session (for example: after clicking **+** on
  `alpha/src`, `workspace list` has a workspace labelled `alpha` and `pane list` has a pane with cwd `…/alpha/src`),
  not through terminal pixels.

## Conventions

- Test names state the behaviour: `it('reuses the mapped workspace when it still exists')`.
- One behaviour per test. Build data with small factory functions; no shared mutable fixtures.
- Fake only at boundaries you own (the injected `execFileFn`, the file system in a temp dir). Never mock Theia internals
  to make a test pass; test through them in E2E instead.
- A bug fix starts with a failing test that reproduces it.
