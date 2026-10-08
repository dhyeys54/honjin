---
name: honjin-polish
description: Stage 3 design workflow for Honjin. It builds the Honjin Dark theme, typography and chrome polish, driven by the impeccable skill with a taste pre-flight, in bounded rounds. Use for plan tasks T3.1–T3.4 or any request to make Honjin look better.
---

# Honjin polish

Inputs: `PRODUCT.md` and `DESIGN.md` (repo root; impeccable reads both), spec 06, and the running browser-app.
The owner's brief is binding: **dark, developer, terminal feel**, quiet chrome, and a phosphor-green accent from
the icon.

## Phase 1: Theme foundation (T3.1)

1. Load `impeccable` and run its setup (`node <impeccable-base>/scripts/context.mjs`). Use the `typeset` and
   `colorize` playbooks as references, but **don't replace** DESIGN.md's world; this is refinement.
2. Build `honjin-dark-color-theme.json` from the DESIGN.md tokens, and `common/design-tokens.ts` mirroring the
   frontmatter (a test keeps them in sync; spec 06).
3. Bundle JetBrains Mono woff2 plus `OFL.txt`; set the font defaults.

## Phase 2: Critique round (T3.2)

1. Start the app with `npm run build:browser && HONJIN_HERDR_SESSION=honjin-test-polish npm run start:browser`,
   after starting that session headless as in the herdr-integration skill. Open 3 fixture projects and 2 herdr tabs.
2. With the Playwright MCP, take screenshots at 1440×900 and 1920×1200: the whole window, the Projects view on
   hover over a folder (`+` visible), a selected row, the herdr pane, quick open, and a notification.
3. Run `impeccable critique` on those screenshots plus `src/browser/style/`. Also check DESIGN.md's
   Do's/Don'ts and the craft floor. Write the findings to `docs/screenshots/critique-<date>.md`.

## Phase 3: One fix batch and one confirmation (T3.2)

1. Fix **all** findings in one batch. Any token change goes into DESIGN.md first, then the theme and CSS.
2. Take one confirmation round of screenshots and fix what's left. **Stop there.** The impeccable rule is bounded
   passes, not a polish loop.
3. Commit the before/after screenshots in `docs/screenshots/`.

## Phase 4: README presentation (T3.4)

- Apply `design-taste-frontend`'s brief inference and pre-flight check to the README hero shot and the icon
  presentation (crop, framing, no fake data). Its scope excludes dense product UI, so it doesn't restyle the IDE
  chrome.

## Guardrails

- The E2E suite must stay green after every batch. Styling must not change `data-testid`s or the DOM that tests
  use.
- Contrast is at least AA (DESIGN.md lists the measured ratios). Keyboard focus stays visible everywhere.
- No new colours outside the DESIGN.md frontmatter; no gradients or glow in the chrome, and no shadows except the one DESIGN.md §Elevation allows
  for detached overlays.
