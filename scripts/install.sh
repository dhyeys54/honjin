#!/bin/sh
# Installs or updates Corral.app (Apple Silicon macOS). Run it again to update.
#   CORRAL_VERSION       release tag to install (default: latest)
#   CORRAL_RELEASE_BASE  base URL holding the zip and SHA256SUMS (default: the GitHub release)
#   CORRAL_INSTALL_DIR   where Corral.app goes (default: /Applications)
#   CORRAL_QUIT_WAIT     seconds to wait for a running Corral to quit (default: 10)
set -eu

repo=dhyeys54/corral
dir=${CORRAL_INSTALL_DIR:-/Applications}

[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || { echo "Corral's beta runs on Apple Silicon Macs only." >&2; exit 1; }
[ "$(sw_vers -productVersion | cut -d. -f1)" -ge 13 ] || { echo "Corral needs macOS 13 or later." >&2; exit 1; }

if [ ! -w "$dir" ]; then
    echo "Can't write to $dir. Re-run with:" >&2
    echo "  curl -fsSL https://raw.githubusercontent.com/$repo/main/scripts/install.sh | sudo sh" >&2
    echo "or install for yourself only: CORRAL_INSTALL_DIR=\$HOME/Applications (create it first)." >&2
    exit 1
fi

base=${CORRAL_RELEASE_BASE:-}
if [ -z "$base" ]; then
    tag=${CORRAL_VERSION:-$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)}
    [ -n "$tag" ] || { echo "Could not find the latest Corral release." >&2; exit 1; }
    case $tag in v*) ;; *) tag=v$tag ;; esac
    base=https://github.com/$repo/releases/download/$tag
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS"
zip=$(sed -n 's/^[0-9a-f]*  *\(Corral-.*-arm64-mac\.zip\)$/\1/p' "$tmp/SHA256SUMS" | head -n 1)
[ -n "$zip" ] || { echo "SHA256SUMS lists no Corral zip." >&2; exit 1; }
curl -fSL --progress-bar "$base/$zip" -o "$tmp/$zip"

if ! (cd "$tmp" && grep "  $zip\$" SHA256SUMS | shasum -a 256 -c - >/dev/null 2>&1); then
    echo "Checksum mismatch for $zip. Nothing was changed." >&2
    exit 1
fi

# Unpack beside the target so the final swap is a rename, and a bad unzip never touches the old app.
stage=$dir/.Corral-install.$$
trap 'rm -rf "$tmp" "$stage"' EXIT
mkdir -p "$stage"
ditto -x -k "$tmp/$zip" "$stage"
[ -d "$stage/Corral.app" ] || { echo "The zip does not contain Corral.app." >&2; exit 1; }

# Only quit the Corral that lives at the path being replaced, and never replace one that is still running.
running() { pgrep -f "$dir/Corral.app/Contents/MacOS/" >/dev/null 2>&1; }
if running; then
    osascript -e 'quit app "Corral"' >/dev/null 2>&1 || true
    n=0
    while running && [ "$n" -lt $((${CORRAL_QUIT_WAIT:-10} * 2)) ]; do sleep 0.5; n=$((n + 1)); done
    running && { echo "Corral is still running. Quit it and run this again. Nothing was changed." >&2; exit 1; }
fi

# Keep the old app until the new one is in place.
[ -d "$dir/Corral.app" ] && mv "$dir/Corral.app" "$stage/old"
mv "$stage/Corral.app" "$dir/Corral.app" || { [ -d "$stage/old" ] && mv "$stage/old" "$dir/Corral.app"; echo "Could not move Corral into $dir." >&2; exit 1; }

version=${zip#Corral-}; version=${version%-arm64-mac.zip}
echo "Installed Corral $version in $dir. Open Corral from Applications."
