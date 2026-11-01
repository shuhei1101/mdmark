# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/設定を開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%A8%AD%E5%AE%9A%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | `mdmark.openSettings` が `@ext:{拡張機能の ID}` で設定画面を開く | フローの図・期待値・制約に `@ext:ShuheiNishikawa.mdmark` を書いている |
| 実装 | [vscode/package.json](https://github.com/shuhei1101/mdmark/blob/develop/vscode/package.json) | 拡張機能のマニフェスト | `name`・`displayName` が `mdmark` |
| 実装 | [vscode/package-lock.json](https://github.com/shuhei1101/mdmark/blob/develop/vscode/package-lock.json) | 依存のロック | `name` が `mdmark` |
| 実装 | [vscode/src/extension.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/extension.ts) | `mdmark.openSettings` | `context.extension.id` から ID を作り、値を持たない（変えない） |
| テスト | [vscode/tests/integration/helpers.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/helpers.ts) | 結合テストの共通の処理 | `EXTENSION_ID` が `ShuheiNishikawa.mdmark`。`commands.test.ts`・`open-settings.test.ts`・`preview-open.test.ts` とログのパスがこの定数を使う |
| テスト | [tests/e2e/単一ユースケース/プレビューから設定を開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%8B%E3%82%89%E8%A8%AD%E5%AE%9A%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | 設定画面の検索欄の絞り込みを確かめる E2E | `EXTENSION_FILTER` が `@ext:ShuheiNishikawa.mdmark` |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| マニフェスト | `vscode/package.json` の `name` を `mdmark-vscode`、`displayName` を `mdmark for VS Code` にする。`vscode/package-lock.json` の 2 か所の `name` を `mdmark-vscode` にする | `publisher`・`version`・`contributes` は変えない |
| インターフェース定義 | 『設定を開く』のフローの図・期待値・制約の `@ext:ShuheiNishikawa.mdmark` を `@ext:ShuheiNishikawa.mdmark-vscode` にする | ID を `publisher`.`name` から作る記述は変えない |
| 結合テスト | `vscode/tests/integration/helpers.ts` の `EXTENSION_ID` を `ShuheiNishikawa.mdmark-vscode` にする | 定数を使うテストは書き換えない |
| E2E テスト | `プレビューから設定を開く.spec.ts` の `EXTENSION_FILTER` を `@ext:ShuheiNishikawa.mdmark-vscode` にする | - |
| .vsix | ファイル名 `mdmark-{バージョン}.vsix` を変えない | `--out` で決めている |
| 既存機能への影響 | コマンドの ID・`category`・設定のキー・出力のチャンネル名は変えない | 拡張機能の ID が変わるため、古い ID で入れた .vsix とは別の拡張機能として入る。古い ID で公開した版は無い |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| 単体テスト全件（`npm run test:unit`） | 全実行 | 実行のみ | ✅ | 1129 テスト pass。[20261101193109_38d9654_単体テスト.log](./テスト結果/20261101193109_38d9654_単体テスト.log)・lint: [20261101193109_38d9654_lint.log](./テスト結果/20261101193109_38d9654_lint.log) |

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `vscode/tests/integration/helpers.ts` | `EXTENSION_ID` | 変更 | ✅ | [20261101195704_1832912_結合テスト.log](./テスト結果/20261101195704_1832912_結合テスト.log) |
| VS Code 拡張機能の結合テスト全件（`xvfb-run -a npm --prefix vscode run test:integration`） | 全実行 | 実行のみ | ✅ | VS Code 1.141.0・stable（1.144.0）で各 63 テスト pass。lint: [20261101195704_1832912_lint.log](./テスト結果/20261101195704_1832912_lint.log) |
