#!/bin/bash

# deploy_github.sh
# Syncs local changes with remote, builds the project, and pushes to main.
# Usage:
#   ./deploy_github.sh "your commit message"                   # Standard deploy
#   ./deploy_github.sh "your commit message" -skip-ci          # Skip CI pipeline
#   ./deploy_github.sh -amend                                  # Amend last commit (no message needed)
#   ./deploy_github.sh -amend -skip-ci                         # Amend + skip CI

set -e

# --- Configuration ---
BRANCH="main"
REMOTE="darkphilosophy"
BUILD_COMMAND="./package.sh"
COMMIT_MSG=""
SKIP_CI=false
AMEND=false
FORCE=false

# --- Argument Parsing ---
if [[ $# -eq 0 ]]; then
    echo "❌ Error: Commit message is required!"
    echo ""
    echo "Usage:"
    echo "  ./deploy_github.sh \"your commit message\""
    echo "  ./deploy_github.sh \"your commit message\" -skip-ci"
    echo "  ./deploy_github.sh -amend"
    echo "  ./deploy_github.sh -amend -skip-ci"
    echo "  ./deploy_github.sh ... -force   # Auto-resolve conflicts favoring local changes"
    echo ""
    echo "Examples:"
    echo "  ./deploy_github.sh \"feat: Update renderer and docs\""
    echo "  ./deploy_github.sh \"fix: README links\" -skip-ci"
    echo "  ./deploy_github.sh -amend  # Fix typo without new message"
    exit 1
fi

if [[ "$1" == "-amend" ]]; then
    AMEND=true
    shift
else
    COMMIT_MSG="$1"
    shift
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        -skip-ci)
            SKIP_CI=true
            ;;
        -force)
            FORCE=true
            ;;
        *)
            echo "❌ Unknown option: $1"
            exit 1
            ;;
    esac
    shift
done

if [[ "$SKIP_CI" == "true" && "$AMEND" == "false" ]]; then
    COMMIT_MSG="$COMMIT_MSG [skip ci]"
fi

echo "========================================"
echo "🚀 Starting Main Branch Sync & Release"
echo "========================================"
echo "Branch: $BRANCH"
echo "Remote: $REMOTE"
echo "Mode: $([ "$AMEND" == "true" ] && echo "AMEND" || echo "NEW COMMIT")"
echo "Skip CI: $SKIP_CI"
echo "Force Mode: $FORCE"
if [[ "$AMEND" == "false" ]]; then
    echo "Message: $COMMIT_MSG"
fi
echo "========================================"

if [[ -z $(git config user.name) ]]; then
    echo "⚙️  Configuring git user.name..."
    git config user.name 'GitHub Action'
fi

if [[ -z $(git config user.email) ]]; then
    echo "⚙️  Configuring git user.email..."
    git config user.email 'action@github.com'
fi

if [[ -n $(git status --porcelain | grep "^U") ]]; then
    if [[ "$FORCE" == "true" ]]; then
        echo "🔥 Force: Resolving existing unmerged paths (keeping current files)..."
        git add -A
    else
        echo "❌ Unmerged paths detected (Conflict state). Run with -force to auto-accept current files, or resolve manually."
        exit 1
    fi
fi

if [[ -n $(git status --porcelain) ]]; then
    echo "📦 Stashing local changes..."
    git stash
    STASHED=true
else
    STASHED=false
fi

echo "🔄 Checking out $BRANCH..."
git checkout "$BRANCH"

echo "⬇️  Pulling latest changes from remote (Rebasing for CI bot compatibility)..."
git pull --rebase "$REMOTE" "$BRANCH"

if [[ "$STASHED" == "true" ]]; then
    echo "📦 Popping stashed changes..."
    if ! git stash pop; then
        if [[ "$FORCE" == "true" ]]; then
            echo "🔥 Force: Conflict during stash pop. Resolving favored to LOCAL changes..."
            git checkout --theirs . || true
            git add -A
            echo "✅ Conflicts resolved favoring local work."
        else
            echo "⚠️  Stash pop failed - manual resolution needed"
            exit 1
        fi
    fi
fi

# --- Build Project ---
echo "🛠️  Running build command..."
$BUILD_COMMAND

# --- Commit and Push ---
if [[ "$AMEND" == "true" ]]; then
    if [[ -n $(git status --porcelain) ]]; then
        echo "📸 Amending last commit..."
        git add -A
        AMEND_FLAGS="--amend --no-edit"
        if [[ "$SKIP_CI" == "true" ]]; then
            LAST_MSG=$(git log -1 --pretty=%B)
            if [[ ! "$LAST_MSG" =~ \[skip\ ci\] ]]; then
                AMEND_FLAGS="--amend -m \"$LAST_MSG [skip ci]\""
            else
                AMEND_FLAGS="--amend --no-edit"
            fi
        fi
        eval "git commit $AMEND_FLAGS"

        echo "⬆️  Force pushing amended commit to $BRANCH..."
        if ! git push --force-with-lease "$REMOTE" "$BRANCH"; then
            echo "❌ Push failed - check remote status"
            exit 1
        fi
    else
        echo "✨ No changes to amend."
    fi
else
    if [[ -n $(git status --porcelain) ]]; then
        echo "📸 Committing changes..."
        git add -A
        git commit -m "$COMMIT_MSG"

        echo "⬆️  Pushing to $BRANCH..."
        if ! git push "$REMOTE" "$BRANCH"; then
            echo "❌ Push failed - check remote status"
            exit 1
        fi
    else
        echo "✨ No new changes to commit."
    fi
fi

echo "========================================"
echo "✅ Sync and Release Complete!"
echo "========================================"
