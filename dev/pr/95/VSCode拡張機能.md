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

### 単体

なし

### 結合

なし

### E2E

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/e2e/global-setup.ts` | 全実行 | 新規 | ✅ | `globalSetup`。ワーカーの前に VS Code を 1 回だけ取得する |
| `tests/e2e/vscode-binary.ts` | 全実行 | 新規 | ✅ | バージョンとキャッシュの場所の定義と取得 |
| [tests/e2e/vscode.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/vscode.ts) | 全実行 | 変更 | ✅ | `vscodeExecutable()` が環境変数の実行ファイルの場所を返す |
| [tests/e2e/単一ユースケース/HTMLに書き出す.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.spec.ts) | 全実行 | 実行のみ | ✅ | 3 テスト pass<br>`テスト結果/20261024095424_46a2c67_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/PDFに印刷する.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/PDF%E3%81%AB%E5%8D%B0%E5%88%B7%E3%81%99%E3%82%8B.spec.ts) | 全実行 | 実行のみ | ✅ | 2 テスト pass<br>`テスト結果/20261024095424_46a2c67_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/VSCodeでプレビューを開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | 全実行 | 実行のみ | ✅ | 7 テスト pass<br>`テスト結果/20261024095424_46a2c67_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/エディタとプレビューのスクロールを合わせる.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%A8%E3%83%87%E3%82%A3%E3%82%BF%E3%81%A8%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.spec.ts) | 全実行 | 実行のみ | ✅ | 3 テスト pass<br>`テスト結果/20261024095424_46a2c67_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/プレビューのリンクと画像を開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AE%E3%83%AA%E3%83%B3%E3%82%AF%E3%81%A8%E7%94%BB%E5%83%8F%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | 全実行 | 実行のみ | ✅ | 5 テスト pass<br>`テスト結果/20261024095424_46a2c67_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/プレビューをVSCodeのテーマに合わせる.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92VSCode%E3%81%AE%E3%83%86%E3%83%BC%E3%83%9E%E3%81%AB%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.spec.ts) | 全実行 | 実行のみ | ✅ | 2 テスト pass<br>`テスト結果/20261024095424_46a2c67_E2Eテスト.log` |
| [tests/e2e/単一ユースケース/書いた内容をプレビューに映す.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E6%9B%B8%E3%81%84%E3%81%9F%E5%86%85%E5%AE%B9%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AB%E6%98%A0%E3%81%99.spec.ts) | 全実行 | 実行のみ | ✅ | 6 テスト pass<br>`テスト結果/20261024095424_46a2c67_E2Eテスト.log` |
| [tests/e2e/複合ユースケース/VSCodeで書きながら確かめてPDFにする.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E6%9B%B8%E3%81%8D%E3%81%AA%E3%81%8C%E3%82%89%E7%A2%BA%E3%81%8B%E3%82%81%E3%81%A6PDF%E3%81%AB%E3%81%99%E3%82%8B.spec.ts) | 全実行 | 実行のみ | ✅ | 2 テスト pass<br>`テスト結果/20261024095424_46a2c67_E2Eテスト.log` |

`vscode/.vscode-test` を消した状態から、8 つの spec を Chromium のプロジェクトで並列の 4 ワーカーのまま流し、30 テストが全て pass した。
流した後のキャッシュ `vscode/.vscode-test/vscode-linux-x64-1.141.0/` に `icudtl.dat` と `is-complete` がある（`テスト結果/20261024095424_46a2c67_E2Eテスト.log` の末尾）。

### lint

`npm run lint && npm run typecheck` が違反なしで終わった。
`テスト結果/20261024095759_46a2c67_lint.log`
