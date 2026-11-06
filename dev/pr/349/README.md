# PoC: esbuild-wasm

## 検証対象

VS Code 拡張機能の拡張機能ホストの中で、esbuild-wasm を使って設定の `extensions`（`.ts`・`.js`。相対パスと https の URL の import を含む）を 1 つの ES モジュールに束ねられるか。作業 PR #347 のライブラリ選定（案 A）の PoC。

## 調査結果

| 項目 | 内容 |
| --- | --- |
| バージョン | 0.28.2（2026-08-08）。CLI が使う esbuild と同じ版 |
| ライセンス | MIT |
| 保守状況 | 作者が保守。#4560（`worker: false` で終わったビルドの結果がメモリに残る）が未解決 |

## 検証観点と成功条件

| 検証観点 | 成功条件 | 実測 | 判定 |
| --- | --- | --- | --- |
| 束ねる | `vscode/scripts/build.ts` で `esbuild-wasm/lib/browser.js` を `dist/extension.cjs` に束ねられ、`esbuild.wasm` が `dist/` に入る。`vsce package --no-dependencies` の .vsix に `node_modules` が入らない | 未 | 未 |
| 拡張機能ホストで初期化する | `@vscode/test-electron` の拡張機能ホストで `initialize({ wasmModule, worker: false })` が通り、`self` を `globalThis` に足さない | 未 | 未 |
| `.ts` を束ねる | 相対パスの import と https の URL の import を持つ `.ts` の拡張を 1 つの ES モジュールに束ねられ、ファイルに書いて `asWebviewUri` で読ませる形で、今の CSP のまま Webview が `registerExtension` できる | 未 | 未 |
| 時間 | 初期化と 1 回目の束ね、2 回目以降の束ねの時間を記録し、`mdmark.preview.updateDelayMs` の既定 300ms と比べる | 未 | 未 |
| メモリ | 20 回束ねたときの拡張機能ホストのメモリの増え方と、`stop()` してから `initialize` し直したときの戻り方を記録する | 未 | 未 |
