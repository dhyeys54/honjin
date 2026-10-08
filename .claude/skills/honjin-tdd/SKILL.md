---
name: honjin-tdd
description: How to write Honjin's tests. Covers choosing the layer (unit / integration against real herdr / Playwright E2E), the herdr test harness, E2E fixtures, and red-green-refactor rules. Use whenever you write or fix a test in this repo.
---

# Honjin TDD

The authoritative rules are in `docs/specs/08-testing.md`. This skill is the working guide.

## Pick the layer

| The behaviour is… | Layer | File |
|---|---|---|
| A pure rule (lists, paths, commands, placement) | Unit | `src/common/<x>.test.ts` |
| How we call herdr (argv, error mapping), with a fake `execFileFn` | Unit | `src/node/<x>.test.ts` |
| That herdr really does what we assume | Integration | `src/node/<x>.int.test.ts` |
| Stores (read/write JSON files) | Unit (temp dir) | `src/node/<x>.test.ts` |
| File system scanning | Integration (temp dirs) | `src/node/<x>.int.test.ts` |
| Anything the user sees or clicks | E2E | `e2e/<flow>.spec.ts` |

Prefer the lowest layer that can prove the behaviour. Add one E2E test per user-visible flow, not per edge case;
edge cases belong in unit tests.

## Red-green-refactor rules

1. Write the test first. Watch it fail for the **expected reason** (the assertion, or a missing export), not a
   config or syntax error.
2. Make it pass with the minimum code, then refactor with it green.
3. One behaviour per `it`. Name it as a sentence about behaviour: `it('creates exactly one workspace for concurrent clicks')`.
4. Fake only boundaries we own: the `exec` function passed to `HerdrCli`, and temp dirs for the fs. Never mock
   Theia internals; cover them with E2E.
5. A bug fix starts with a failing test that reproduces it.

## Unit test patterns

```ts
// Fake execFileFn for HerdrCli: records argv, returns scripted results.
const calls: string[][] = [];
const execFileFn: ExecFileFn = async (file, args) => {
    calls.push([file, ...args]);
    return { stdout: JSON.stringify({ id: 'x', result: { /* … */ } }), stderr: '', exitCode: 0 };
};
const cli = new HerdrCli({ binary: 'herdr', session: 'honjin-test-x' }, execFileFn);
await cli.createTab('w1', '/tmp/a b', 'a b');
expect(calls[0]).toEqual(['herdr', '--session', 'honjin-test-x', 'tab', 'create',
    '--workspace', 'w1', '--cwd', '/tmp/a b', '--label', 'a b', '--focus']);
```

To test the per-project serialisation, give the fake `execFileFn` a deferred promise, fire two `openTab` calls, resolve,
and assert `workspace create` was called exactly once.

## Integration: the real herdr harness

```ts
import { startHerdr } from '../../test/herdr-harness';
let h: Awaited<ReturnType<typeof startHerdr>>;
beforeAll(async () => { h = await startHerdr(); }, 20_000);
afterAll(async () => { await h?.stop(); });
```

- The session is always `honjin-test-*`. The harness refuses anything else. **Never** point a test at the default
  session.
- Assert herdr state through JSON (`workspace list`, `pane list`, `pane read <id> --source recent-unwrapped`), not
  timing. When waiting, poll with a deadline (for example 5s at 100ms), never a bare `sleep`.
- If herdr isn't installed, the harness skips with a loud message. Don't fake herdr in `*.int.test.ts`.
- Afterwards `herdr session list` must show no leftover `honjin-test-*`. If one is there, fix the teardown.

## E2E (Playwright)

- `npm run test:e2e` starts the browser-app with an isolated `THEIA_CONFIG_DIR` and `HONJIN_HERDR_SESSION`
  (globalSetup starts the headless session; globalTeardown stops it).
- Fixture projects are in `e2e/fixtures/projects/{alpha,beta,.hidden}`. Tests that create files must clean up in
  `afterEach`.
- Use stable locators: `getByTestId('honjin-projects')`, `getByRole('treeitem', { name: 'alpha' })`,
  `getByTestId('honjin-new-tab')`. Add a `data-testid` rather than using a CSS path.
- Check herdr side effects with the herdr CLI in the test session (a small helper `herdrJson(args)` in
  `e2e/helpers.ts`).
- Open files and check placement by asserting the editor tab's parent tab bar doesn't contain the `herdr` tab.
- Rebuild before E2E when the extension changed: `npm run build:browser`.

## Done means

The task's Verify block is green, typecheck and lint are clean, and no herdr test sessions are left over.
