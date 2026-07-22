#!/usr/bin/env bash
#
# build-release.sh: package widgets into installable archives using the Info-ZIP
# `zip` CLI — the encoder iCUE's (Qt-based) importer reliably accepts. Producing
# the archive any other way (streaming zip libraries, hand-rolled writers) risks
# iCUE rejecting it as "Unsupported or corrupted file" — see
# docs/ICUE_WIDGET_FORMAT.md.
#
# For each widget it builds:
#   dist/<name>.zip          folder-wrapped, for manual copy into iCUE's widgets dir
#   dist/<name>.icuewidget   flat (files at zip root), for iCUE's import button
# and, when packaging everything, dist/all-widgets.zip (all widgets bundled).
#
# icon.png / icon@2x.png are intentionally excluded: they're listing/marketplace
# art (referenced by manifest preview_icon), and iCUE rejects archives with them.
#
# Usage:
#   tools/build-release.sh            # package every widget + the bundle
#   tools/build-release.sh <name>     # package only widgets/<name>

set -euo pipefail

command -v zip >/dev/null 2>&1 || { echo "error: 'zip' is required (e.g. 'sudo apt install -y zip')" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$REPO_ROOT/dist"
WIDGETS="$REPO_ROOT/widgets"

# Files iCUE imports, in the order zip should store them.
INSTALLABLE=(index.html manifest.json translation.json resources modules)

ONLY="${1:-}"

stage_widget() {
  # $1 = widget dir, $2 = staging dir (widget files copied to $2/$name)
  local widget_dir="$1" stage="$2" name
  name="$(basename "$widget_dir")"
  mkdir -p "$stage/$name"
  for entry in "${INSTALLABLE[@]}"; do
    [ -e "$widget_dir/$entry" ] && cp -r "$widget_dir/$entry" "$stage/$name/"
  done
  return 0 # else a final missing optional entry leaves $? non-zero and trips set -e
}

package_widget() {
  local widget_dir="$1" name stage
  name="$(basename "$widget_dir")"
  echo "Packaging $name.zip + $name.icuewidget"

  stage="$(mktemp -d)"
  stage_widget "$widget_dir" "$stage"

  # Folder-wrapped .zip (manual install): widget dir at the archive root.
  (cd "$stage" && zip -r "$DIST/$name.zip" "$name" -x ".*") >/dev/null

  # Flat .icuewidget (import button): files at the archive root.
  (cd "$stage/$name" && zip -r "$DIST/$name.icuewidget" . -x ".*") >/dev/null

  rm -rf "$stage"
}

list_widgets() {
  for d in "$WIDGETS"/*/; do
    [ -f "$d/index.html" ] && basename "$d"
  done
}

rm -rf "$DIST"
mkdir -p "$DIST"

if [ -n "$ONLY" ]; then
  [ -f "$WIDGETS/$ONLY/index.html" ] || { echo "No widget at widgets/$ONLY/index.html" >&2; exit 1; }
  package_widget "$WIDGETS/$ONLY"
  exit 0
fi

BUNDLE="$(mktemp -d)"
COUNT=0
while IFS= read -r name; do
  [ -n "$name" ] || continue
  package_widget "$WIDGETS/$name"
  stage_widget "$WIDGETS/$name" "$BUNDLE"
  COUNT=$((COUNT + 1))
done < <(list_widgets)

if [ "$COUNT" -gt 0 ]; then
  echo "Packaging all-widgets.zip ($COUNT widgets)"
  (cd "$BUNDLE" && zip -r "$DIST/all-widgets.zip" . -x ".*") >/dev/null
fi
rm -rf "$BUNDLE"

echo "Done. Artifacts in dist/:"
ls -1 "$DIST"
