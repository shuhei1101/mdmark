#!/bin/sh
# GitHub Release の vscode-v0.1.0 に mdmark-0.1.0.vsix が添えられているかを読むだけで確かめる
set -eu

REPO=shuhei1101/mdmark
TAG=vscode-v0.1.0
ASSET=mdmark-0.1.0.vsix

ASSETS=$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name' 2>/dev/null || true)
echo "Release の添付: ${ASSETS:-（なし）}"
if printf '%s\n' "$ASSETS" | grep -qx "$ASSET"; then
  echo "$ASSET の添付: ok"
else
  echo "$ASSET の添付: failed"
  exit 1
fi
