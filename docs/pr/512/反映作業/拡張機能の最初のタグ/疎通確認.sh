#!/bin/sh
# 拡張機能の最初のタグを打つ前に、GitHub と Marketplace へ読み取りだけでつながるかを確かめる
set -u

rc=0
if git ls-remote --exit-code origin refs/heads/develop >/dev/null 2>&1; then
  echo "GitHub のリポジトリ: ok"
else
  echo "GitHub のリポジトリ: failed"
  git ls-remote --exit-code origin refs/heads/develop 2>&1 | tail -3
  rc=1
fi
if gh run list --workflow vscode-release.yml --limit 1 >/dev/null 2>&1; then
  echo "GitHub Actions: ok"
else
  echo "GitHub Actions: failed"
  gh run list --workflow vscode-release.yml --limit 1 2>&1 | tail -3
  rc=1
fi
if curl -fsS -X POST 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery' \
  -H 'Content-Type: application/json' -H 'Accept: application/json;api-version=7.2-preview.1' \
  -d '{"filters":[{"criteria":[{"filterType":7,"value":"ShuheiNishikawa.mdmark-vscode"}]}],"flags":1}' >/dev/null 2>&1; then
  echo "Marketplace: ok"
else
  echo "Marketplace: failed"
  rc=1
fi
exit $rc
