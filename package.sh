#!/bin/bash

# Create extension package for GNOME Extensions website (EGO)
# Files must be at ZIP root level, NOT in a subdirectory
# Usage: ./package.sh

set -e

# Sync version from package.json
echo "Syncing version..."
node scripts/sync-version.js

# Update lint status in README
echo "Updating lint status..."
node scripts/update-lint-status.js

# Update EGO version badges (optional)
echo "Updating GNOME Extensions version..."
node scripts/fetch-ego-version.js || true

echo "🏗️  Building Hanabi extension package..."

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_UUID=$(rg -m1 "^uuid =" "$PROJECT_DIR/meson.build" | sed -E "s/uuid = '([^']+)'.*/\1/")
SETTINGS_SCHEMA=$(rg -m1 "^schema =" "$PROJECT_DIR/meson.build" | sed -E "s/schema = '([^']+)'.*/\1/")
VERSION_MAJOR=$(node -p "require('./package.json').version.split('.')[0]")

if [[ -z "$EXTENSION_UUID" || -z "$SETTINGS_SCHEMA" ]]; then
    echo "❌ Failed to determine extension UUID or schema from meson.build" >&2
    exit 1
fi

PACKAGE_NAME="${EXTENSION_UUID}.zip"

# Create temporary directory for packaging
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

mkdir -p "$TEMP_DIR/schemas"

# Render metadata.json from template
sed -e "s/@uuid@/${EXTENSION_UUID}/g" \
    -e "s/@settings_schema@/${SETTINGS_SCHEMA}/g" \
    -e "s/@version@/${VERSION_MAJOR}/g" \
    "$PROJECT_DIR/extension/metadata.json.in" > "$TEMP_DIR/metadata.json"

# Copy required files
cp "$PROJECT_DIR/extension/extension.js" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/prefs.js" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/renderer/renderer.js" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/renderer/stylesheet.css" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/assets/hanabi-symbolic.svg" "$TEMP_DIR/"
cp "$PROJECT_DIR/extension/schemas"/*.gschema.xml "$TEMP_DIR/schemas/" 2>/dev/null || true

# Create zip package - files at root level
cd "$TEMP_DIR"
zip -r -q "$PROJECT_DIR/${PACKAGE_NAME}" ./*

echo ""
echo "✅ Extension package ready!"
echo "📦 Package: $PACKAGE_NAME"
echo "📁 Location: $PROJECT_DIR/$PACKAGE_NAME"
echo ""

# Validation Step
echo "🔍 Validating package contents (Internal Structure):"
echo "---------------------------------------------------"
if command -v unzip >/dev/null 2>&1; then
    unzip -l "$PROJECT_DIR/$PACKAGE_NAME"
elif command -v zipinfo >/dev/null 2>&1; then
    zipinfo "$PROJECT_DIR/$PACKAGE_NAME"
else
    echo "⚠️  'unzip' or 'zipinfo' not found. Cannot list contents automatically."
fi
echo "---------------------------------------------------"
echo "Upload this file to: https://extensions.gnome.org/"
