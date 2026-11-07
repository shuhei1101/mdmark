# mermaid の PoC

[#382](https://github.com/shuhei1101/mdmark/pull/382) の PoC 検証のコード。マージせずに閉じる。

develop の worktree（`dist/` と `node_modules/` があるもの）を引数に指定して、次の順に実行する。

1. `node bundle.mjs {develop の worktree}`: CLI の `bundleViewer` で mermaid 12.3.0 をまとめ、`out/export.html` と `out/bundle.json` を書き出す
2. `node run.mjs {develop の worktree}`: 書き出した HTML と、プレビューと同じ規則で組んだ CSP のページを、ライトとダークで開き、`out/results.json` とスクリーンショットを書き出す
