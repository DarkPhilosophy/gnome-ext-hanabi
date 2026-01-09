#!/bin/bash

set -e

# Parse arguments
FIX_MODE=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        -fix|--fix)
            FIX_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./build.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -fix, --fix    Auto-fix linting issues before build"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Lint check
echo "Checking code quality..."
if npm run lint > /dev/null 2>&1; then
    echo "✓ Linting passed"
elif [ "$FIX_MODE" = true ]; then
    echo "⚠ Linting issues found, auto-fixing..."
    npm run lint:fix
    if npm run lint > /dev/null 2>&1; then
        echo "✓ Linting passed after auto-fix"
    else
        echo "✗ Linting still failing after auto-fix. Please review manually:" >&2
        npm run lint
        exit 1
    fi
else
    echo "✗ Linting failed. Fix issues or run: ./build.sh -fix" >&2
    npm run lint
    exit 1
fi

# Sync version from package.json
echo "Syncing version..."
node scripts/sync-version.js

# Update lint status in README
echo "Updating lint status..."
node scripts/update-lint-status.js

EXTENSION_ID="hanabi-extension@jeffshee.github.io"
USER_EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_ID"
GLIB_SCHEMA_DIR="$HOME/.local/share/glib-2.0/schemas"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

# Build with meson/ninja
echo "Compiling with Meson/Ninja..."
meson build --wipe --prefix="$HOME/.local" > /dev/null 2>&1
ninja -C build > /dev/null 2>&1
echo "✓ Build complete"

# Install to user directory
echo "Installing to user directory..."
ninja -C build install > /dev/null 2>&1

# Stamp build date into prefs.js in the installed extension
BUILD_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
sed -i "s|^const BUILD_DATE = null;|const BUILD_DATE = '$BUILD_DATE';|" "$USER_EXTENSION_DIR/prefs.js"

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
echo "Build date: $BUILD_DATE"
echo "Extension ID: $EXTENSION_ID"
echo "Location: $USER_EXTENSION_DIR"
echo ""
echo "View load time:"
echo "  dconf read /io/github/jeffshee/hanabi-extension/last-load-time"
echo ""
