#!/bin/bash
# 文書の置き換え・改名・参照の付け替えを base から一度に行う
set -e
S=/tmp/mdmark-289-scripts; R=$S/renames.tsv; BASE=7a9367dd
awk -F'\t' '{print $2}' "$R" | while read -r n; do [ -e "$n" ] && git rm -q -r --cached "$n" >/dev/null 2>&1; rm -f "$n"; done
find docs/使用方法 -depth -type d -empty -delete 2>/dev/null || true
git checkout $BASE -- dev/設計書 dev/テンプレート dev/mock dev/README.md dev/index.yaml docs README.md CLAUDE.md dev-docs.yaml tests/e2e guide src/files.yaml src/parts/code-block.stories.ts schemas/files.yaml migrations/files.yaml templates/files.yaml vscode/files.yaml vscode/tests/integration/helpers.ts
rm -rf docs/使用方法
python3 -I $S/reword.py $(cat $S/doc_targets.txt) | awk '{s+=$1} END {print "reword", s, NR}'
python3 - <<'PY'
import pathlib
p=pathlib.Path('dev/設計書/インターフェース定義/VSCode拡張機能/拡張機能の配布物を作る.ts.yaml'); t=p.read_text(encoding='utf-8')
for a,b in [('比較の段で','比較の工程で'),('item: 段の並び','item: 工程の並び'),('作る段を','作る工程を'),('添える段は','添える工程は')]:
    assert a in t; t=t.replace(a,b)
p.write_text(t,encoding='utf-8')
PY
sed -i 's/アクセシブルネーム/スクリーンリーダー向けの名前/g' dev/設計書/インターフェース定義/ライブラリ本体/文書を描く.ts.yaml
python3 $S/glossary_alias.py
while IFS=$'\t' read -r o n; do mkdir -p "$(dirname "$n")"; git mv "$o" "$n"; done < "$R"
find docs/使い方 -depth -type d -empty -delete 2>/dev/null || true
python3 -I $S/relink.py "$R"
sed -i 's#使い方/書く/文書の記載方法\.md#使用方法/記載する/文書の記載方法.md#' dev-docs.yaml
python3 $S/relink2.py "$R" $BASE
