#!/usr/bin/env bash
# Regenerates every raster icon from branding/icon.svg and branding/favicon.svg.
# Needs: rsvg-convert (brew install librsvg), magick (brew install imagemagick), iconutil (macOS).
set -euo pipefail
cd "$(dirname "$0")/../branding"

out=generated
rm -rf "$out" && mkdir -p "$out/honjin.iconset"

# App icon PNGs + macOS .icns
for s in 16 32 64 128 256 512 1024; do
  rsvg-convert -w "$s" -h "$s" icon.svg -o "$out/icon-$s.png"
done
for s in 16 32 128 256 512; do
  cp "$out/icon-$s.png" "$out/honjin.iconset/icon_${s}x${s}.png"
  cp "$out/icon-$((s * 2)).png" "$out/honjin.iconset/icon_${s}x${s}@2x.png"
done
iconutil -c icns "$out/honjin.iconset" -o "$out/honjin.icns"
rm -rf "$out/honjin.iconset"

# Favicon (browser target) from the small-size variant
for s in 16 32 48 180 192 512; do
  rsvg-convert -w "$s" -h "$s" favicon.svg -o "$out/favicon-$s.png"
done
magick "$out/favicon-16.png" "$out/favicon-32.png" "$out/favicon-48.png" "$out/favicon.ico"
cp favicon.svg "$out/favicon.svg"

echo "icons written to branding/$out"
