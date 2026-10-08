# 07 — Packaging Honjin.app (macOS)

- Use `electron-builder` as a devDependency of `electron-app`. Model the config on the Theia IDE repo
  (`eclipse-theia/theia-ide`, `applications/electron/electron-builder.yml` and its `package` scripts). Copy only
  what a mac build needs.
- `appId: dev.honjin.ide`, `productName: Honjin`, `mac.target: zip` (arm64; amended in Stage 8, was `dir`), `mac.icon: ../branding/generated/honjin.icns`,
  `mac.category: public.app-category.developer-tools`. `asarUnpack` must cover native modules (node-pty, etc.) as
  the Theia IDE config does.
- **No code signing or notarisation** for the beta (D45). Set `mac.identity: null`. The headline install is the
  script below, which avoids the Gatekeeper prompt because a curl download has no quarantine flag. The README also
  documents the manual path (System Settings → Privacy & Security → Open Anyway, or
  `xattr -dr com.apple.quarantine /Applications/Honjin.app`) and building from source.
- Root script `package:mac` does: build the extension, `download:plugins`, `electron-app` production bundle
  (`theia build --mode production`), then `electron-builder --mac`.
- Output: `electron-app/dist/Honjin-<version>-arm64-mac.zip` and the unpacked `electron-app/dist/mac-arm64/Honjin.app`
  (Apple Silicon only).
- Smoke check (task T3.5): launch the packaged app with `open`, and confirm the window title contains "Honjin" and
  the herdr terminal attaches. Use the herdr "not found" overlay path to check PATH resolution works from Finder.

## Beta release (Stage 8)

- **`scripts/install.sh`** (POSIX `sh`, kept short enough to read before running). The README one-liner is
  `curl -fsSL https://raw.githubusercontent.com/dhyeys54/honjin/main/scripts/install.sh | sh`. The script:
  1. Exits with a message unless `uname -s` is `Darwin`, `uname -m` is `arm64` and macOS is 13 or later. It then exits with a message if the install
     directory, or a `Honjin.app` already in it, is not writable (replacing the app moves it, D58), naming the `sudo sh` re-run and `HONJIN_INSTALL_DIR=$HOME/Applications`; it never falls
     back silently.
  2. Reads the latest release from `https://api.github.com/repos/dhyeys54/honjin/releases/latest`, or the tag in
     `HONJIN_VERSION` when set (a leading `v` is optional). `/releases/latest` skips prereleases, so releases are not
     marked prerelease (D56).
  3. Downloads the release's `Honjin-<version>-arm64-mac.zip` and `SHA256SUMS` into a `mktemp -d` directory. It
     honours `HONJIN_RELEASE_BASE` (a base URL), so tests can serve a local fixture.
  4. Checks the zip against `SHA256SUMS` with `shasum -a 256 -c`. On a mismatch it stops and changes nothing.
  5. Quits a running Honjin (`osascript -e 'quit app "Honjin"'`), waits up to 10 s, then, if it is still running
     (`HONJIN_QUIT_WAIT`, default 10), exits changing nothing. Otherwise it replaces `/Applications/Honjin.app` with the
     unzipped app (`ditto -x -k`), keeping the old app aside until the new one is in place.
  6. Prints the version installed and "Open Honjin from Applications". Running it again updates.
- **`scripts/release.sh <version>`**: stops at once unless `gh repo view dhyeys54/honjin` succeeds, then runs
  `package:mac`, writes `SHA256SUMS` for the zip, and runs
  `gh release create v<version> --repo dhyeys54/honjin --draft --notes-file <notes>` with both files. It never publishes; the user publishes
  the draft.
- **Version:** `0.1.0-beta.1` (spec 13 S11). Release notes per build list changes and known issues.
