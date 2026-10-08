#!/bin/sh
# Builds Corral and creates a DRAFT GitHub release with the zip and SHA256SUMS. It never publishes:
# review the draft on GitHub, then publish it yourself.
#   usage: scripts/release.sh <version> [notes-file]      e.g. scripts/release.sh 0.1.0-beta.1
set -eu
[ $# -ge 1 ] || { echo "usage: $0 <version> [notes-file]" >&2; exit 1; }
version=$1
cd "$(dirname "$0")/.."

grep -q "\"version\": \"$version\"" electron-app/package.json || { echo "electron-app/package.json is not at version $version." >&2; exit 1; }

npm run package:mac

dist=electron-app/dist
zip=Corral-$version-arm64-mac.zip
[ -f "$dist/$zip" ] || { echo "$dist/$zip was not built." >&2; exit 1; }
(cd "$dist" && shasum -a 256 "$zip" > SHA256SUMS)

notes=${2:-}
if [ -z "$notes" ]; then
    notes=$(mktemp)
    echo "Corral $version. Install: curl -fsSL https://raw.githubusercontent.com/dhyeys54/corral/main/scripts/install.sh | sh" > "$notes"
fi

gh release create "v$version" --draft --prerelease --title "Corral $version" --notes-file "$notes" "$dist/$zip" "$dist/SHA256SUMS"
echo "Draft release v$version created. Publish it on GitHub when you are happy with it."
