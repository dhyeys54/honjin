# 07 — Packaging Corral.app (macOS, local use)

- Use `electron-builder` as a devDependency of `electron-app`. Model the config on the Theia IDE repo
  (`eclipse-theia/theia-ide`, `applications/electron/electron-builder.yml` and its `package` scripts). Copy only
  what a mac build needs.
- `appId: dev.corral.ide`, `productName: Corral`, `mac.target: dir` (no DMG), `mac.icon: ../branding/generated/corral.icns`,
  `mac.category: public.app-category.developer-tools`. `asarUnpack` must cover native modules (node-pty, etc.) as
  the Theia IDE config does.
- **No code signing or notarisation** (local use). Set `mac.identity: null`, and document the first-launch step in
  the README (right-click → Open, or `xattr -dr com.apple.quarantine /Applications/Corral.app`).
- Root script `package:mac` does: build the extension, `download:plugins`, `electron-app` production bundle
  (`theia build --mode production`), then `electron-builder --mac --dir`.
- Output: `electron-app/dist/mac-arm64/Corral.app` (Apple Silicon; this machine is arm64).
- Smoke check (task T3.5): launch the packaged app with `open`, and confirm the window title contains "Corral" and
  the herdr terminal attaches. Use the herdr "not found" overlay path to check PATH resolution works from Finder.
