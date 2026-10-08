# Contributing to Honjin

Honjin is in public beta. Bug reports and ideas help the most right now.

- **Something broke:** Help → Report an Issue in the app opens a pre-filled report (versions only, no paths), or use
  the [bug template](https://github.com/dhyeys54/honjin/issues/new?template=bug.yml).
- **Install trouble:** use the [install template](https://github.com/dhyeys54/honjin/issues/new?template=install.yml).
- **Questions and ideas:** [Discussions](https://github.com/dhyeys54/honjin/discussions), or the
  [idea template](https://github.com/dhyeys54/honjin/issues/new?template=idea.yml).

## Code changes

Open an issue first for anything bigger than a small fix, so we agree before you spend time.

1. `npm install`, then `npm test`, `npm run typecheck` and `npm run lint` must pass. `npm run test:int` needs
   [herdr](https://github.com/ogulcancelik/herdr); `npm run test:e2e` builds and drives the browser app.
2. Behaviour is defined by `docs/specs/*.md`. A change to behaviour updates the spec in the same commit and adds an
   entry to `docs/DECISIONS.md`.
3. Write the test first. Keep logic in `honjin-core/src/common/` so it can be unit-tested; widgets only wire.
4. TypeScript strict, 4-space indent, single quotes, comments that say why.

`AGENTS.md` has the full working rules, which apply to people as well as coding agents.

By contributing you agree your work is released under the MIT licence in `LICENSE`.
