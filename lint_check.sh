#!/bin/bash
# GNOME Extension Universal Linting Script
# SPDX-License-Identifier: MIT OR LGPL-2.0-or-later
# Usage: ./lint_check.sh [--fix] [--strict] [--extension] [--gjs]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$SCRIPT_DIR/src"
CONFIG_DIR="$SCRIPT_DIR"

# Parse arguments
FIX_MODE=false
STRICT_MODE=false
TARGET_CONFIGS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --fix)
            FIX_MODE=true
            shift
            ;;
        --strict)
            STRICT_MODE=true
            TARGET_CONFIGS=("gjs:${CONFIG_DIR}/lint/eslintrc-gjs.yml")
            shift
            ;;
        --extension)
            TARGET_CONFIGS+=("extension:${CONFIG_DIR}/lint/eslintrc-extension.yml:extension.js,prefs.js")
            shift
            ;;
        --gjs)
            TARGET_CONFIGS+=("gjs:${CONFIG_DIR}/lint/eslintrc-gjs.yml")
            shift
            ;;
        --help)
            cat << 'EOF'
GNOME Extension Universal Linting Script

Usage:
  ./lint_check.sh [OPTIONS]

Options:
  --fix           Auto-fix fixable issues
  --strict        Run strict GJS checks only
  --extension     Run extension config only
  --gjs           Run GJS config only
  --help          Show this help message

Examples:
  ./lint_check.sh                    # Run all checks
  ./lint_check.sh --fix              # Auto-fix all issues
  ./lint_check.sh --strict --fix     # Strict mode + auto-fix
  ./lint_check.sh --extension        # Extension code only

EOF
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Check npx is available
ESLINT="$(command -v npx || true)"
if [[ -z "$ESLINT" ]]; then
    echo "ERROR: npx not found. Install Node.js+npm first." >&2
    exit 1
fi

# Default configs if none specified
if [[ ${#TARGET_CONFIGS[@]} -eq 0 ]]; then
    if [[ "$STRICT_MODE" == "true" ]]; then
        TARGET_CONFIGS=("gjs:${CONFIG_DIR}/lint/eslintrc-gjs.yml")
    else
        TARGET_CONFIGS=(
            "extension:${CONFIG_DIR}/lint/eslintrc-extension.yml:extension.js,prefs.js"
            "shell:${CONFIG_DIR}/lint/eslintrc-shell.yml"
        )
    fi
fi

# Build eslint command base
ESLINT_CMD_BASE=("$ESLINT" eslint --no-eslintrc)
if [[ "$FIX_MODE" == "true" ]]; then
    ESLINT_CMD_BASE+=(--fix)
fi
ESLINT_CMD_BASE+=(--color)

echo "═══════════════════════════════════════════════════════════"
echo "GNOME Extension Linting $(if [[ "$FIX_MODE" == "true" ]]; then echo "(AUTO-FIX)"; fi)"
echo "═══════════════════════════════════════════════════════════"
echo ""

TOTAL_ERRORS=0
TOTAL_WARNINGS=0
FAIL=false

for config_entry in "${TARGET_CONFIGS[@]}"; do
    # Parse config entry: "type:path" or "type:path:files"
    IFS=':' read -r config_type cfg_path file_patterns <<< "$config_entry"

    if [[ ! -f "$cfg_path" ]]; then
        echo "SKIP: Config not found: $cfg_path" >&2
        continue
    fi

    config_name="$(basename "$cfg_path" .yml)"
    echo "Running: $config_name"
    echo "─────────────────────────────────────────────────────────"

    # Build file list
    if [[ -n "${file_patterns:-}" ]]; then
        # Specific files for this config
        target_files=()
        IFS=',' read -ra patterns <<< "$file_patterns"
        for pattern in "${patterns[@]}"; do
            target_files+=("$EXT_DIR/$pattern")
        done
    else
        # All files in extension directory
        target_files=("$EXT_DIR")
    fi

    # Run eslint
    ESLINT_CMD=("${ESLINT_CMD_BASE[@]}" --config "$cfg_path" "${target_files[@]}")
    if "${ESLINT_CMD[@]}"; then
        echo "✓ PASS: $config_name"
    else
        FAIL=true
        echo "✗ FAIL: $config_name"
    fi

    echo ""
done

echo "═══════════════════════════════════════════════════════════"
if [[ "$FAIL" == "true" ]]; then
    echo "✗ Linting completed with errors"
    echo ""
    echo "Fix suggestions:"
    echo "  1. Auto-fix: ./lint_check.sh --fix"
    echo "  2. Manual review violations above"
    echo "  3. JSDoc: Add @param and @returns documentation"
    echo ""
    exit 1
else
    echo "✓ Linting passed successfully!"
    if [[ "$FIX_MODE" == "true" ]]; then
        echo "✓ Auto-fixes applied"
    fi
    exit 0
fi
