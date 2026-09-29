---
name: next-task
description: Do exactly one task from docs/PLAN.md, the first unchecked one, using red-green-refactor TDD. Then verify, tick it, log it and commit. Use when the user says "next task", "continue the plan", "build Corral", or runs /next-task (or /loop /next-task).
---

# /next-task

One task per run. Never start a second task in the same run.

## 0. Orient (every run, and keep it cheap)

1. `git status --short`.
   - If the repo has no commits yet (`git rev-parse HEAD` fails), this is the untouched workflow scaffold. Commit it
     as-is: `git add -A && git commit -m "chore: agent workflow scaffold (specs, plan, skills, branding)"`.
   - Otherwise, if there are uncommitted changes you didn't just make, **stop** and report them. Don't stash or
     discard someone else's work.
2. Open `docs/PLAN.md` and find the **first** line matching `- [ ]` or `- [!]`.
   - `- [!]` (blocked): stop. Print the block note and ask the user how to proceed.
   - None left: print "Plan complete" and stop. When running under `/loop`, end the loop.
3. Read the task's block and **every spec section it cites**. Read `AGENTS.md` §Hard rules if this is your first
   task in the session.

## 1. Gate tasks (G0–G4)

Run the steps written in the task. For the review step, launch the `spec-reviewer` agent with the stage number.
Fix each **must-fix** finding as a separate commit (`G<n>: fix <finding>`). When a gate says **human
checkpoint**: print the run instructions and questions from the gate text, **leave the box unticked, and stop**.
Only the user's approval ticks a gate that has a human checkpoint (the user ticks it, or tells you to). A gate
without one (G0) you tick yourself once its must-fix findings are fixed. When stopping under `/loop`, end the loop.

## 2. Red

- Write the tests the task's **Tests first** line lists. Put them where spec 08 says; load the `corral-tdd` skill
  for patterns and the herdr harness.
- Run just those tests. They must **fail, and for the expected reason** (a missing module or function, or a wrong
  value). A syntax or config error doesn't count as red. Fix the test setup until the failure is meaningful.

## 3. Green

- Implement the minimum that makes the tests pass. Keep logic in `src/common/`; widgets only wire things.
- Touching Theia APIs → load the `theia-dev` skill and **check signatures in `node_modules/@theia/**/lib/*.d.ts`**
  (or Context7) before writing calls. Touching herdr → load `herdr-integration`.
- Run the tests until they're green.

## 4. Refactor and verify

- Remove duplication and unclear names, with the tests kept green.
- Run the task's **Verify** block exactly as written, plus `npm run typecheck && npm run lint` (once they exist,
  from T0.2 on).
- For E2E tasks, check that no `corral-test-*` herdr sessions are left: `herdr session list`.
- If the task changes UI, look at it once: use the Playwright MCP on http://127.0.0.1:3000 or an E2E screenshot.
  Don't loop on cosmetics before stage 3.

## 5. Record and commit

1. In `docs/PLAN.md`, change the task's `- [ ]` to `- [x]`.
2. Append to the Progress log: `- <YYYY-MM-DD> T<id> — <what now works> (<n> tests)`.
3. If you had to deviate from a spec (for example a Theia API differs), update that spec and add a
   `docs/DECISIONS.md` entry. Both go in this commit.
4. `git add -A && git commit -m "T<id>: <summary>"`, ending the message with the attribution line from your system
   instructions, if any.

## Getting stuck

- A test fails and the cause isn't obvious → use the `diagnosing-bugs` skill.
- After **3 genuine attempts** at the same failure: revert partial changes that don't compile, change the task to
  `- [!]`, add an indented `  - Blocked: <what you tried, exact error, suspected cause>` line, commit
  (`T<id>: blocked`), and stop.
- Never weaken, skip or delete a test to get green. Never touch the user's live herdr session.

## Output (keep it short)

```
T<id> done · <n> tests added · verify: <commands> ✔ · commit <sha>
next: T<next-id> <title>
```
