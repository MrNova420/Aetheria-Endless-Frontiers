#!/usr/bin/env bash
# scripts/download-assets.sh  –  Convenience wrapper for Linux/macOS
# Forwards all arguments to the Node.js downloader.
cd "$(dirname "$0")/.."
if ! command -v node &>/dev/null; then
  echo "Node.js is required. Run setup.sh first to install it."
  exit 1
fi
node scripts/download-assets.js "$@"
