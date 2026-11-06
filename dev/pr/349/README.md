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
| 束ねる | `vscode/scripts/build.ts` で `esbuild-wasm/lib/browser.js` を `dist/extension.cjs` に束ねられ、`esbuild.wasm` が `dist/` に入る。`vsce package --no-dependencies` の .vsix に `node_modules` が入らない | `self` を足すビルドのプラグインつきで `dist/extension.cjs`（477KB）に束ねられ、`dist/esbuild.wasm`（13.98MB）を写した。.vsix は 10 ファイル・3.99MB で、`node_modules` のファイルは 0 件 | 成功 |
| 拡張機能ホストで初期化する | `@vscode/test-electron` の拡張機能ホストで `initialize({ wasmModule, worker: false })` が通り、`self` を `globalThis` に足さない | VS Code 1.141.0 の拡張機能ホストで初期化が通った。`"self" in globalThis` は初期化の前後とも `false` | 成功 |
| `.ts` を束ねる | 相対パスの import と https の URL の import を持つ `.ts` の拡張を 1 つの ES モジュールに束ねられ、ファイルに書いて `asWebviewUri` で読ませる形で、今の CSP のまま Webview が `registerExtension` できる | 型注釈・相対パスの `.ts`・jsDelivr の `nanoid` を持つ拡張を 277 バイトの ES モジュールに束ねた。`globalStorageUri` の下のファイルに書き、`localResourceRoots` をそのフォルダにした Webview で、`data:`・`blob:` を持たない CSP（nonce・`cspSource`・jsDelivr）のまま `import()` でき、既定の export の関数を呼べた | 成功 |
| 時間 | 初期化と 1 回目の束ね、2 回目以降の束ねの時間を記録し、`mdmark.preview.updateDelayMs` の既定 300ms と比べる | 初期化と 1 回目: 801ms。2〜6 回目: 242・330・555・248・189ms（毎回 jsDelivr から取り直す時間を含む）。`stop()` の後の初期化と束ね: 291ms。2 回目以降の束ねは既定の 300ms と同じ程度で、URL の取得をキャッシュしないと描き直しのたびに足される | 条件付きで成功。束ねるのは設定を読み直したとき（`extensions` のパス・ファイルが変わったとき）だけにし、Markdown の書き換えの描き直しでは束ねない。URL の取得は CLI と同じく 1 回の読み直しの中でキャッシュする |
| メモリ | 20 回束ねたときの拡張機能ホストのメモリの増え方と、`stop()` してから `initialize` し直したときの戻り方を記録する | RSS: 束ねる前 221.2MB → 20 回の後 233.3MB（+12.1MB）→ `stop()` して初期化し直して 1 回束ねた後 239.0MB。`stop()` で RSS は戻らなかった（GC を呼べない拡張機能ホストのため、解放は GC 次第） | 条件付きで成功。1 回あたり約 0.6MB 増える。束ねるのを設定の読み直しのときだけにすれば増え方は小さく、`stop()` の回避策は入れない |

## 結論

esbuild-wasm を採用できる。VS Code 拡張機能は `esbuild-wasm/lib/browser.js` を `dist/extension.cjs` に束ね、`esbuild.wasm` を `dist/` に写し、`initialize({ wasmModule, worker: false })` で初期化する。束ねた結果は `globalStorageUri` の下のファイルに書いて `asWebviewUri` で読ませ、CSP を広げない。束ねるのは設定を読み直したときだけにする。

確かめた VS Code は 1.141.0（対応する下限）だけ。検証のコードは `vscode/src/poc/` と `vscode/tests/integration/poc-esbuild-wasm.test.ts`（`MDMARK_POC_ONLY=1 npm run test:integration` で流す）。
