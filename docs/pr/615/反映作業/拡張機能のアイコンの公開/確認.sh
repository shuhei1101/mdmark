#!/bin/sh
# vscode-v0.1.4 のワークフローが成功し、Release に mdmark-0.1.4.vsix があり、
# Marketplace の一覧に 0.1.4 が出た後、0.1.4 がアイコンの資産を持つかを読み取りだけで確かめる
set -u

TAG=vscode-v0.1.4
VERSION=0.1.4
QUERY_URL='https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'
rc=0

query() {
  curl -fsS -X POST "$QUERY_URL" \
    -H 'Content-Type: application/json' -H 'Accept: application/json;api-version=7.2-preview.1' \
    -d '{"filters":[{"criteria":[{"filterType":7,"value":"ShuheiNishikawa.mdmark-vscode"}]}],"flags":3}'
}

# ワークフローの完了を待つ（15 分で打ち切る）
i=0
CONCLUSION=""
until [ -n "$CONCLUSION" ] || [ $i -ge 90 ]; do
  CONCLUSION=$(gh run list --workflow vscode-release.yml --branch "$TAG" --limit 1 --json status,conclusion \
    -q '.[] | select(.status=="completed") | .conclusion')
  [ -n "$CONCLUSION" ] || { i=$((i+1)); sleep 10; }
done
if [ "$CONCLUSION" = "success" ]; then
  echo "ワークフロー: ok"
else
  echo "ワークフロー: failed（${CONCLUSION:-完了しない}）"
  gh run list --workflow vscode-release.yml --branch "$TAG" --limit 1
  rc=1
fi
if gh release view "$TAG" --json assets -q '.assets[].name' 2>/dev/null | grep -qx "mdmark-$VERSION.vsix"; then
  echo "Release の .vsix: ok"
else
  echo "Release の .vsix: failed"
  rc=1
fi

# Marketplace の一覧に出るまで待つ（開発コマンドの公開の確認と同じく 60 秒おき・上限 20 分）
LISTED=""
for i in $(seq 1 20); do
  if query | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=JSON.parse(s).results[0].extensions[0];console.log(e?e.versions.map(v=>v.version).join("\n"):"")})' \
    | grep -qx "$VERSION"; then
    LISTED=1
    break
  fi
  [ "$i" = 20 ] || sleep 60
done
if [ -n "$LISTED" ]; then
  echo "Marketplace の $VERSION: ok"
else
  echo "Marketplace の $VERSION: failed"
  exit 1
fi

ICON=$(query | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=JSON.parse(s).results[0].extensions[0];const v=e.versions.find(x=>x.version===process.argv[1]);console.log(v&&(v.files||[]).some(f=>f.assetType==="Microsoft.VisualStudio.Services.Icons.Default")?"yes":"no")})' "$VERSION")
if [ "$ICON" = "yes" ]; then
  echo "Marketplace の $VERSION のアイコン: ok"
else
  echo "Marketplace の $VERSION のアイコン: failed"
  rc=1
fi
exit $rc
