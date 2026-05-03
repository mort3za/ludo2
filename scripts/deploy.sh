#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
DEPLOY_HOST="${DEPLOY_HOST:?Set DEPLOY_HOST (e.g. user@host)}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/ludo}"
SERVICE_NAME="${SERVICE_NAME:-ludo}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ROOT_DIR/.deploy-build"

echo "=== Ludo Deploy ==="
echo "Host: $DEPLOY_HOST"
echo "Dir:  $DEPLOY_DIR"

# --- Build ---
echo ""
echo "--- Building server ---"
cd "$ROOT_DIR/apps/server"
bun build src/index.ts --target bun --outdir "$BUILD_DIR/server" --minify

echo ""
echo "--- Building client ---"
cd "$ROOT_DIR/apps/client"
npx vite build --outDir "$BUILD_DIR/client"

# --- Upload ---
echo ""
echo "--- Uploading artifacts ---"
ssh "$DEPLOY_HOST" "mkdir -p $DEPLOY_DIR/server $DEPLOY_DIR/client"
rsync -avz --delete "$BUILD_DIR/server/" "$DEPLOY_HOST:$DEPLOY_DIR/server/"
rsync -avz --delete "$BUILD_DIR/client/" "$DEPLOY_HOST:$DEPLOY_DIR/client/"

# --- Migrations ---
echo ""
echo "--- Running DB migrations ---"
ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR && bun run server/index.js --migrate 2>/dev/null || true"

# --- Restart service ---
echo ""
echo "--- Restarting service ---"
ssh "$DEPLOY_HOST" "sudo systemctl restart $SERVICE_NAME"

# --- Cleanup ---
rm -rf "$BUILD_DIR"

echo ""
echo "=== Deploy complete ==="
