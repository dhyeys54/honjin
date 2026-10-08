# Third-party notices

Honjin's own code is MIT-licensed (see `LICENSE`). The packaged app bundles the software below under its own
licence. Every npm package in the app keeps its licence file in `node_modules/<package>/` inside the bundle.

| Component | Licence | How Honjin uses it |
|---|---|---|
| [Eclipse Theia](https://github.com/eclipse-theia/theia) and `@theia/*` packages | EPL-2.0 (with the GPL-2.0 w/ Classpath exception secondary licence) | The IDE framework Honjin is built on. Honjin modifies none of it; its source is at the link. |
| [Electron](https://github.com/electron/electron) | MIT | Runs the desktop app. |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | MIT | The text editor inside Theia. |
| [VS Code built-in extensions](https://github.com/microsoft/vscode) (`vscode-builtin-extensions`) | MIT | Syntax highlighting, git, TypeScript and similar language support, shipped in `Resources/plugins`. |
| [xterm.js](https://github.com/xtermjs/xterm.js), [node-pty](https://github.com/microsoft/node-pty) | MIT | The terminal that hosts herdr. |
| [herdr-agent-hibernate](https://github.com/dalogax/herdr-agent-hibernate) (forked as `herdr-plugin/`) | MIT, copyright its authors; the licence text is in `herdr-plugin/LICENSE` | A herdr plugin that sleeps idle agents (spec 11). |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) | SIL Open Font License 1.1, copyright 2020 The JetBrains Mono Project Authors; the licence text is in `honjin-core/src/browser/style/fonts/OFL.txt` | The editor and terminal font (Regular and Medium). |
| [herdr](https://github.com/ogulcancelik/herdr) | Apache-2.0 | **Not bundled.** Honjin calls the `herdr` program the user installs separately. |

Other npm dependencies (listed in `package-lock.json`) are under MIT, ISC, BSD or Apache-2.0 licences.
