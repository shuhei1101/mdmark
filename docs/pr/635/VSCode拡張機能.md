# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/layout/LAY-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/6edae01e/docs/layout/LAY-472-1.yaml) | `tests/unit/vscode`・`tests/integration/vscode`・`vscode/tests/integration` の 3 つのエントリが同じ `content_types`（`test`・`vscode`）を持つ | 分ける理由を `notes` に記載する |
| 実装 | [vscode/package.json](https://github.com/shuhei1101/mdmark/blob/6edae01e/vscode/package.json) | `mocha`・`@vscode/test-electron` を `devDependencies` に持ち、`test:integration` が `node tests/integration/run.ts` を実行する | 変えない |
| 実装 | [vscode/scripts/build.ts](https://github.com/shuhei1101/mdmark/blob/6edae01e/vscode/scripts/build.ts) | `--tests` で `vscode/tests/integration/` の `index.ts` と `*.test.ts` を `out/test/` にまとめる | 変えない |
| テスト | [tests/unit/vscode/](https://github.com/shuhei1101/mdmark/blob/6edae01e/tests/unit/vscode)・[tests/integration/vscode/](https://github.com/shuhei1101/mdmark/blob/6edae01e/tests/integration/vscode)・[vscode/tests/integration/](https://github.com/shuhei1101/mdmark/blob/6edae01e/vscode/tests/integration) | VS Code 拡張機能の単体テスト・Webview の部品のストーリーの結合テスト・VS Code の上で動かす結合テスト | 移さない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 置き場所 | 直下の Vitest で動かすテスト（`tests/unit/vscode/`・`tests/integration/vscode/`）と、VS Code の上で mocha で動かすテスト（`vscode/tests/integration/`）の 2 つに分ける | 理由は [要件](./要件.md) |
| フォルダ構成の設計書 | LAY-472-1 の `notes` に、置き場所ごとの実行する道具と分ける理由を記載する | テストとテストの設定は変えない |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| モジュール構成設計 | `716342fc..89b9cdcc` | LAY-472-1 の `notes` |

## テスト結果

なし。VS Code 拡張機能のテストとテストの設定を変えず、フォルダ構成の設計書の `notes` の記載だけのため。
