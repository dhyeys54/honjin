# 06 — Theme and branding

The design tokens, type and rationale live in `/DESIGN.md`; this spec covers how they get into Theia.

## Honjin Dark theme

- A VS Code-format color theme JSON at `honjin-core/src/browser/theme/honjin-dark-color-theme.json`, with
  `uiTheme: 'vs-dark'`. It is registered from the frontend at startup with id `honjin-dark`, label "Honjin Dark".
  Use `MonacoThemingService.register(...)` or the 1.76 equivalent; check `@theia/monaco/lib/browser/monaco-theming-service.d.ts`.
- It must define workbench colours (`editor.*`, `sideBar.*`, `activityBar.*`, `tab.*`, `panel.*`,
  `terminal.*` including the 16 ANSI colours, `list.*`, `focusBorder`, `button.*`, `input.*`, `statusBar.*`,
  `statusBarItem.warning*`/`error*` (the resource entry, spec 10), `titleBar.*`) and tokenColors, all from DESIGN.md tokens. DESIGN.md is the source for colours; the theme JSON and `design-tokens.ts` are derived from it;
  Honjin's CSS reads the `var(--theia-*)` variables the theme maps from it, never literals (D27).
- Set `defaultTheme` in both app configs to `honjin-dark` (spec 01).
- `common/design-tokens.ts` mirrors the DESIGN.md frontmatter `colors` map. A unit test parses DESIGN.md's
  frontmatter (plain line parsing of the `colors:` block; no YAML dependency) and asserts it equals
  `design-tokens.ts`. The theme test asserts every theme colour is a token value, optionally followed by a 2-hex
  alpha suffix.

## Typography

- UI font: JetBrains Mono, bundled as woff2 (OFL-1.1). Put the licence file next to the fonts in
  `honjin-core/src/browser/style/fonts/`. Fallbacks: `"SF Mono", Menlo, monospace`.
- Set `editor.fontFamily` / `terminal.integrated.fontFamily` defaults to the same stack. Sizes: editor 13, terminal
  11 (macOS Terminal's default, D34), UI 12. Line height is in DESIGN.md.

## Chrome styling: `honjin-core/src/browser/style/herdr.css` and `changes.css` (D27)

- Only tokens. Apply the look described in DESIGN.md: flat panels, 1px hairline borders, no shadows on panels or tabs, square tabs,
  uppercase micro-labels for view titles, and a monospace UI.
- Projects-tree specifics: row height 22px; the `+` button is 18×18 with a hit area of at least 22px, visible on
  row hover or focus-visible, and never shifts the layout. Show focus rings for keyboard users.

## Icons and branding

- Masters: `branding/icon.svg` (app) and `branding/favicon.svg` (small sizes). Generate outputs with
  `./scripts/make-icons.sh`, which writes `branding/generated/` (`honjin.icns`, PNGs, `favicon.ico`).
- Electron uses `branding/generated/honjin.icns` for the packaged app (spec 07). The dev window keeps Electron's
  icon. The browser-app gets `favicon.svg`, injected at startup (D25); there is no `.ico` fallback (D27).
- About dialog: Theia's stock dialog, which shows `applicationName` ("Honjin"). No override.
- Stage 3 runs the `honjin-polish` skill (impeccable-led) over all of this. Its findings update DESIGN.md first,
  then the code.
