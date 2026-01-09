#!/bin/bash

set -e

EXTENSION_ID="hanabi-extension@jeffshee.github.io"
USER_EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_ID"
SYSTEM_EXTENSION_DIR="/usr/local/share/gnome-shell/extensions/$EXTENSION_ID"
GLIB_SCHEMA_DIR="$HOME/.local/share/glib-2.0/schemas"
SYSTEM_GLIB_SCHEMA_DIR="/usr/local/share/glib-2.0/schemas"

echo "=========================================="
echo "Building Hanabi Extension..."
echo "=========================================="
echo ""

# Check if extension is enabled
ENABLED=$(gnome-extensions list | grep -c "$EXTENSION_ID" || true)

# Disable if enabled
if [ $ENABLED -gt 0 ]; then
    echo "Disabling extension..."
    gnome-extensions disable "$EXTENSION_ID" || true
    sleep 1
fi

# Generate build date
echo "Generating build date..."
BUILD_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
echo "$BUILD_DATE" > build_date.txt

# Build with meson/ninja
echo "Compiling with Meson/Ninja..."
meson build --wipe --prefix="$HOME/.local" > /dev/null 2>&1
ninja -C build > /dev/null 2>&1
echo "✓ Build complete"

# Install to user directory
echo "Installing to user directory..."
ninja -C build install > /dev/null 2>&1

# Copy build_date.txt to extension directory
mkdir -p "$USER_EXTENSION_DIR"
cp build_date.txt "$USER_EXTENSION_DIR/"

echo "✓ Installed to $USER_EXTENSION_DIR"

# Update glib schema cache (user)
echo "Updating glib schema cache..."
mkdir -p "$GLIB_SCHEMA_DIR"
glib-compile-schemas "$GLIB_SCHEMA_DIR/" 2>/dev/null || true
echo "✓ Schema cache updated"

# Re-enable extension
echo "Enabling extension..."
sleep 1
gnome-extensions enable "$EXTENSION_ID" || true
sleep 2

echo ""
echo "=========================================="
echo "✅ Build Complete!"
echo "=========================================="
echo "Build date: $(cat build_date.txt)"
echo "Extension ID: $EXTENSION_ID"
echo "Location: $USER_EXTENSION_DIR"
echo ""
echo "View load time:"
echo "  dconf read /io/github/jeffshee/hanabi-extension/last-load-time"
echo ""
