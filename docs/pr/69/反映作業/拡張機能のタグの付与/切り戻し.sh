#!/bin/sh
# 打った vscode-v0.1.0 のタグと、そのタグの GitHub Release を消して、タグを打つ前に戻す
set -eu

REPO=shuhei1101/mdmark

if gh release view vscode-v0.1.0 --repo "$REPO" >/dev/null 2>&1; then
  gh release delete vscode-v0.1.0 --repo "$REPO" --yes
  echo "Release の削除: changed"
else
  echo "Release の削除: skipped"
fi
if git ls-remote --exit-code --tags origin refs/tags/vscode-v0.1.0 >/dev/null 2>&1; then
  git push origin :refs/tags/vscode-v0.1.0
  echo "origin のタグの削除: changed"
else
  echo "origin のタグの削除: skipped"
fi
if git rev-parse -q --verify refs/tags/vscode-v0.1.0 >/dev/null; then
  git tag -d vscode-v0.1.0 >/dev/null
  echo "手元のタグの削除: changed"
else
  echo "手元のタグの削除: skipped"
fi
