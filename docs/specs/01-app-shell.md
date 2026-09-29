# 01 — App shell (Theia composition)

## Scaffold

Generate with the official generator: `generator-theia-extension` 0.1.49 (or newer) and Theia **1.76.x**.
The generator uses npm workspaces, lerna and jest, and bundles with esbuild (Theia ≥ 1.75).

```bash
cd "$(mktemp -d)" && npx -y -p yo -p generator-theia-extension -- \
  yo theia-extension corral-core --extensionType empty --author "Corral" --license MIT --skip-install
```

Copy the output into the repo root without overwriting `README.md` or `.gitignore`: append the generated
gitignore lines instead. Delete the generator's VS Code `launch.json` unless you want it.

## Packages

`corral-core` is the only extension. Its `package.json` declares both entry points:

```json
"theiaExtensions": [{
  "frontend": "lib/browser/corral-frontend-module",
  "backend": "lib/node/corral-backend-module"
}]
```

Both `browser-app` and `electron-app` depend on the same package list, pinned to the **same exact Theia
version**:

| Group | Packages |
|---|---|
| Generator defaults | `@theia/core editor filesystem markers messages monaco navigator preferences process terminal workspace` |
| Left panel | `@theia/search-in-workspace` `@theia/debug` (plus `@theia/scm` `@theia/scm-extra`, whose view opens on demand on the right, spec 02) |
| VS Code extension host (LSP, git, debug adapters) | `@theia/plugin-ext` `@theia/plugin-ext-vscode` `@theia/vsx-registry` |
| Nice-to-have core | `@theia/keymaps` `@theia/outline-view` `@theia/output` `@theia/getting-started` (then hidden, spec 06) |
| AI (not shipped in v1, DECISIONS D9) | none: `@theia/ai-core` `@theia/ai-chat` `@theia/ai-chat-ui` are left out |
| Electron only | `@theia/electron` |

**Built-in VS Code extensions.** Add a `theiaPlugins` map to both app `package.json`s, plus a root script
`download:plugins` that runs `theia download:plugins --rate-limit 15 --parallel false`. Plugins are downloaded into
`plugins/`. Copy the list from the Theia IDE's `applications/electron/package.json` (repo `eclipse-theia/theia-ide`),
keeping at least: git, git-base, typescript-language-features, json, json-language-features, markdown,
markdown-language-features, css, html, npm, emmet, theme-defaults, `ms-vscode.js-debug`, and the basic
language grammars (`vscode.*` syntax packages). The extensions view uses the Open VSX registry by default; keep
that.

## Application config (both app `package.json`s)

```json
"theia": {
  "target": "electron",            // "browser" in browser-app
  "frontend": { "config": {
    "applicationName": "Corral",
    "defaultTheme": { "light": "corral-dark", "dark": "corral-dark" },
    "defaultIconTheme": "theia-file-icons",
    "preferences": {
      "editor.enablePreview": true,
      "terminal.integrated.enablePersistentSessions": false
    }
  }},
  "backend": { "config": { "configurationFolder": ".corral" } }
}
```

- Both apps also set `files.watcherExclude` to Theia's two `.git` defaults plus `node_modules`, `dist`, `build`,
  `out`, `.next`, `.nuxt`, `.turbo`, `.cache`, `coverage`, `.venv`, `__pycache__` and `target` (D33). The frontend
  config replaces the default object whole, so the `.git` entries must stay in the list.
- Until task T3.1 registers the `corral-dark` theme, use `"dark"` for `defaultTheme`.
- Check every preference key in this block against the installed packages (search `node_modules/@theia/**/lib/**/*preferences*.js`
  for the key). If a key was renamed, use the new name and record it in `DECISIONS.md`.
- The browser-app favicon comes from `branding/generated/favicon.*`. Copy it via the browser-app `resources` /
  `theia.frontend.config` mechanism that exists in 1.76. Check how the Theia IDE's browser app does it.

## Theia AI stays off
- Theia 1.76 has no working `enableAI` switch (`@theia/ai-core` always turns AI on), so Corral does not install the
  AI packages at all (DECISIONS D9). No AI views may appear in the default layout.
  the default layout.
- E2E test `e2e/ai-disabled.spec.ts`: a fresh start shows no chat/AI view in any panel.

## Other shell behaviour

- The window title is `Corral — <focused project name>`. The focused project is the one owning the active editor,
  or the last project whose **+** was clicked.
- On startup Corral always opens its managed workspace `<configDir>/corral.code-workspace` (`~/.corral/` in normal use). If Theia restored a
  different workspace, Corral switches to the managed one once, during startup (spec 03 §Roots sync).
- `@theia/getting-started` stays installed, but its welcome page must not open on startup (preference
  `workbench.startupEditor: "none"`).
