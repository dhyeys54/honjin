#!/bin/sh
# Runs install.sh against a fixture release served from a local http.server (spec 07 §Beta release).
set -eu
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
server=
trap '[ -n "$server" ] && { kill "$server"; wait "$server"; } 2>/dev/null; rm -rf "$work"' EXIT

fail() { echo "FAIL: $1"; exit 1; }
[ "$(uname -s)-$(uname -m)" = "Darwin-arm64" ] || { echo "skipped: install.sh only runs on Apple Silicon macOS"; exit 0; }

# A fake release: Honjin.app/Contents/Info.plist zipped the way electron-builder does it.
rel="$work/release"; mkdir -p "$rel" "$work/src/Honjin.app/Contents"
echo "fixture" > "$work/src/Honjin.app/Contents/Info.plist"
zip=Honjin-9.9.9-test-arm64-mac.zip
ditto -c -k --keepParent "$work/src/Honjin.app" "$rel/$zip"
(cd "$rel" && shasum -a 256 "$zip" > SHA256SUMS)

port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$rel" >/dev/null 2>&1 &
server=$!
sleep 1

install() { HONJIN_RELEASE_BASE="http://127.0.0.1:$port" HONJIN_INSTALL_DIR="$work/apps" sh "$here/install.sh"; }

# 1. A good release installs, and running it again updates in place.
mkdir -p "$work/apps"
out=$(install) || fail "install exited non-zero: $out"
[ -f "$work/apps/Honjin.app/Contents/Info.plist" ] || fail "Honjin.app missing after install"
echo "$out" | grep -q "9.9.9-test" || fail "version not printed: $out"
install >/dev/null || fail "second run (update) failed"
[ -d "$work/apps/Honjin.app" ] || fail "app gone after update"

# 2. A corrupt zip stops the install and leaves the previous app alone.
echo "previous" > "$work/apps/Honjin.app/marker"
echo "garbage" >> "$rel/$zip"
if out=$(install 2>&1); then fail "corrupt zip was installed: $out"; fi
echo "$out" | grep -qi "checksum" || fail "no checksum message: $out"
[ "$(cat "$work/apps/Honjin.app/marker")" = "previous" ] || fail "previous app was touched"

# 3. A directory the user cannot write to is reported, not worked around.
mkdir -p "$work/readonly" && chmod 555 "$work/readonly"
ditto -c -k --keepParent "$work/src/Honjin.app" "$rel/$zip"; (cd "$rel" && shasum -a 256 "$zip" > SHA256SUMS)
if out=$(HONJIN_RELEASE_BASE="http://127.0.0.1:$port" HONJIN_INSTALL_DIR="$work/readonly" sh "$here/install.sh" 2>&1); then fail "installed into a read-only dir"; fi
echo "$out" | grep -q "Can't write to" || fail "no write-permission message: $out"
chmod 755 "$work/readonly"

# 4. A Honjin that will not quit stops the install and leaves the app in place.
mkdir -p "$work/apps/Honjin.app/Contents/MacOS"
printf '#!/bin/sh\nsleep 60\n' > "$work/apps/Honjin.app/Contents/MacOS/Honjin"; chmod +x "$work/apps/Honjin.app/Contents/MacOS/Honjin"
"$work/apps/Honjin.app/Contents/MacOS/Honjin" >/dev/null 2>&1 & running=$!
sleep 1
if out=$(HONJIN_QUIT_WAIT=2 install 2>&1); then kill $running; fail "replaced a running app: $out"; fi
kill $running; wait $running 2>/dev/null || true
echo "$out" | grep -qi "still running" || fail "no still-running message: $out"
[ -f "$work/apps/Honjin.app/Contents/MacOS/Honjin" ] || fail "running app was removed"

echo "install.sh: all checks passed"
