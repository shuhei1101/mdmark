#!/bin/sh
# master へ入った commit に vscode-v0.1.0 のタグを打って push し、GitHub Actions に .vsix を作らせる
set -eu

TAG=vscode-v0.1.0
VERSION=0.1.0

# 前提確認: origin/master の vscode/package.json の version が出すバージョンと等しい
git fetch --quiet origin master --tags
MASTER_VERSION=$(git show origin/master:vscode/package.json 2>/dev/null | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d;}).on("end",()=>{try{process.stdout.write(JSON.parse(s).version);}catch{process.stdout.write("");}});')
if [ "$MASTER_VERSION" != "$VERSION" ]; then
  echo "前提確認: failed（origin/master の vscode/package.json の version が「${MASTER_VERSION}」で、${VERSION} ではない）"
  exit 1
fi
echo "前提確認: ok"

# 計画（--dry-run もここを通る）
if git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "タグの付与: skipped（$TAG は origin に既にある）"
  exit 0
fi
TARGET=$(git rev-parse origin/master)
echo "付けるタグ: $TAG → $TARGET（origin/master）"
if [ "${1:-}" = "--dry-run" ]; then
  echo "タグの付与: changed"
  exit 0
fi

# 適用（タグを打って push する。GitHub Actions の vscode-release が .vsix を Release に添える）
git tag "$TAG" "$TARGET"
git push origin "refs/tags/$TAG"
echo "タグの付与: changed"
