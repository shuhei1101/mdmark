#!/bin/sh
# vscode-v0.1.3 のワークフローが成功し、Release に mdmark-0.1.3.vsix があり、Marketplace に 0.1.3 が公開されたかを読み取りだけで確かめる
set -u

TAG=vscode-v0.1.3
VERSION=0.1.3
rc=0

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
PUBLISHED=$(curl -fsS -X POST 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery' \
  -H 'Content-Type: application/json' -H 'Accept: application/json;api-version=7.2-preview.1' \
  -d '{"filters":[{"criteria":[{"filterType":7,"value":"ShuheiNishikawa.mdmark-vscode"}]}],"flags":1}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=JSON.parse(s).results[0].extensions[0];console.log(e?e.versions.map(v=>v.version).join(" "):"")})')
echo "Marketplace の公開済みのバージョン: $PUBLISHED"
if echo " $PUBLISHED " | grep -q " $VERSION "; then
  echo "Marketplace の $VERSION: ok"
else
  echo "Marketplace の $VERSION: failed"
  rc=1
fi
exit $rc
