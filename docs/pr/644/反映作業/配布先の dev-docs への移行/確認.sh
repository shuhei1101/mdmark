#!/bin/sh
set -eu

REPO="${1:-$PWD}"
CONFIG="$REPO/project-index.yaml"
[ -f "$CONFIG" ] || CONFIG="$REPO/dev-docs.yaml"
if [ -z "$REPO" ] || [ ! -f "$CONFIG" ]; then
  echo "dev-docs.yaml: failed"
  exit 1
fi
NAME=$(sed -n 's/^name: *//p' "$CONFIG" | head -n 1)
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8781/$NAME@develop/")
if [ "$code" = "200" ]; then
  echo "dev-docs の画面の /$NAME@develop/: ok（$code）"
else
  echo "dev-docs の画面の /$NAME@develop/: failed（$code）"
  exit 1
fi
