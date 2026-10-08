#!/bin/sh
# Installs or updates Corral.app (Apple Silicon macOS). Run it again to update.
#   CORRAL_VERSION       release tag to install (default: latest)
#   CORRAL_RELEASE_BASE  base URL holding the zip and SHA256SUMS (default: the GitHub release)
#   CORRAL_INSTALL_DIR   where Corral.app goes (default: /Applications)
set -eu

repo=dhyeys54/corral
dir=${CORRAL_INSTALL_DIR:-/Applications}

[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || { echo "Corral's beta runs on Apple Silicon Macs only." >&2; exit 1; }

base=${CORRAL_RELEASE_BASE:-}
if [ -z "$base" ]; then
    tag=${CORRAL_VERSION:-$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n 1)}
    [ -n "$tag" ] || { echo "Could not find the latest Corral release." >&2; exit 1; }
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

# Only quit the Corral that lives at the path being replaced.
if pgrep -f "$dir/Corral.app/Contents/MacOS/" >/dev/null 2>&1; then
    osascript -e 'quit app "Corral"' >/dev/null 2>&1 || true
    n=0
    while pgrep -f "$dir/Corral.app/Contents/MacOS/" >/dev/null 2>&1 && [ "$n" -lt 20 ]; do sleep 0.5; n=$((n + 1)); done
fi

rm -rf "$dir/Corral.app"
mv "$stage/Corral.app" "$dir/Corral.app"

version=${zip#Corral-}; version=${version%-arm64-mac.zip}
echo "Installed Corral $version in $dir. Open Corral from Applications."
