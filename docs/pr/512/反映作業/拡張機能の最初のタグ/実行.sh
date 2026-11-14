#!/bin/sh
# develop の HEAD（vscode/package.json の version が 0.1.3）に vscode-v0.1.3 のタグを打って push し、
# vscode-release.yml に .vsix を GitHub Release へ添えさせ、Marketplace へ公開させる
set -u

TAG=vscode-v0.1.3
VERSION=0.1.3

# 前提確認
if [ $# -gt 1 ] || { [ $# -eq 1 ] && [ "$1" != "--dry-run" ]; }; then
  echo "前提確認: failed"
  exit 1
fi
if ! git fetch -q origin develop --tags 2>/tmp/vscode-tag-fetch.err; then
  echo "前提確認: failed"
  echo "\$ git fetch -q origin develop --tags"
  cat /tmp/vscode-tag-fetch.err
  exit 1
fi
COMMIT=$(git rev-parse origin/develop)
ACTUAL=$(git show "$COMMIT:vscode/package.json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')
if [ "$ACTUAL" != "$VERSION" ]; then
  echo "前提確認: failed"
  echo "origin/develop ($COMMIT) の vscode/package.json の version は $ACTUAL"
  exit 1
fi
if ! git show "$COMMIT:.github/workflows/vscode-release.yml" | grep -q 'vsce publish --oidc'; then
  echo "前提確認: failed"
  echo "origin/develop ($COMMIT) の vscode-release.yml に vsce publish --oidc が無い"
  exit 1
fi
PUBLISHED=$(curl -fsS -X POST 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery' \
  -H 'Content-Type: application/json' -H 'Accept: application/json;api-version=7.2-preview.1' \
  -d '{"filters":[{"criteria":[{"filterType":7,"value":"ShuheiNishikawa.mdmark-vscode"}]}],"flags":1}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=JSON.parse(s).results[0].extensions[0];console.log(e?e.versions.map(v=>v.version).join(" "):"")})')
echo "Marketplace の公開済みのバージョン: $PUBLISHED"
for v in $PUBLISHED; do
  if [ "$v" = "$VERSION" ]; then
    echo "前提確認: failed"
    echo "Marketplace に $VERSION が公開済み"
    exit 1
  fi
done
echo "前提確認: ok"

# 計画（--dry-run もここを通る）
REMOTE=$(git ls-remote origin "refs/tags/$TAG" | cut -f1)
if [ -n "$REMOTE" ]; then
  echo "タグ $TAG: skipped（origin に $REMOTE で存在する）"
  exit 0
fi
echo "タグ $TAG を $COMMIT に打って origin へ push する"
if [ "${1:-}" = "--dry-run" ]; then
  echo "タグの push: changed"
  exit 0
fi

# 適用
if ! git tag "$TAG" "$COMMIT" 2>/tmp/vscode-tag.err; then
  echo "タグの作成: failed"
  echo "\$ git tag $TAG $COMMIT"
  cat /tmp/vscode-tag.err
  exit 1
fi
if ! git push origin "$TAG" 2>/tmp/vscode-tag.err; then
  echo "タグの push: failed"
  echo "\$ git push origin $TAG"
  cat /tmp/vscode-tag.err
  exit 1
fi
echo "タグの push: changed"
