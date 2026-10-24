# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/テスト/テスト実行方法.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%86%E3%82%B9%E3%83%88/%E3%83%86%E3%82%B9%E3%83%88%E5%AE%9F%E8%A1%8C%E6%96%B9%E6%B3%95.yaml) | E2E テストの説明が「`tests/e2e/vscode.ts` が VS Code 1.141.0 を `@vscode/test-electron` で取得し」と書き、取得がワーカーごとに走ることを前提にしている | 更新対象 |
| テスト | [tests/e2e/vscode.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/vscode.ts) | `vscodeExecutable()` がテストごとに `downloadAndUnzipVSCode({ version: "1.141.0", cachePath: vscode/.vscode-test })` を呼び、VS Code を起動する処理（287 行目）がその戻り値を `executablePath` に渡す | 更新対象。並列のワーカーが同じキャッシュへ同時に展開して壊す |
| テスト | [playwright.config.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/playwright.config.ts) | E2E のプロジェクト（Chromium・Firefox）と待ちの長さを持ち、`globalSetup` を持たない | 更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| VS Code の取得 | `playwright.config.ts` に `globalSetup` を置き、そこで `vscode/` の `@vscode/test-electron` の `downloadAndUnzipVSCode` を、今と同じバージョンとキャッシュの場所で 1 回だけ呼ぶ | キャッシュが揃っていれば `downloadAndUnzipVSCode` は取り直さない |
| 実行ファイルの場所の受け渡し | `globalSetup` が得た実行ファイルの場所を、ワーカーのテストが読める形（環境変数など）で渡し、`vscodeExecutable()` はそれを返す。ワーカーの中では `downloadAndUnzipVSCode` を呼ばない | 渡し方は実装の段で決める |
| バージョンとキャッシュの場所 | `VSCODE_VERSION` とキャッシュの場所の定義は 1 か所に置き、`globalSetup` と `vscode.ts` で同じ値を使う | |
| テスト実行方法 | E2E テストの説明の取得の記述を、ワーカーが並ぶ前に 1 回だけ取得する形に書き換え、前提に VS Code の取得（`npm --prefix vscode ci` で入れた `@vscode/test-electron` を使い、初回に `vscode/.vscode-test/` へ取得する）を加える | 他の前提は変えない |

## テスト結果
